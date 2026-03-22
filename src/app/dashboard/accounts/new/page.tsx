"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewAccountPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [provider, setProvider] = useState("CPANEL");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("465");
  const [isWarmingAccount, setIsWarmingAccount] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch("/api/webmail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          provider,
          imapPassword: password,
          imapHost: provider === "CPANEL" ? imapHost : undefined,
          imapPort: provider === "CPANEL" ? parseInt(imapPort) : undefined,
          smtpHost: provider === "CPANEL" ? smtpHost : undefined,
          smtpPort: provider === "CPANEL" ? parseInt(smtpPort) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create account");
        return;
      }

      const data = await res.json();
      router.push(`/dashboard/accounts/${data.id}`);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // Auto-fill IMAP/SMTP hosts from email domain for cPanel
  function handleEmailChange(value: string) {
    setEmail(value);
    if (provider === "CPANEL" && value.includes("@")) {
      const domain = value.split("@")[1];
      if (domain && !imapHost) setImapHost(`mail.${domain}`);
      if (domain && !smtpHost) setSmtpHost(`mail.${domain}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Add Email Account"
        description="Add a webmail account for warming or engagement"
        actions={
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Account Details</CardTitle>
          <CardDescription>
            cPanel accounts are automatically analyzed and warming begins immediately. Gmail, Outlook, etc. are for engagement only (open, reply, rescue from spam).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Select
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setIsWarmingAccount(e.target.value === "CPANEL");
                }}
              >
                <option value="CPANEL">cPanel (Warming + Engagement)</option>
                <option value="GMAIL">Gmail (Engagement Only)</option>
                <option value="OUTLOOK">Outlook (Engagement Only)</option>
                <option value="YAHOO">Yahoo (Engagement Only)</option>
                <option value="AOL">AOL (Engagement Only)</option>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Email Address</label>
              <Input
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                placeholder="Email account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-muted-foreground">
                {provider === "GMAIL" ? "Use an App Password (not your Google password)" : "Your email account password"}
              </p>
            </div>

            {provider === "CPANEL" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">IMAP Host</label>
                    <Input
                      placeholder="mail.example.com"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">IMAP Port</label>
                    <Input
                      type="number"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SMTP Host</label>
                    <Input
                      placeholder="mail.example.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">SMTP Port</label>
                    <Input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {provider === "CPANEL" && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                AI will analyze your domain, assign an initial score, and automatically begin warming.
              </div>
            )}

            <Button type="submit" disabled={saving || !email || !password}>
              {saving ? "Adding..." : "Add Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
