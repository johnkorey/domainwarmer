import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyWebhookSignature,
  parseWebhookEvent,
  MailgunWebhookEvent,
} from "@/lib/mailgun/webhooks";

export async function POST(request: NextRequest) {
  try {
    const event: MailgunWebhookEvent = await request.json();

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(event);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const { eventType, messageId, timestamp } = parseWebhookEvent(event);
    if (!messageId) {
      return NextResponse.json({ error: "No message ID" }, { status: 400 });
    }

    // Find the email log entry
    const emailLog = await prisma.emailLog.findUnique({
      where: { mailgunMessageId: messageId },
    });
    if (!emailLog) {
      // Email not tracked by us, ignore
      return NextResponse.json({ status: "ignored" });
    }

    // Update email status based on event type
    const updateData: Record<string, unknown> = {};
    let statField: string | null = null;

    switch (eventType) {
      case "delivered":
        updateData.status = "DELIVERED";
        updateData.deliveredAt = timestamp;
        statField = "delivered";
        break;
      case "opened":
        updateData.status = "OPENED";
        updateData.openedAt = timestamp;
        statField = "opened";
        break;
      case "failed":
        if (event["event-data"].severity === "permanent") {
          updateData.status = "BOUNCED";
          updateData.bouncedAt = timestamp;
          statField = "bounced";
        } else {
          updateData.status = "FAILED";
          updateData.failedAt = timestamp;
          statField = "failed";
        }
        updateData.failureReason =
          event["event-data"]["delivery-status"]?.message || event["event-data"].reason;
        break;
      case "complained":
        updateData.status = "COMPLAINED";
        updateData.complainedAt = timestamp;
        statField = "complained";
        break;
      default:
        return NextResponse.json({ status: "ignored", event: eventType });
    }

    // Update email log
    await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: updateData,
    });

    // Update daily stats
    if (statField) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await prisma.dailyStat.upsert({
        where: {
          domainId_date: { domainId: emailLog.domainId, date: today },
        },
        create: {
          domainId: emailLog.domainId,
          date: today,
          [statField]: 1,
        },
        update: {
          [statField]: { increment: 1 },
        },
      });
    }

    return NextResponse.json({ status: "processed", event: eventType });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
