import { prisma } from "../prisma";
import { decrypt } from "../encryption";
import { generateReplyContent } from "../ai/content-generator";
import { ImapWebmailClient } from "./imap-client";
import { getProviderConfig } from "./provider-config";
import { matchToEmailLog } from "./matcher";
import {
  WEBMAIL_REPLY_PERCENTAGE,
  WEBMAIL_MAX_CONSECUTIVE_ERRORS,
  WEBMAIL_ACTION_DELAY_MIN,
  WEBMAIL_ACTION_DELAY_MAX,
  WEBMAIL_ACCOUNT_DELAY_MIN,
  WEBMAIL_ACCOUNT_DELAY_MAX,
  WEBMAIL_LOOKBACK_DAYS,
} from "../constants";

function randomDelay(min: number, max: number): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processWebmailEngagement(): Promise<void> {
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings?.webmailEngagementEnabled) return;

  const accounts = await prisma.webmailAccount.findMany({
    where: { isActive: true },
  });

  for (const account of accounts) {
    try {
      await processAccount(account);

      await prisma.webmailAccount.update({
        where: { id: account.id },
        data: {
          lastCheckedAt: new Date(),
          lastError: null,
          consecutiveErrors: 0,
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(
        `Webmail engagement error for ${account.email}:`,
        errorMsg
      );

      const newErrorCount = account.consecutiveErrors + 1;
      await prisma.webmailAccount.update({
        where: { id: account.id },
        data: {
          lastError: errorMsg,
          consecutiveErrors: newErrorCount,
          isActive: newErrorCount < WEBMAIL_MAX_CONSECUTIVE_ERRORS,
        },
      });
    }

    // Delay between accounts
    await randomDelay(WEBMAIL_ACCOUNT_DELAY_MIN, WEBMAIL_ACCOUNT_DELAY_MAX);
  }
}

async function processAccount(
  account: Awaited<ReturnType<typeof prisma.webmailAccount.findFirst>> & {}
): Promise<void> {
  if (!account.imapPassword) {
    throw new Error("No IMAP password configured");
  }

  const password = decrypt(account.imapPassword);
  const config = getProviderConfig(
    account.provider,
    account.imapHost,
    account.imapPort,
    account.smtpHost,
    account.smtpPort
  );

  const client = new ImapWebmailClient(account.email, password, config);
  await client.connect();

  try {
    const since = new Date();
    since.setDate(since.getDate() - WEBMAIL_LOOKBACK_DAYS);

    // 1. Check spam folder — move warming emails to inbox
    const spamMessages = await client.getSpamMessages(since);
    for (const msg of spamMessages) {
      const emailLogId = await matchToEmailLog(msg, account.email);
      if (!emailLogId) continue;

      // Check if we already processed this message
      const existing = await prisma.engagementLog.findFirst({
        where: {
          accountId: account.id,
          emailLogId,
          action: "MOVED_TO_INBOX",
        },
      });
      if (existing) continue;

      await client.moveToInbox(msg.folder, msg.uid);

      await prisma.engagementLog.create({
        data: {
          accountId: account.id,
          emailLogId,
          action: "MOVED_TO_INBOX",
          messageId: msg.messageId,
          fromAddress: msg.from,
          subject: msg.subject,
          folder: msg.folder,
        },
      });

      // Also log as MARKED_NOT_SPAM
      await prisma.engagementLog.create({
        data: {
          accountId: account.id,
          emailLogId,
          action: "MARKED_NOT_SPAM",
          messageId: msg.messageId,
          fromAddress: msg.from,
          subject: msg.subject,
          folder: "INBOX",
        },
      });

      console.log(
        `Moved email from spam to inbox: "${msg.subject}" in ${account.email}`
      );

      await randomDelay(WEBMAIL_ACTION_DELAY_MIN, WEBMAIL_ACTION_DELAY_MAX);
    }

    // 2. Check inbox — open/read warming emails and optionally reply
    const inboxMessages = await client.getInboxMessages(since);
    for (const msg of inboxMessages) {
      const emailLogId = await matchToEmailLog(msg, account.email);
      if (!emailLogId) continue;

      // Check if already engaged
      const alreadyOpened = await prisma.engagementLog.findFirst({
        where: {
          accountId: account.id,
          emailLogId,
          action: "OPENED",
        },
      });

      if (!alreadyOpened) {
        // Mark as read
        if (!msg.seen) {
          await client.markAsRead(msg.folder, msg.uid);
        }

        await prisma.engagementLog.create({
          data: {
            accountId: account.id,
            emailLogId,
            action: "OPENED",
            messageId: msg.messageId,
            fromAddress: msg.from,
            subject: msg.subject,
            folder: msg.folder,
          },
        });

        await randomDelay(WEBMAIL_ACTION_DELAY_MIN, WEBMAIL_ACTION_DELAY_MAX);
      }

      // Reply with configured probability
      const alreadyReplied = await prisma.engagementLog.findFirst({
        where: {
          accountId: account.id,
          emailLogId,
          action: "REPLIED",
        },
      });

      if (!alreadyReplied && Math.random() < WEBMAIL_REPLY_PERCENTAGE) {
        await sendEngagementReply(client, account, msg, emailLogId);
        await randomDelay(WEBMAIL_ACTION_DELAY_MIN, WEBMAIL_ACTION_DELAY_MAX);
      }
    }
  } finally {
    await client.disconnect();
  }
}

async function sendEngagementReply(
  client: ImapWebmailClient,
  account: { id: string; email: string },
  msg: { messageId: string; from: string; subject: string; folder: string },
  emailLogId: string
): Promise<void> {
  // Get the domain's business summary for context
  const emailLog = await prisma.emailLog.findUnique({
    where: { id: emailLogId },
    include: { domain: true },
  });
  if (!emailLog) return;

  const replyContent = await generateReplyContent(
    emailLog.subject,
    emailLog.bodyPreview || "",
    emailLog.domain.businessSummary || ""
  );

  if (!replyContent) return;

  await client.sendReply(
    {
      uid: 0,
      messageId: msg.messageId,
      from: msg.from,
      to: account.email,
      subject: msg.subject,
      date: new Date(),
      folder: msg.folder,
      seen: true,
    },
    replyContent.body,
    replyContent.subject
  );

  await prisma.engagementLog.create({
    data: {
      accountId: account.id,
      emailLogId,
      action: "REPLIED",
      messageId: msg.messageId,
      fromAddress: account.email,
      subject: replyContent.subject,
      folder: msg.folder,
    },
  });

  console.log(
    `Sent engagement reply from ${account.email} for: "${msg.subject}"`
  );
}
