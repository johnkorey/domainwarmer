import { prisma } from "../prisma";
import { subDays } from "date-fns";

export interface ReputationData {
  score: number;
  deliveryRate: number;
  openRate: number;
  bounceRate: number;
  complaintRate: number;
  totalSent: number;
  webmailOpenRate: number;
  spamRescueRate: number;
}

export async function calculateReputation(
  accountId: string
): Promise<ReputationData> {
  const sevenDaysAgo = subDays(new Date(), 7);

  const stats = await prisma.dailyStat.findMany({
    where: {
      accountId,
      date: { gte: sevenDaysAgo },
    },
  });

  const totals = stats.reduce(
    (acc, s) => ({
      sent: acc.sent + s.sent,
      delivered: acc.delivered + s.delivered,
      opened: acc.opened + s.opened,
      bounced: acc.bounced + s.bounced,
      complained: acc.complained + s.complained,
    }),
    { sent: 0, delivered: 0, opened: 0, bounced: 0, complained: 0 }
  );

  if (totals.sent === 0) {
    return {
      score: 0,
      deliveryRate: 0,
      openRate: 0,
      bounceRate: 0,
      complaintRate: 0,
      totalSent: 0,
      webmailOpenRate: 0,
      spamRescueRate: 0,
    };
  }

  const deliveryRate = totals.delivered / totals.sent;
  const openRate = totals.delivered > 0 ? totals.opened / totals.delivered : 0;
  const bounceRate = totals.bounced / totals.sent;
  const complaintRate = totals.complained / totals.sent;

  // Calculate webmail engagement metrics
  const webmailEngagement = await getWebmailEngagementMetrics(
    accountId,
    sevenDaysAgo
  );

  const hasWebmail =
    webmailEngagement.webmailOpenRate > 0 ||
    webmailEngagement.spamRescueRate > 0;

  let score: number;
  if (hasWebmail) {
    const webmailScore =
      webmailEngagement.spamRescueRate * 0.6 +
      webmailEngagement.webmailOpenRate * 0.4;

    score = Math.min(
      100,
      Math.max(
        0,
        deliveryRate * 30 +
          openRate * 20 +
          (1 - bounceRate) * 20 +
          (1 - complaintRate * 100) * 10 +
          webmailScore * 20
      )
    );
  } else {
    score = Math.min(
      100,
      Math.max(
        0,
        deliveryRate * 35 +
          openRate * 25 +
          (1 - bounceRate) * 25 +
          (1 - complaintRate * 100) * 15
      )
    );
  }

  return {
    score: Math.round(score * 10) / 10,
    deliveryRate,
    openRate,
    bounceRate,
    complaintRate,
    totalSent: totals.sent,
    webmailOpenRate: webmailEngagement.webmailOpenRate,
    spamRescueRate: webmailEngagement.spamRescueRate,
  };
}

async function getWebmailEngagementMetrics(
  accountId: string,
  since: Date
): Promise<{ webmailOpenRate: number; spamRescueRate: number }> {
  const engagementLogs = await prisma.engagementLog.findMany({
    where: {
      performedAt: { gte: since },
      emailLog: { accountId },
    },
    select: { action: true },
  });

  if (engagementLogs.length === 0) {
    return { webmailOpenRate: 0, spamRescueRate: 0 };
  }

  const opened = engagementLogs.filter((l) => l.action === "OPENED").length;
  const movedToInbox = engagementLogs.filter(
    (l) => l.action === "MOVED_TO_INBOX"
  ).length;
  const total = engagementLogs.length;

  return {
    webmailOpenRate: total > 0 ? opened / total : 0,
    spamRescueRate: movedToInbox > 0 ? 1 : 0,
  };
}

export async function updateAccountReputation(accountId: string): Promise<number> {
  const { score } = await calculateReputation(accountId);
  await prisma.webmailAccount.update({
    where: { id: accountId },
    data: { reputationScore: score },
  });
  return score;
}
