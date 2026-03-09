import { prisma } from "../prisma";
import { subDays } from "date-fns";

export interface ReputationData {
  score: number;
  deliveryRate: number;
  openRate: number;
  bounceRate: number;
  complaintRate: number;
  totalSent: number;
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
    };
  }

  const deliveryRate = totals.delivered / totals.sent;
  const openRate = totals.delivered > 0 ? totals.opened / totals.delivered : 0;
  const bounceRate = totals.bounced / totals.sent;
  const complaintRate = totals.complained / totals.sent;

  const score = Math.min(
    100,
    Math.max(
      0,
      deliveryRate * 35 +
        openRate * 25 +
        (1 - bounceRate) * 25 +
        (1 - complaintRate * 100) * 15
    )
  );

  return {
    score: Math.round(score * 10) / 10,
    deliveryRate,
    openRate,
    bounceRate,
    complaintRate,
    totalSent: totals.sent,
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
