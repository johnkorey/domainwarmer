"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Check, Copy, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface DnsRecord {
  record_type: string;
  name: string;
  value: string;
  valid: string;
  priority?: string;
}

export default function AddDomainPage() {
  const router = useRouter();
  const [domainName, setDomainName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dnsRecords, setDnsRecords] = useState<{
    sending: DnsRecord[];
    receiving: DnsRecord[];
  } | null>(null);
  const [domainId, setDomainId] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainName }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add domain");
        return;
      }

      setDomainId(data.domain.id);
      setDnsRecords(data.dnsRecords);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!domainId) return;
    setVerifying(true);

    try {
      const res = await fetch(`/api/domains/${domainId}/verify`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.domain?.isVerified) {
        router.push(`/dashboard/domains/${domainId}`);
      } else {
        setError("Domain not yet verified. Please ensure DNS records are configured and try again.");
      }
    } catch {
      setError("Verification failed");
    } finally {
      setVerifying(false);
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <>
      <PageHeader
        title="Add Domain"
        description="Register a new domain for warming"
        actions={
          <Link href="/dashboard/domains">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        }
      />

      {!dnsRecords ? (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Domain Name</CardTitle>
            <CardDescription>
              Enter the domain you want to warm up. It will be added to your
              Mailgun account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <Input
                placeholder="example.com"
                value={domainName}
                onChange={(e) => setDomainName(e.target.value)}
                required
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Adding..." : "Add Domain"}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configure DNS Records</CardTitle>
              <CardDescription>
                Add the following DNS records to your domain registrar for{" "}
                <strong>{domainName}</strong>, then click Verify.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive mb-4">
                  {error}
                </div>
              )}

              <h3 className="font-semibold mb-3">Sending Records</h3>
              <div className="space-y-3 mb-6">
                {dnsRecords.sending.map((record, i) => (
                  <div key={i} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{record.record_type}</Badge>
                      <Badge variant={record.valid === "valid" ? "success" : "secondary"}>
                        {record.valid === "valid" ? "Valid" : "Pending"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[300px] truncate">
                            {record.name}
                          </code>
                          <button
                            onClick={() => copyToClipboard(record.name, `name-${i}`)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {copied === `name-${i}` ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Value:</span>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[300px] truncate">
                            {record.value}
                          </code>
                          <button
                            onClick={() => copyToClipboard(record.value, `value-${i}`)}
                            className="p-1 hover:bg-muted rounded"
                          >
                            {copied === `value-${i}` ? (
                              <Check className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <h3 className="font-semibold mb-3">Receiving Records (MX)</h3>
              <div className="space-y-3 mb-6">
                {dnsRecords.receiving.map((record, i) => (
                  <div key={i} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{record.record_type}</Badge>
                      {record.priority && (
                        <Badge variant="secondary">Priority: {record.priority}</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Value:</span>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {record.value}
                        </code>
                        <button
                          onClick={() => copyToClipboard(record.value, `rx-${i}`)}
                          className="p-1 hover:bg-muted rounded"
                        >
                          {copied === `rx-${i}` ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button onClick={handleVerify} disabled={verifying} className="w-full">
                {verifying ? "Verifying..." : "Verify Domain"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
