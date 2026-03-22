import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { populateScheduleConfig, getDayTarget } from "@/lib/warming/schedules";
import { generateEmailContent } from "@/lib/ai/content-generator";
import { CONTENT_POOL_GENERATE } from "@/lib/constants";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    await requireAuth();
    const { accountId } = await params;

    const account = await prisma.webmailAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (!account.smtpHost || !account.imapPassword) {
      return NextResponse.json(
        { error: "SMTP and IMAP credentials must be configured before warming can start" },
        { status: 400 }
      );
    }

    // Populate warming schedule
    await populateScheduleConfig(accountId, account.warmingSchedule);

    const dayOneTarget = await getDayTarget(accountId, 1);

    await prisma.webmailAccount.update({
      where: { id: accountId },
      data: {
        isWarmingAccount: true,
        warmingStatus: "WARMING",
        warmingStartedAt: new Date(),
        currentDay: 1,
        dailyTarget: dayOneTarget,
        sentToday: 0,
        pausedAt: null,
      },
    });

    // Pre-generate content pool async
    generateEmailContent(accountId, CONTENT_POOL_GENERATE).catch((err) =>
      console.error(`Failed to pre-generate content for ${account.email}:`, err)
    );

    return NextResponse.json({ success: true, dailyTarget: dayOneTarget });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
