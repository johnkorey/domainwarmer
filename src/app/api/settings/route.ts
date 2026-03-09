import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";
import { validateApiKey } from "@/lib/mailgun/client";
import { maskApiKey } from "@/lib/utils";

export async function GET() {
  try {
    await requireAuth();

    let settings = await prisma.settings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.settings.create({ data: { id: "singleton" } });
    }

    return NextResponse.json({
      ...settings,
      mailgunApiKey: settings.mailgunApiKey
        ? maskApiKey(decrypt(settings.mailgunApiKey))
        : null,
      openRouterApiKey: settings.openRouterApiKey
        ? maskApiKey(decrypt(settings.openRouterApiKey))
        : null,
      webhookSigningKey: settings.webhookSigningKey ? "••••••••" : null,
      hasMailgunKey: !!settings.mailgunApiKey,
      hasOpenRouterKey: !!settings.openRouterApiKey,
      hasWebhookKey: !!settings.webhookSigningKey,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAuth();
    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.mailgunApiKey !== undefined) {
      // Validate the key before saving
      const isValid = await validateApiKey(body.mailgunApiKey);
      if (!isValid) {
        return NextResponse.json(
          { error: "Invalid Mailgun API key" },
          { status: 400 }
        );
      }
      updateData.mailgunApiKey = encrypt(body.mailgunApiKey);
    }

    if (body.openRouterApiKey !== undefined) {
      updateData.openRouterApiKey = encrypt(body.openRouterApiKey);
    }

    if (body.webhookSigningKey !== undefined) {
      updateData.webhookSigningKey = encrypt(body.webhookSigningKey);
    }

    if (body.defaultFromName !== undefined) {
      updateData.defaultFromName = body.defaultFromName;
    }

    if (body.maxDailyGlobalEmails !== undefined) {
      updateData.maxDailyGlobalEmails = body.maxDailyGlobalEmails;
    }

    if (body.warmingEnabled !== undefined) {
      updateData.warmingEnabled = body.warmingEnabled;
    }

    const settings = await prisma.settings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...updateData },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      hasMailgunKey: !!settings.mailgunApiKey,
      hasOpenRouterKey: !!settings.openRouterApiKey,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
