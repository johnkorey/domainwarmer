import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";
import { maskApiKey } from "@/lib/utils";

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    let settings = await prisma.settings.findUnique({
      where: { id: "singleton" },
    });

    if (!settings) {
      settings = await prisma.settings.create({ data: { id: "singleton" } });
    }

    const reveal = request.nextUrl.searchParams.get("reveal") === "true";

    return NextResponse.json({
      ...settings,
      openRouterApiKey: settings.openRouterApiKey
        ? reveal ? decrypt(settings.openRouterApiKey) : maskApiKey(decrypt(settings.openRouterApiKey))
        : null,
      hasOpenRouterKey: !!settings.openRouterApiKey,
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

    if (body.openRouterApiKey !== undefined) {
      updateData.openRouterApiKey = encrypt(body.openRouterApiKey);
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

    if (body.webmailEngagementEnabled !== undefined) {
      updateData.webmailEngagementEnabled = body.webmailEngagementEnabled;
    }

    const settings = await prisma.settings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", ...updateData },
      update: updateData,
    });

    return NextResponse.json({
      success: true,
      hasOpenRouterKey: !!settings.openRouterApiKey,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
