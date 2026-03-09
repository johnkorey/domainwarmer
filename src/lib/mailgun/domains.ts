import { mailgunGet, mailgunPost, mailgunPut, mailgunDelete } from "./client";

export interface MailgunDomainInfo {
  domain: {
    name: string;
    state: string;
    spam_action: string;
    wildcard: boolean;
    created_at: string;
  };
  receiving_dns_records: MailgunDnsRecord[];
  sending_dns_records: MailgunDnsRecord[];
}

export interface MailgunDnsRecord {
  record_type: string;
  valid: string;
  name: string;
  value: string;
  priority?: string;
}

export async function createMailgunDomain(
  domainName: string
): Promise<MailgunDomainInfo> {
  return mailgunPost("/domains", {
    name: domainName,
    spam_action: "disabled",
    wildcard: "false",
  });
}

export async function getMailgunDomain(
  domainName: string
): Promise<MailgunDomainInfo> {
  return mailgunGet(`/domains/${domainName}`);
}

export async function verifyMailgunDomain(
  domainName: string
): Promise<MailgunDomainInfo> {
  return mailgunPut(`/domains/${domainName}/verify`);
}

export async function deleteMailgunDomain(
  domainName: string
): Promise<{ message: string }> {
  return mailgunDelete(`/domains/${domainName}`);
}

export async function listMailgunDomains(): Promise<{
  items: Array<{
    name: string;
    state: string;
    created_at: string;
  }>;
}> {
  return mailgunGet("/domains");
}

export function parseDnsHealth(info: MailgunDomainInfo) {
  const sendingRecords = info.sending_dns_records || [];
  const receivingRecords = info.receiving_dns_records || [];

  const spfRecord = sendingRecords.find(
    (r) => r.record_type === "TXT" && r.name.includes(info.domain.name)
  );
  const dkimRecords = sendingRecords.filter(
    (r) => r.record_type === "TXT" && r.name.includes("domainkey")
  );
  const mxRecords = receivingRecords.filter(
    (r) => r.record_type === "MX"
  );

  return {
    spfValid: spfRecord?.valid === "valid",
    dkimValid: dkimRecords.every((r) => r.valid === "valid"),
    mxValid: mxRecords.length > 0 && mxRecords.every((r) => r.valid === "valid"),
    dmarcValid: false, // Mailgun doesn't verify DMARC directly
    isVerified: info.domain.state === "active",
    sendingRecords,
    receivingRecords,
  };
}
