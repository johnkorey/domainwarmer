import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { analyzeDomain } from "@/lib/ai/domain-analyzer";
import { generateBusinessSummary, generateEmailContent } from "@/lib/ai/content-generator";
import { populateScheduleConfig, getDayTarget } from "@/lib/warming/schedules";
import { CONTENT_POOL_GENERATE } from "@/lib/constants";
import { maskApiKey } from "@/lib/utils";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await params;

  const account = await prisma.webmailAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  if (!account.isWarmingAccount) {
    return NextResponse.json(
      { error: "Not a warming account" },
      { status: 400 }
    );
  }

  // Verify password can be decrypted — if not, user needs to re-enter it
  if (account.imapPassword) {
    try {
      decrypt(account.imapPassword);
    } catch {
      return NextResponse.json(
        { error: "Email password cannot be decrypted. Please update your password in the Settings tab, then try again." },
        { status: 400 }
      );
    }
  }

  // Check OpenRouter API key is configured
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings?.openRouterApiKey) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured. Go to Settings to add it." },
      { status: 400 }
    );
  }

  const emailDomain = account.email.split("@")[1];

  try {
    // Phase 1: Analyze domain and generate business summary in parallel
    const [analysis, businessData] = await Promise.all([
      analyzeDomain(emailDomain),
      generateBusinessSummary(emailDomain),
    ]);

    // Store analysis results + business summary
    await prisma.webmailAccount.update({
      where: { id: account.id },
      data: {
        initialAnalysis: JSON.stringify(analysis),
        reputationScore: analysis.score,
        businessSummary: businessData.summary,
        businessKeywords: businessData.keywords,
      },
    });

    // Phase 2: Populate warming schedule if not already done
    const existingSchedule = await prisma.warmingScheduleConfig.findFirst({
      where: { accountId: account.id },
    });
    if (!existingSchedule) {
      await populateScheduleConfig(account.id, account.warmingSchedule);
    }

    // Phase 3: Start warming if not already started
    if (account.warmingStatus === "NOT_STARTED" || (account.warmingStatus === "WARMING" && account.currentDay === 0)) {
      const dayOneTarget = await getDayTarget(account.id, 1);
      await prisma.webmailAccount.update({
        where: { id: account.id },
        data: {
          warmingStatus: "WARMING",
          warmingStartedAt: account.warmingStartedAt || new Date(),
          currentDay: account.currentDay || 1,
          dailyTarget: dayOneTarget,
          sentToday: 0,
        },
      });
    }

    // Phase 4: Generate content pool if empty
    const contentCount = await prisma.generatedContent.count({
      where: { accountId: account.id, usedAt: null },
    });
    if (contentCount < CONTENT_POOL_GENERATE) {
      const toGenerate = CONTENT_POOL_GENERATE - contentCount;
      await generateEmailContent(account.id, toGenerate);
    }

    // Return updated account
    const updated = await prisma.webmailAccount.findUnique({
      where: { id: account.id },
      include: {
        dailyStats: { orderBy: { date: "desc" }, take: 30 },
        _count: {
          select: { emailLogs: true, seedAddresses: true, generatedContent: true, engagementLogs: true },
        },
      },
    });

    return NextResponse.json({
      ...updated,
      imapPassword: updated?.imapPassword ? maskApiKey(updated.imapPassword) : null,
    });
  } catch (err) {
    console.error(`[Initialize] Failed for ${account.email}:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Initialization failed" },
      { status: 500 }
    );
  }
}
