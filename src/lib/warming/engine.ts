import { prisma } from "../prisma";
import { WarmingStatus } from "@prisma/client";
import { sendViaSmtp } from "../smtp/sender";
import {
  getAvailableContent,
  markContentUsed,
} from "../ai/content-generator";
import { getDayTarget } from "./schedules";
import { adjustWarmingPace } from "./adjuster";
import { updateAccountReputation } from "./reputation";
import { REPLY_PERCENTAGE } from "../constants";
import { addHours } from "date-fns";

export async function processWarmingBatch(): Promise<void> {
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings?.warmingEnabled) return;

  const accounts = await prisma.webmailAccount.findMany({
    where: {
      isWarmingAccount: true,
      warmingStatus: WarmingStatus.WARMING,
      isActive: true,
    },
  });

  for (const account of accounts) {
    try {
      await processAccountBatch(account.id);
    } catch (err) {
      console.error(`Error processing account ${account.email}:`, err);
    }
  }
}

async function processAccountBatch(accountId: string): Promise<void> {
  const account = await prisma.webmailAccount.findUnique({
    where: { id: accountId },
    include: { seedAddresses: true },
  });
  if (!account || !account.imapPassword || !account.smtpHost) return;

  // Check if day needs advancing
  await advanceDay(accountId);

  // Refresh account after potential day advance
  const updatedAccount = await prisma.webmailAccount.findUnique({
    where: { id: accountId },
  });
  if (!updatedAccount || updatedAccount.sentToday >= updatedAccount.dailyTarget) return;

  // Calculate batch size (spread across ~96 10-min windows in 16 hrs)
  const remaining = updatedAccount.dailyTarget - updatedAccount.sentToday;
  const now = new Date();
  const hoursLeft = Math.max(1, 22 - now.getUTCHours());
  const windowsLeft = Math.max(1, hoursLeft * 6);
  const batchSize = Math.min(remaining, Math.max(1, Math.ceil(remaining / windowsLeft)));

  // Get seed addresses (account-specific + global) and other warming accounts
  const seeds = await prisma.seedAddress.findMany({
    where: {
      OR: [{ accountId: accountId }, { accountId: null }],
    },
  });

  // Also get other warming accounts as recipients (cross-warming)
  const otherAccounts = await prisma.webmailAccount.findMany({
    where: {
      id: { not: accountId },
      isActive: true,
    },
    select: { email: true },
  });

  // Combine seed addresses + other account emails as recipients
  const recipients = [
    ...seeds.map((s) => s.email),
    ...otherAccounts.map((a) => a.email),
  ];

  if (recipients.length === 0) {
    console.warn(`No recipients for account ${updatedAccount.email}`);
    return;
  }

  let recipientIndex = updatedAccount.sentToday % recipients.length;

  for (let i = 0; i < batchSize; i++) {
    const content = await getAvailableContent(accountId);
    if (!content) {
      console.warn(`No content available for account ${updatedAccount.email}`);
      break;
    }

    const recipient = recipients[recipientIndex % recipients.length];
    recipientIndex++;

    const displayName = content.senderName || "Team";

    try {
      const result = await sendViaSmtp(
        {
          email: account.email,
          imapPassword: account.imapPassword!,
          smtpHost: account.smtpHost,
          smtpPort: account.smtpPort,
          imapHost: account.imapHost,
          imapPort: account.imapPort,
          provider: account.provider,
        },
        {
          to: recipient,
          subject: content.subject,
          text: content.body,
          html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${content.body.replace(/\n/g, "<br>")}</div>`,
          displayName,
        }
      );

      const shouldReply = Math.random() < REPLY_PERCENTAGE;
      const replyDelay = 1 + Math.random() * 3;

      await prisma.emailLog.create({
        data: {
          accountId,
          smtpMessageId: result.messageId,
          fromAddress: account.email,
          toAddress: recipient,
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

      await prisma.webmailAccount.update({
        where: { id: accountId },
        data: { sentToday: { increment: 1 } },
      });

      // Update daily stats
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      await prisma.dailyStat.upsert({
        where: { accountId_date: { accountId, date: today } },
        create: { accountId, date: today, sent: 1 },
        update: { sent: { increment: 1 } },
      });
    } catch (err) {
      console.error(`Failed to send warming email from ${updatedAccount.email}:`, err);

      await prisma.emailLog.create({
        data: {
          accountId,
          fromAddress: account.email,
          toAddress: recipient,
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
  const adjustment = await adjustWarmingPace(accountId);
  if (adjustment.action !== "continue") {
    console.log(
      `Account ${updatedAccount.email}: ${adjustment.action} - ${adjustment.reason}`
    );
  }

  // Update reputation score
  await updateAccountReputation(accountId);
}

async function advanceDay(accountId: string): Promise<void> {
  const account = await prisma.webmailAccount.findUnique({ where: { id: accountId } });
  if (!account || !account.warmingStartedAt) return;

  const daysSinceStart = Math.floor(
    (Date.now() - account.warmingStartedAt.getTime()) / (1000 * 60 * 60 * 24)
  );
  const newDay = daysSinceStart + 1;

  if (newDay > account.currentDay) {
    const newTarget = await getDayTarget(accountId, newDay);
    await prisma.webmailAccount.update({
      where: { id: accountId },
      data: {
        currentDay: newDay,
        dailyTarget: newTarget,
        sentToday: 0,
      },
    });
  }
}
