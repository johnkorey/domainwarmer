import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { getProviderConfig } from "@/lib/webmail/provider-config";
import { maskApiKey } from "@/lib/utils";

export async function GET() {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.webmailAccount.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { engagementLogs: true },
      },
    },
  });

  const masked = accounts.map((a) => ({
    ...a,
    imapPassword: a.imapPassword ? maskApiKey(a.imapPassword) : null,
  }));

  return NextResponse.json(masked);
}

export async function POST(req: NextRequest) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { email, provider, imapPassword, imapHost, imapPort, smtpHost, smtpPort } = body;

  if (!email || !provider || !imapPassword) {
    return NextResponse.json(
      { error: "email, provider, and imapPassword are required" },
      { status: 400 }
    );
  }

  const validProviders = ["GMAIL", "OUTLOOK", "YAHOO", "AOL", "ROUNDCUBE"];
  if (!validProviders.includes(provider)) {
    return NextResponse.json(
      { error: "Invalid provider" },
      { status: 400 }
    );
  }

  // For Roundcube, require IMAP host
  if (provider === "ROUNDCUBE" && !imapHost) {
    return NextResponse.json(
      { error: "IMAP host is required for Roundcube" },
      { status: 400 }
    );
  }

  // Check for duplicates
  const existing = await prisma.webmailAccount.findUnique({
    where: { email_provider: { email, provider } },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Account already exists" },
      { status: 409 }
    );
  }

  // Get provider config for defaults
  const config = getProviderConfig(provider, imapHost, imapPort, smtpHost, smtpPort);

  const account = await prisma.webmailAccount.create({
    data: {
      email,
      provider,
      imapPassword: encrypt(imapPassword),
      imapHost: provider === "ROUNDCUBE" ? imapHost : config.imapHost,
      imapPort: provider === "ROUNDCUBE" ? (imapPort || config.imapPort) : config.imapPort,
      smtpHost: provider === "ROUNDCUBE" ? (smtpHost || config.smtpHost) : config.smtpHost,
      smtpPort: provider === "ROUNDCUBE" ? (smtpPort || config.smtpPort) : config.smtpPort,
    },
  });

  return NextResponse.json(
    { ...account, imapPassword: maskApiKey(account.imapPassword!) },
    { status: 201 }
  );
}
