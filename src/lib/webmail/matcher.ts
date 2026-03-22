import { prisma } from "../prisma";
import { WebmailMessage } from "./types";
import { WEBMAIL_LOOKBACK_DAYS } from "../constants";

export async function matchToEmailLog(
  msg: WebmailMessage,
  accountEmail: string
): Promise<string | null> {
  const lookbackDate = new Date();
  lookbackDate.setDate(lookbackDate.getDate() - WEBMAIL_LOOKBACK_DAYS);

  // Try matching by SMTP Message-ID first (most accurate)
  if (msg.messageId) {
    const byMessageId = await prisma.emailLog.findUnique({
      where: { smtpMessageId: msg.messageId },
      select: { id: true },
    });
    if (byMessageId) return byMessageId.id;
  }

  // Fall back to matching by recipient + subject + time window
  const matches = await prisma.emailLog.findMany({
    where: {
      toAddress: accountEmail,
      subject: msg.subject,
      sentAt: { gte: lookbackDate },
      status: { in: ["SENT", "DELIVERED", "OPENED"] },
    },
    select: { id: true },
    orderBy: { sentAt: "desc" },
    take: 1,
  });

  return matches.length > 0 ? matches[0].id : null;
}
