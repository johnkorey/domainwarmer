import { prisma } from "../prisma";
import { WarmingStatus } from "@prisma/client";
import { sendEmail } from "../mailgun/messages";
import {
  getAvailableContent,
  markContentUsed,
  generateReplyContent,
} from "../ai/content-generator";
import { getDayTarget } from "./schedules";
import { adjustWarmingPace } from "./adjuster";
import { updateDomainReputation } from "./reputation";
import { REPLY_PERCENTAGE } from "../constants";
import { addHours } from "date-fns";

export async function processWarmingBatch(): Promise<void> {
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings?.warmingEnabled) return;

  const domains = await prisma.domain.findMany({
    where: {
      warmingStatus: WarmingStatus.WARMING,
      isVerified: true,
    },
  });

  for (const domain of domains) {
    try {
      await processDomainBatch(domain.id);
    } catch (err) {
      console.error(`Error processing domain ${domain.domain}:`, err);
    }
  }

  // Process scheduled replies
  await processScheduledReplies();
}

async function processDomainBatch(domainId: string): Promise<void> {
  const domain = await prisma.domain.findUnique({
    where: { id: domainId },
    include: { seedAddresses: true },
  });
  if (!domain) return;

  // Check if day needs advancing
  await advanceDay(domainId);

  // Refresh domain after potential day advance
  const updatedDomain = await prisma.domain.findUnique({
    where: { id: domainId },
  });
  if (!updatedDomain || updatedDomain.sentToday >= updatedDomain.dailyTarget) return;

  // Calculate batch size (spread across ~96 10-min windows in 16 hrs)
  const remaining = updatedDomain.dailyTarget - updatedDomain.sentToday;
  const now = new Date();
  const hoursLeft = Math.max(1, 22 - now.getUTCHours()); // till 10pm
  const windowsLeft = Math.max(1, hoursLeft * 6); // 6 windows per hour
  const batchSize = Math.min(remaining, Math.max(1, Math.ceil(remaining / windowsLeft)));

  // Get seed addresses
  const seeds = await prisma.seedAddress.findMany({
    where: {
      OR: [{ domainId: domainId }, { domainId: null }],
    },
  });

  if (seeds.length === 0) {
    console.warn(`No seed addresses for domain ${updatedDomain.domain}`);
    return;
  }

  let seedIndex = updatedDomain.sentToday % seeds.length;

  for (let i = 0; i < batchSize; i++) {
    const content = await getAvailableContent(domainId);
    if (!content) {
      console.warn(`No content available for domain ${updatedDomain.domain}`);
      break;
    }

    const seed = seeds[seedIndex % seeds.length];
    seedIndex++;

    const fromName = content.senderName || "Team";
    const fromAddress = `${fromName.toLowerCase().replace(/\s+/g, ".")}@${updatedDomain.domain}`;

    try {
      const result = await sendEmail(updatedDomain.domain, {
        from: `${fromName} <${fromAddress}>`,
        to: seed.email,
        subject: content.subject,
        text: content.body,
        html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${content.body.replace(/\n/g, "<br>")}</div>`,
      });

      const shouldReply = Math.random() < REPLY_PERCENTAGE;
      const replyDelay = 1 + Math.random() * 3; // 1-4 hours

      await prisma.emailLog.create({
        data: {
          domainId,
          mailgunMessageId: result.id,
          fromAddress,
          toAddress: seed.email,
          subject: content.subject,
          bodyPreview: content.body.slice(0, 200),
          status: "SENT",
          sentAt: new Date(),
          shouldReply,
          replyScheduledAt: shouldReply
            ? addHours(new Date(), replyDelay)
            : null,
        },
      });

      await markContentUsed(content.id);

      await prisma.domain.update({
        where: { id: domainId },
        data: { sentToday: { increment: 1 } },
      });

      // Update daily stats
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await prisma.dailyStat.upsert({
        where: { domainId_date: { domainId, date: today } },
        create: { domainId, date: today, sent: 1 },
        update: { sent: { increment: 1 } },
      });
    } catch (err) {
      console.error(`Failed to send warming email for ${updatedDomain.domain}:`, err);

      await prisma.emailLog.create({
        data: {
          domainId,
          fromAddress,
          toAddress: seed.email,
          subject: content.subject,
          bodyPreview: content.body.slice(0, 200),
          status: "FAILED",
          failedAt: new Date(),
          failureReason: err instanceof Error ? err.message : "Unknown error",
          sentAt: new Date(),
        },
      });
    }
  }

  // Run adjuster after batch
  const adjustment = await adjustWarmingPace(domainId);
  if (adjustment.action !== "continue") {
    console.log(
      `Domain ${updatedDomain.domain}: ${adjustment.action} - ${adjustment.reason}`
    );
  }

  // Update reputation score
  await updateDomainReputation(domainId);
}

async function advanceDay(domainId: string): Promise<void> {
  const domain = await prisma.domain.findUnique({ where: { id: domainId } });
  if (!domain || !domain.warmingStartedAt) return;

  const daysSinceStart = Math.floor(
    (Date.now() - domain.warmingStartedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const newDay = daysSinceStart + 1;

  if (newDay > domain.currentDay) {
    const newTarget = await getDayTarget(domainId, newDay);
    await prisma.domain.update({
      where: { id: domainId },
      data: {
        currentDay: newDay,
        dailyTarget: newTarget,
        sentToday: 0,
      },
    });
  }
}

async function processScheduledReplies(): Promise<void> {
  const dueReplies = await prisma.emailLog.findMany({
    where: {
      shouldReply: true,
      isReply: false,
      replyScheduledAt: { lte: new Date() },
      status: { in: ["SENT", "DELIVERED", "OPENED"] },
    },
    include: { domain: true },
    take: 10,
  });

  for (const original of dueReplies) {
    try {
      const replyContent = await generateReplyContent(
        original.subject,
        original.bodyPreview || "",
        original.domain.businessSummary || ""
      );

      if (!replyContent) {
        await prisma.emailLog.update({
          where: { id: original.id },
          data: { shouldReply: false },
        });
        continue;
      }

      // Send reply FROM seed TO domain address
      const result = await sendEmail(original.domain.domain, {
        from: original.toAddress,
        to: original.fromAddress,
        subject: replyContent.subject,
        text: replyContent.body,
        html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${replyContent.body.replace(/\n/g, "<br>")}</div>`,
        inReplyTo: original.mailgunMessageId || undefined,
      });

      await prisma.emailLog.create({
        data: {
          domainId: original.domainId,
          mailgunMessageId: result.id,
          fromAddress: original.toAddress,
          toAddress: original.fromAddress,
          subject: replyContent.subject,
          bodyPreview: replyContent.body.slice(0, 200),
          isReply: true,
          inReplyToId: original.id,
          status: "SENT",
          sentAt: new Date(),
        },
      });

      // Mark original as replied
      await prisma.emailLog.update({
        where: { id: original.id },
        data: { shouldReply: false },
      });
    } catch (err) {
      console.error(`Failed to send reply for email ${original.id}:`, err);
    }
  }
}
