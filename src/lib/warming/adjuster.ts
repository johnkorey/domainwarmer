import { prisma } from "../prisma";
import { WarmingStatus } from "@prisma/client";
import { calculateReputation } from "./reputation";
import { getScheduleLength } from "./schedules";
import {
  BOUNCE_RATE_LIMIT,
  COMPLAINT_RATE_LIMIT,
  REPUTATION_THRESHOLDS,
} from "../constants";
import { subHours } from "date-fns";

export interface AdjustmentResult {
  action: "continue" | "pause" | "slow" | "ready";
  reason?: string;
  newDailyTarget?: number;
}

export async function adjustWarmingPace(
  domainId: string
): Promise<AdjustmentResult> {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain) return { action: "pause", reason: "Domain not found" };

  // Check last 24h metrics
  const oneDayAgo = subHours(new Date(), 24);
  const recentEmails = await prisma.emailLog.findMany({
    where: {
      domainId,
      sentAt: { gte: oneDayAgo },
    },
    select: { status: true },
  });

  const recentTotal = recentEmails.length;
  if (recentTotal > 0) {
    const recentBounced = recentEmails.filter(
      (e) => e.status === "BOUNCED"
    ).length;
    const recentComplaints = recentEmails.filter(
      (e) => e.status === "COMPLAINED"
    ).length;

    const bounceRate = recentBounced / recentTotal;
    const complaintRate = recentComplaints / recentTotal;

    if (bounceRate > BOUNCE_RATE_LIMIT) {
      await prisma.domain.update({
        where: { id: domainId },
        data: {
          warmingStatus: WarmingStatus.ISSUES,
          pausedAt: new Date(),
        },
      });
      return {
        action: "pause",
        reason: `Bounce rate ${(bounceRate * 100).toFixed(1)}% exceeds ${BOUNCE_RATE_LIMIT * 100}% limit`,
      };
    }

    if (complaintRate > COMPLAINT_RATE_LIMIT) {
      await prisma.domain.update({
        where: { id: domainId },
        data: {
          warmingStatus: WarmingStatus.ISSUES,
          pausedAt: new Date(),
        },
      });
      return {
        action: "pause",
        reason: `Complaint rate ${(complaintRate * 100).toFixed(2)}% exceeds ${COMPLAINT_RATE_LIMIT * 100}% limit`,
      };
    }
  }

  // Check overall reputation
  const { score } = await calculateReputation(domainId);

  if (score < REPUTATION_THRESHOLDS.CAUTION && score > 0) {
    await prisma.domain.update({
      where: { id: domainId },
      data: {
        warmingStatus: WarmingStatus.ISSUES,
        pausedAt: new Date(),
      },
    });
    return {
      action: "pause",
      reason: `Reputation score ${score} below critical threshold`,
    };
  }

  if (score >= REPUTATION_THRESHOLDS.CAUTION && score < REPUTATION_THRESHOLDS.GOOD) {
    const newTarget = Math.max(2, Math.floor(domain.dailyTarget / 2));
    await prisma.domain.update({
      where: { id: domainId },
      data: { dailyTarget: newTarget },
    });
    return {
      action: "slow",
      reason: `Reputation score ${score} in caution zone, reducing target to ${newTarget}`,
      newDailyTarget: newTarget,
    };
  }

  // Check if warming is complete
  const scheduleLength = getScheduleLength(domain.warmingSchedule);
  if (
    domain.currentDay >= scheduleLength &&
    score >= REPUTATION_THRESHOLDS.EXCELLENT
  ) {
    await prisma.domain.update({
      where: { id: domainId },
      data: { warmingStatus: WarmingStatus.READY },
    });
    return {
      action: "ready",
      reason: `Warming complete! Day ${domain.currentDay}/${scheduleLength}, reputation ${score}`,
    };
  }

  return { action: "continue" };
}
