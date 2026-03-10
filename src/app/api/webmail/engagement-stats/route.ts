import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Aggregate by action type
  const actionCounts = await prisma.engagementLog.groupBy({
    by: ["action"],
    where: { performedAt: { gte: sevenDaysAgo } },
    _count: true,
  });

  const stats = {
    opened: 0,
    movedToInbox: 0,
    markedNotSpam: 0,
    replied: 0,
    starred: 0,
    total: 0,
  };

  for (const entry of actionCounts) {
    stats.total += entry._count;
    switch (entry.action) {
      case "OPENED":
        stats.opened = entry._count;
        break;
      case "MOVED_TO_INBOX":
        stats.movedToInbox = entry._count;
        break;
      case "MARKED_NOT_SPAM":
        stats.markedNotSpam = entry._count;
        break;
      case "REPLIED":
        stats.replied = entry._count;
        break;
      case "STARRED":
        stats.starred = entry._count;
        break;
    }
  }

  // Per-account stats
  const accountStats = await prisma.webmailAccount.findMany({
    select: {
      id: true,
      email: true,
      provider: true,
      isActive: true,
      lastCheckedAt: true,
      lastError: true,
      consecutiveErrors: true,
      _count: {
        select: { engagementLogs: true },
      },
    },
  });

  // Recent activity
  const recentActivity = await prisma.engagementLog.findMany({
    where: { performedAt: { gte: sevenDaysAgo } },
    include: {
      account: { select: { email: true, provider: true } },
    },
    orderBy: { performedAt: "desc" },
    take: 50,
  });

  const activeAccounts = accountStats.filter((a) => a.isActive).length;

  return NextResponse.json({
    stats,
    activeAccounts,
    totalAccounts: accountStats.length,
    accountStats,
    recentActivity,
  });
}
