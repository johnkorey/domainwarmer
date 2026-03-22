import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateAccountReputation } from "@/lib/warming/reputation";

export async function POST(request: NextRequest) {
  const cronSecret = request.headers.get("x-cron-secret");
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Reset sentToday for all warming accounts
    await prisma.webmailAccount.updateMany({
      where: { isWarmingAccount: true, warmingStatus: "WARMING" },
      data: { sentToday: 0 },
    });

    // Update reputation scores for all active warming accounts
    const accounts = await prisma.webmailAccount.findMany({
      where: {
        isWarmingAccount: true,
        warmingStatus: { in: ["WARMING", "READY"] },
      },
    });

    for (const account of accounts) {
      await updateAccountReputation(account.id);
    }

    return NextResponse.json({ success: true, updated: accounts.length });
  } catch (err) {
    console.error("Stats aggregation cron error:", err);
    return NextResponse.json(
      { error: "Stats aggregation failed" },
      { status: 500 }
    );
  }
}
