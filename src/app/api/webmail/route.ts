import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { getProviderConfig } from "@/lib/webmail/provider-config";
import { maskApiKey } from "@/lib/utils";
import { generateBusinessSummary } from "@/lib/ai/content-generator";

export async function GET() {
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.webmailAccount.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { engagementLogs: true, emailLogs: true },
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
  try {
    await requireAuth();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { email, provider, imapPassword, imapHost, imapPort, smtpHost, smtpPort, isWarmingAccount } = body;

  if (!email || !provider || !imapPassword) {
    return NextResponse.json(
      { error: "email, provider, and imapPassword are required" },
      { status: 400 }
    );
  }

  const validProviders = ["GMAIL", "OUTLOOK", "YAHOO", "AOL", "CPANEL"];
  if (!validProviders.includes(provider)) {
    return NextResponse.json(
      { error: "Invalid provider" },
      { status: 400 }
    );
  }

  // For cPanel, require IMAP and SMTP host
  if (provider === "CPANEL" && (!imapHost || !smtpHost)) {
    return NextResponse.json(
      { error: "IMAP host and SMTP host are required for cPanel" },
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
      imapHost: provider === "CPANEL" ? imapHost : config.imapHost,
      imapPort: provider === "CPANEL" ? (imapPort || config.imapPort) : config.imapPort,
      smtpHost: provider === "CPANEL" ? smtpHost : config.smtpHost,
      smtpPort: provider === "CPANEL" ? (smtpPort || config.smtpPort) : config.smtpPort,
      isWarmingAccount: isWarmingAccount ?? (provider === "CPANEL"),
    },
  });

  // Generate business summary async for warming accounts
  if (account.isWarmingAccount) {
    const emailDomain = email.split("@")[1];
    generateBusinessSummary(emailDomain)
      .then(async ({ summary, keywords }) => {
        await prisma.webmailAccount.update({
          where: { id: account.id },
          data: { businessSummary: summary, businessKeywords: keywords },
        });
      })
      .catch((err) => {
        console.error(`Failed to generate business summary for ${email}:`, err);
      });
  }

  return NextResponse.json(
    { ...account, imapPassword: maskApiKey(account.imapPassword!) },
    { status: 201 }
  );
}
