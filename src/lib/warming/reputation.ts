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
  domainId: string
): Promise<ReputationData> {
  const sevenDaysAgo = subDays(new Date(), 7);

  const stats = await prisma.dailyStat.findMany({
    where: {
      domainId,
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
    domainId,
    sevenDaysAgo
  );

  const hasWebmail =
    webmailEngagement.webmailOpenRate > 0 ||
    webmailEngagement.spamRescueRate > 0;

  let score: number;
  if (hasWebmail) {
    // Reweighted formula including webmail engagement (20%)
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
    // Original formula when no webmail accounts configured
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
  domainId: string,
  since: Date
): Promise<{ webmailOpenRate: number; spamRescueRate: number }> {
  // Get engagement logs linked to this domain's emails
  const engagementLogs = await prisma.engagementLog.findMany({
    where: {
      performedAt: { gte: since },
      emailLog: { domainId },
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

  // Count distinct emails that were in spam vs total engagement
  const spamRelated = engagementLogs.filter(
    (l) => l.action === "MOVED_TO_INBOX" || l.action === "MARKED_NOT_SPAM"
  ).length;

  return {
    webmailOpenRate: total > 0 ? opened / total : 0,
    spamRescueRate: spamRelated > 0 ? movedToInbox / Math.max(1, movedToInbox) : 0,
  };
}

export async function updateDomainReputation(domainId: string): Promise<number> {
  const { score } = await calculateReputation(domainId);
  await prisma.domain.update({
    where: { id: domainId },
    data: { reputationScore: score },
  });
  return score;
}
