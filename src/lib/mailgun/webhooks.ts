import crypto from "crypto";
import { prisma } from "../prisma";
import { decrypt } from "../encryption";

export interface MailgunWebhookEvent {
  signature: {
    timestamp: string;
    token: string;
    signature: string;
  };
  "event-data": {
    event: string;
    timestamp: number;
    id: string;
    message?: {
      headers?: {
        "message-id"?: string;
      };
    };
    severity?: string;
    reason?: string;
    "delivery-status"?: {
      message?: string;
      code?: number;
      description?: string;
    };
  };
}

export async function verifyWebhookSignature(
  event: MailgunWebhookEvent
): Promise<boolean> {
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings?.webhookSigningKey) {
    console.warn("Webhook signing key not configured, skipping verification");
    return true;
  }

  const signingKey = decrypt(settings.webhookSigningKey);
  const { timestamp, token, signature } = event.signature;

  const encodedToken = crypto
    .createHmac("sha256", signingKey)
    .update(timestamp + token)
    .digest("hex");

  return encodedToken === signature;
}

export function parseWebhookEvent(event: MailgunWebhookEvent) {
  const eventData = event["event-data"];
  const messageId = eventData.message?.headers?.["message-id"];

  return {
    eventType: eventData.event,
    messageId: messageId ? `<${messageId}>` : null,
    timestamp: new Date(eventData.timestamp * 1000),
    severity: eventData.severity,
    reason: eventData.reason,
    deliveryMessage: eventData["delivery-status"]?.message,
  };
}
