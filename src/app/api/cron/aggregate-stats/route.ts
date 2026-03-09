import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateDomainReputation } from "@/lib/warming/reputation";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Reset sentToday for all domains
    await prisma.domain.updateMany({
      where: { warmingStatus: "WARMING" },
      data: { sentToday: 0 },
    });

    // Update reputation scores for all active domains
    const domains = await prisma.domain.findMany({
      where: { warmingStatus: { in: ["WARMING", "READY"] } },
    });

    for (const domain of domains) {
      await updateDomainReputation(domain.id);
    }

    return NextResponse.json({ success: true, updated: domains.length });
  } catch (err) {
    console.error("Stats aggregation cron error:", err);
    return NextResponse.json(
      { error: "Stats aggregation failed" },
      { status: 500 }
    );
  }
}
