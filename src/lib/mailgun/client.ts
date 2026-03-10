import { prisma } from "../prisma";
import { decrypt } from "../encryption";

const MAILGUN_API_BASE = "https://api.mailgun.net/v3";
const MAILGUN_API_BASE_V4 = "https://api.mailgun.net/v4";

async function getApiKey(): Promise<string> {
  const settings = await prisma.settings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings?.mailgunApiKey) {
    throw new Error("Mailgun API key not configured");
  }
  return decrypt(settings.mailgunApiKey);
}

function authHeader(apiKey: string): string {
  return "Basic " + Buffer.from(`api:${apiKey}`).toString("base64");
}

export async function mailgunGet(path: string, version: "v3" | "v4" = "v3") {
  const apiKey = await getApiKey();
  const base = version === "v4" ? MAILGUN_API_BASE_V4 : MAILGUN_API_BASE;
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Mailgun API error (${res.status}): ${body}`);
  }
  return res.json();
}

export async function mailgunPost(
  path: string,
  body: Record<string, string> | FormData,
  version: "v3" | "v4" = "v3"
) {
  const apiKey = await getApiKey();
  const base = version === "v4" ? MAILGUN_API_BASE_V4 : MAILGUN_API_BASE;

  const isFormData = body instanceof FormData;
  const formBody = isFormData
    ? body
    : new URLSearchParams(body as Record<string, string>);

  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(apiKey),
    },
    body: formBody,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mailgun API error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function mailgunPut(
  path: string,
  body?: Record<string, string>
) {
  const apiKey = await getApiKey();
  const res = await fetch(`${MAILGUN_API_BASE}${path}`, {
    method: "PUT",
    headers: { Authorization: authHeader(apiKey) },
    body: body ? new URLSearchParams(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mailgun API error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function mailgunDelete(path: string) {
  const apiKey = await getApiKey();
  const res = await fetch(`${MAILGUN_API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: authHeader(apiKey) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mailgun API error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch(`${MAILGUN_API_BASE}/domains`, {
      headers: { Authorization: authHeader(apiKey) },
    });
    return res.ok;
  } catch {
    return false;
  }
}
