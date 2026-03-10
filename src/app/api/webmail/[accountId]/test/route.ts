import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { ImapWebmailClient } from "@/lib/webmail/imap-client";
import { getProviderConfig } from "@/lib/webmail/provider-config";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await params;

  const account = await prisma.webmailAccount.findUnique({
    where: { id: accountId },
  });
  if (!account || !account.imapPassword) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  try {
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
    await client.disconnect();

    return NextResponse.json({ success: true, message: "Connection successful" });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json(
      { success: false, error: errorMsg },
      { status: 400 }
    );
  }
}
