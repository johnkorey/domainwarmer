import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { populateScheduleConfig, getDayTarget } from "@/lib/warming/schedules";
import { generateEmailContent } from "@/lib/ai/content-generator";
import { CONTENT_POOL_GENERATE } from "@/lib/constants";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ domainId: string }> }
) {
  try {
    await requireAuth();
    const { domainId } = await params;

    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain) {
      return NextResponse.json({ error: "Domain not found" }, { status: 404 });
    }

    if (!domain.isVerified) {
      return NextResponse.json(
        { error: "Domain must be verified before warming can start" },
        { status: 400 }
      );
    }

    // Populate warming schedule
    await populateScheduleConfig(domainId, domain.warmingSchedule);

    const dayOneTarget = await getDayTarget(domainId, 1);

    await prisma.domain.update({
      where: { id: domainId },
      data: {
        warmingStatus: "WARMING",
        warmingStartedAt: new Date(),
        currentDay: 1,
        dailyTarget: dayOneTarget,
        sentToday: 0,
        pausedAt: null,
      },
    });

    // Pre-generate content pool async
    generateEmailContent(domainId, CONTENT_POOL_GENERATE).catch((err) =>
      console.error(`Failed to pre-generate content for ${domain.domain}:`, err)
    );

    return NextResponse.json({ success: true, dailyTarget: dayOneTarget });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
