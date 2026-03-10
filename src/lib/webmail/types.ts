export interface WebmailMessage {
  uid: number;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  folder: string;
  seen: boolean;
}

export interface WebmailClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getInboxMessages(since: Date): Promise<WebmailMessage[]>;
  getSpamMessages(since: Date): Promise<WebmailMessage[]>;
  markAsRead(folder: string, uid: number): Promise<void>;
  moveToInbox(fromFolder: string, uid: number): Promise<void>;
  sendReply(
    originalMessage: WebmailMessage,
    replyBody: string,
    replySubject: string
  ): Promise<void>;
}

export interface ProviderConfig {
  imapHost: string;
  imapPort: number;
  spamFolder: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}
