import * as nodemailer from "nodemailer";
import { decrypt } from "../encryption";
import { getProviderConfig } from "../webmail/provider-config";
import { WebmailProvider } from "@prisma/client";

export interface SmtpSendOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  displayName?: string;
  inReplyTo?: string;
  references?: string;
}

export interface SmtpSendResult {
  messageId: string;
}

export async function sendViaSmtp(
  account: {
    email: string;
    imapPassword: string;
    smtpHost: string | null;
    smtpPort: number | null;
    imapHost: string | null;
    imapPort: number | null;
    provider: WebmailProvider;
  },
  options: SmtpSendOptions
): Promise<SmtpSendResult> {
  const password = decrypt(account.imapPassword);
  const config = getProviderConfig(
    account.provider,
    account.imapHost,
    account.imapPort,
    account.smtpHost,
    account.smtpPort
  );

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: {
      user: account.email,
      pass: password,
    },
  });

  const from = options.displayName
    ? `${options.displayName} <${account.email}>`
    : account.email;

  const info = await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    ...(options.inReplyTo && { inReplyTo: options.inReplyTo }),
    ...(options.references && { references: options.references }),
  });

  transporter.close();

  return { messageId: info.messageId };
}
