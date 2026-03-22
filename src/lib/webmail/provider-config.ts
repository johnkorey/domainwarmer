import { WebmailProvider } from "@prisma/client";
import { ProviderConfig } from "./types";

const PROVIDER_CONFIGS: Record<
  Exclude<WebmailProvider, "CPANEL">,
  ProviderConfig
> = {
  GMAIL: {
    imapHost: "imap.gmail.com",
    imapPort: 993,
    spamFolder: "[Gmail]/Spam",
    smtpHost: "smtp.gmail.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  OUTLOOK: {
    imapHost: "outlook.office365.com",
    imapPort: 993,
    spamFolder: "Junk",
    smtpHost: "smtp.office365.com",
    smtpPort: 587,
    smtpSecure: false,
  },
  YAHOO: {
    imapHost: "imap.mail.yahoo.com",
    imapPort: 993,
    spamFolder: "Bulk Mail",
    smtpHost: "smtp.mail.yahoo.com",
    smtpPort: 465,
    smtpSecure: true,
  },
  AOL: {
    imapHost: "imap.aol.com",
    imapPort: 993,
    spamFolder: "Bulk Mail",
    smtpHost: "smtp.aol.com",
    smtpPort: 465,
    smtpSecure: true,
  },
};

export function getProviderConfig(
  provider: WebmailProvider,
  customHost?: string | null,
  customImapPort?: number | null,
  customSmtpHost?: string | null,
  customSmtpPort?: number | null
): ProviderConfig {
  if (provider === "CPANEL") {
    return {
      imapHost: customHost || "localhost",
      imapPort: customImapPort || 993,
      spamFolder: "Junk",
      smtpHost: customSmtpHost || customHost || "localhost",
      smtpPort: customSmtpPort || 465,
      smtpSecure: true,
    };
  }

  return PROVIDER_CONFIGS[provider];
}

// Alternative spam folder names to try if the primary one fails
export const FALLBACK_SPAM_FOLDERS = [
  "Spam",
  "Junk",
  "Junk E-mail",
  "Bulk Mail",
  "[Gmail]/Spam",
  "INBOX.Spam",
  "INBOX.Junk",
];
