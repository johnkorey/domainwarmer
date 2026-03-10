import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";
import { maskApiKey } from "@/lib/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await params;
  const body = await req.json();

  const account = await prisma.webmailAccount.findUnique({
    where: { id: accountId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};

  if (body.imapPassword) {
    updateData.imapPassword = encrypt(body.imapPassword);
  }
  if (body.imapHost !== undefined) updateData.imapHost = body.imapHost;
  if (body.imapPort !== undefined) updateData.imapPort = body.imapPort;
  if (body.smtpHost !== undefined) updateData.smtpHost = body.smtpHost;
  if (body.smtpPort !== undefined) updateData.smtpPort = body.smtpPort;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  // Reset errors when re-enabling
  if (body.isActive === true) {
    updateData.consecutiveErrors = 0;
    updateData.lastError = null;
  }

  const updated = await prisma.webmailAccount.update({
    where: { id: accountId },
    data: updateData,
  });

  return NextResponse.json({
    ...updated,
    imapPassword: updated.imapPassword
      ? maskApiKey(updated.imapPassword)
      : null,
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  const user = await requireAuth();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await params;

  await prisma.webmailAccount.delete({
    where: { id: accountId },
  });

  return NextResponse.json({ success: true });
}
