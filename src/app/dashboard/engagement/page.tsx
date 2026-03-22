"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Eye,
  ArrowRightLeft,
  ShieldCheck,
  MessageSquare,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";

interface WebmailAccount {
  id: string;
  email: string;
  provider: string;
  isActive: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  consecutiveErrors: number;
  createdAt: string;
  _count: { engagementLogs: number };
}

interface EngagementStats {
  stats: {
    opened: number;
    movedToInbox: number;
    markedNotSpam: number;
    replied: number;
    total: number;
  };
  activeAccounts: number;
  totalAccounts: number;
  recentActivity: Array<{
    id: string;
    action: string;
    fromAddress: string;
    subject: string;
    folder: string | null;
    performedAt: string;
    account: { email: string; provider: string };
  }>;
}

const PROVIDERS = [
  { value: "GMAIL", label: "Gmail", help: "Use an App Password (enable 2FA first)" },
  { value: "OUTLOOK", label: "Outlook", help: "Use your account password or App Password" },
  { value: "YAHOO", label: "Yahoo", help: "Use an App Password from Yahoo security settings" },
  { value: "AOL", label: "AOL", help: "Use an App Password from AOL security settings" },
  { value: "CPANEL", label: "cPanel", help: "Enter your IMAP server details" },
];

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  OPENED: { label: "Opened", color: "bg-blue-500/10 text-blue-600" },
  MOVED_TO_INBOX: { label: "Moved to Inbox", color: "bg-green-500/10 text-green-600" },
  MARKED_NOT_SPAM: { label: "Not Spam", color: "bg-emerald-500/10 text-emerald-600" },
  REPLIED: { label: "Replied", color: "bg-purple-500/10 text-purple-600" },
  STARRED: { label: "Starred", color: "bg-yellow-500/10 text-yellow-600" },
};

export default function EngagementPage() {
  const [accounts, setAccounts] = useState<WebmailAccount[]>([]);
  const [engagementData, setEngagementData] = useState<EngagementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Form state
  const [provider, setProvider] = useState("GMAIL");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("");
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [accountsRes, statsRes] = await Promise.all([
      fetch("/api/webmail"),
      fetch("/api/webmail/engagement-stats"),
    ]);

    if (accountsRes.status === 401) {
      window.location.href = "/login";
      return;
    }

    setAccounts(await accountsRes.json());
    setEngagementData(await statsRes.json());
    setLoading(false);
  }

  async function handleAdd() {
    setAdding(true);
    const body: Record<string, unknown> = {
      email,
      provider,
      imapPassword: password,
    };

    if (provider === "CPANEL") {
      body.imapHost = imapHost;
      body.imapPort = imapPort ? parseInt(imapPort) : undefined;
      body.smtpHost = smtpHost || undefined;
      body.smtpPort = smtpPort ? parseInt(smtpPort) : undefined;
    }

    const res = await fetch("/api/webmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setEmail("");
      setPassword("");
      setImapHost("");
      setImapPort("");
      setSmtpHost("");
      setSmtpPort("");
      setShowAdd(false);
      await fetchData();
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/webmail/${id}`, { method: "DELETE" });
    fetchData();
  }

  async function handleTest(id: string) {
    setTesting(id);
    setTestResult(null);
    const res = await fetch(`/api/webmail/${id}/test`, { method: "POST" });
    const data = await res.json();
    setTestResult({ id, success: data.success, message: data.message || data.error });
    setTesting(null);
  }

  async function handleToggle(id: string, isActive: boolean) {
    await fetch(`/api/webmail/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !isActive }),
    });
    fetchData();
  }

  const selectedProvider = PROVIDERS.find((p) => p.value === provider);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Webmail Engagement"
        description="Automatically engage with warming emails across webmail accounts"
        actions={
          <Button onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        }
      />

      {/* Stats Cards */}
      {engagementData && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <span className="text-sm text-muted-foreground">Emails Opened</span>
              </div>
              <p className="text-2xl font-bold mt-1">{engagementData.stats.opened}</p>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-green-500" />
                <span className="text-sm text-muted-foreground">Moved from Spam</span>
              </div>
              <p className="text-2xl font-bold mt-1">{engagementData.stats.movedToInbox}</p>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-purple-500" />
                <span className="text-sm text-muted-foreground">Replies Sent</span>
              </div>
              <p className="text-2xl font-bold mt-1">{engagementData.stats.replied}</p>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Active Accounts</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {engagementData.activeAccounts}/{engagementData.totalAccounts}
              </p>
              <p className="text-xs text-muted-foreground">Connected</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Account Form */}
      {showAdd && (
        <Card>
          <CardHeader>
            <CardTitle>Add Webmail Account</CardTitle>
            <CardDescription>
              Connect a webmail account to automatically engage with warming emails.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              {selectedProvider && (
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedProvider.help}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Email Address</label>
              <Input
                type="email"
                placeholder="user@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">
                {provider === "GMAIL" || provider === "YAHOO" || provider === "AOL"
                  ? "App Password"
                  : "Password"}
              </label>
              <Input
                type="password"
                placeholder="Enter password or app password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {provider === "CPANEL" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">IMAP Host</label>
                    <Input
                      placeholder="mail.example.com"
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">IMAP Port</label>
                    <Input
                      type="number"
                      placeholder="993"
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">SMTP Host (optional)</label>
                    <Input
                      placeholder="mail.example.com"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">SMTP Port</label>
                    <Input
                      type="number"
                      placeholder="587"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            <Button
              onClick={handleAdd}
              disabled={adding || !email || !password || (provider === "CPANEL" && !imapHost)}
            >
              {adding ? "Adding..." : "Add Account"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Webmail Accounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Email</th>
                  <th className="text-left p-4 font-medium">Provider</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Last Checked</th>
                  <th className="text-left p-4 font-medium">Engagements</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b hover:bg-muted/30">
                    <td className="p-4 font-mono text-sm">{account.email}</td>
                    <td className="p-4">
                      <Badge variant="outline">{account.provider}</Badge>
                    </td>
                    <td className="p-4">
                      {account.isActive ? (
                        account.lastError ? (
                          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                            <WifiOff className="h-3 w-3 mr-1" />
                            Error ({account.consecutiveErrors})
                          </Badge>
                        ) : (
                          <Badge className="bg-green-500/10 text-green-600 border-green-200">
                            <Wifi className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )
                      ) : (
                        <Badge variant="secondary">Disabled</Badge>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {account.lastCheckedAt
                        ? new Date(account.lastCheckedAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="p-4">{account._count.engagementLogs}</td>
                    <td className="p-4 text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTest(account.id)}
                        disabled={testing === account.id}
                      >
                        {testing === account.id ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          "Test"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(account.id, account.isActive)}
                      >
                        {account.isActive ? "Disable" : "Enable"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      No webmail accounts configured. Add accounts to start automated engagement.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {testResult && (
            <div
              className={`mx-4 mb-4 p-3 rounded-lg text-sm ${
                testResult.success
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {testResult.success ? "Connection successful!" : `Connection failed: ${testResult.message}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      {engagementData && engagementData.recentActivity.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Last 50 engagement actions</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Time</th>
                    <th className="text-left p-3 font-medium">Account</th>
                    <th className="text-left p-3 font-medium">Action</th>
                    <th className="text-left p-3 font-medium">Subject</th>
                  </tr>
                </thead>
                <tbody>
                  {engagementData.recentActivity.map((activity) => {
                    const actionInfo = ACTION_LABELS[activity.action] || {
                      label: activity.action,
                      color: "bg-gray-500/10 text-gray-600",
                    };
                    return (
                      <tr key={activity.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 text-muted-foreground whitespace-nowrap">
                          {new Date(activity.performedAt).toLocaleString()}
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {activity.account.email}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${actionInfo.color}`}
                          >
                            {actionInfo.label}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate">{activity.subject}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
