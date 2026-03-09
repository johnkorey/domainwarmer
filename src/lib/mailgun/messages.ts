import { mailgunPost } from "./client";

export interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  inReplyTo?: string;
  references?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  id: string;
  message: string;
}

export async function sendEmail(
  domain: string,
  options: SendEmailOptions
): Promise<SendEmailResult> {
  const formData: Record<string, string> = {
    from: options.from,
    to: options.to,
    subject: options.subject,
  };

  if (options.html) formData["html"] = options.html;
  if (options.text) formData["text"] = options.text;
  if (options.inReplyTo) formData["h:In-Reply-To"] = options.inReplyTo;
  if (options.references) formData["h:References"] = options.references;

  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      formData[`h:${key}`] = value;
    }
  }

  return mailgunPost(`/${domain}/messages`, formData);
}
