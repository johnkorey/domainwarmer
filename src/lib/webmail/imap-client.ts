import { ImapFlow } from "imapflow";
import * as nodemailer from "nodemailer";
import { WebmailClient, WebmailMessage, ProviderConfig } from "./types";
import { FALLBACK_SPAM_FOLDERS } from "./provider-config";

export class ImapWebmailClient implements WebmailClient {
  private client: ImapFlow | null = null;
  private config: ProviderConfig;
  private email: string;
  private password: string;
  private resolvedSpamFolder: string | null = null;

  constructor(email: string, password: string, config: ProviderConfig) {
    this.email = email;
    this.password = password;
    this.config = config;
  }

  async connect(): Promise<void> {
    this.client = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: true,
      auth: {
        user: this.email,
        pass: this.password,
      },
      logger: false,
    });

    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.logout();
      this.client = null;
    }
  }

  async getInboxMessages(since: Date): Promise<WebmailMessage[]> {
    return this.getMessagesFromFolder("INBOX", since);
  }

  async getSpamMessages(since: Date): Promise<WebmailMessage[]> {
    const spamFolder = await this.findSpamFolder();
    if (!spamFolder) return [];
    return this.getMessagesFromFolder(spamFolder, since);
  }

  async markAsRead(folder: string, uid: number): Promise<void> {
    if (!this.client) throw new Error("Not connected");

    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  }

  async moveToInbox(fromFolder: string, uid: number): Promise<void> {
    if (!this.client) throw new Error("Not connected");

    const lock = await this.client.getMailboxLock(fromFolder);
    try {
      await this.client.messageMove({ uid }, "INBOX", { uid: true });
    } finally {
      lock.release();
    }
  }

  async sendReply(
    originalMessage: WebmailMessage,
    replyBody: string,
    replySubject: string
  ): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost,
      port: this.config.smtpPort,
      secure: this.config.smtpSecure,
      auth: {
        user: this.email,
        pass: this.password,
      },
    });

    await transporter.sendMail({
      from: this.email,
      to: originalMessage.from,
      subject: replySubject,
      text: replyBody,
      html: `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6;">${replyBody.replace(/\n/g, "<br>")}</div>`,
      inReplyTo: originalMessage.messageId,
      references: originalMessage.messageId,
    });

    transporter.close();
  }

  private async getMessagesFromFolder(
    folder: string,
    since: Date
  ): Promise<WebmailMessage[]> {
    if (!this.client) throw new Error("Not connected");

    const messages: WebmailMessage[] = [];

    try {
      const lock = await this.client.getMailboxLock(folder);
      try {
        const searchResults = await this.client.search(
          { since },
          { uid: true }
        );

        if (!searchResults || (Array.isArray(searchResults) && searchResults.length === 0)) return messages;

        for await (const msg of this.client.fetch(searchResults, {
          envelope: true,
          flags: true,
          uid: true,
        })) {
          const envelope = msg.envelope;
          if (!envelope) continue;

          messages.push({
            uid: msg.uid,
            messageId: envelope.messageId || "",
            from: envelope.from?.[0]?.address || "",
            to: envelope.to?.[0]?.address || "",
            subject: envelope.subject || "",
            date: envelope.date ? new Date(envelope.date) : new Date(),
            folder,
            seen: msg.flags?.has("\\Seen") || false,
          });
        }
      } finally {
        lock.release();
      }
    } catch (err) {
      // Folder may not exist
      console.warn(`Could not access folder "${folder}":`, err);
    }

    return messages;
  }

  private async findSpamFolder(): Promise<string | null> {
    if (this.resolvedSpamFolder) return this.resolvedSpamFolder;
    if (!this.client) throw new Error("Not connected");

    // Try the configured spam folder first
    const foldersToTry = [
      this.config.spamFolder,
      ...FALLBACK_SPAM_FOLDERS.filter((f) => f !== this.config.spamFolder),
    ];

    const mailboxes = await this.client.list();
    const existingPaths = new Set(mailboxes.map((m) => m.path));

    for (const folder of foldersToTry) {
      if (existingPaths.has(folder)) {
        this.resolvedSpamFolder = folder;
        return folder;
      }
    }

    // Also check for special-use \Junk attribute
    for (const mailbox of mailboxes) {
      if (mailbox.specialUse === "\\Junk") {
        this.resolvedSpamFolder = mailbox.path;
        return mailbox.path;
      }
    }

    return null;
  }
}
