"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { WarmthIndicator } from "@/components/domains/warmth-indicator";
import { WarmingStatusBadge } from "@/components/domains/status-badge";
import {
  ArrowLeft,
  Pause,
  RotateCcw,
  RefreshCw,
  Mail,
  TrendingUp,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
} from "lucide-react";
import Link from "next/link";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DomainAnalysis {
  domain: string;
  score: number;
  checks: {
    mx: { found: boolean; records: string[] };
    spf: { found: boolean; record: string | null };
    dmarc: { found: boolean; record: string | null };
    website: { reachable: boolean };
  };
  recommendations: string[];
  summary: string;
}

interface AccountDetail {
  id: string;
  email: string;
  provider: string;
  isWarmingAccount: boolean;
  warmingStatus: "NOT_STARTED" | "WARMING" | "READY" | "PAUSED" | "ISSUES";
  warmingSchedule: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
  reputationScore: number;
  currentDay: number;
  dailyTarget: number;
  sentToday: number;
  isActive: boolean;
  businessSummary: string | null;
  initialAnalysis: string | null;
  warmingStartedAt: string | null;
  smtpHost: string | null;
  dailyStats: Array<{
    date: string;
    sent: number;
    delivered: number;
    opened: number;
    bounced: number;
    complained: number;
  }>;
  _count: {
    emailLogs: number;
    seedAddresses: number;
    generatedContent: number;
    engagementLogs: number;
  };
}

interface EmailLog {
  id: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  status: string;
  isReply: boolean;
  sentAt: string;
  deliveredAt: string | null;
  openedAt: string | null;
  bouncedAt: string | null;
  complainedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
}

interface EmailLogResponse {
  emails: EmailLog[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  QUEUED: { label: "Queued", color: "bg-gray-500/10 text-gray-600" },
  SENT: { label: "Sent", color: "bg-blue-500/10 text-blue-600" },
  DELIVERED: { label: "Delivered", color: "bg-green-500/10 text-green-600" },
  OPENED: { label: "Opened", color: "bg-purple-500/10 text-purple-600" },
  BOUNCED: { label: "Bounced", color: "bg-red-500/10 text-red-600" },
  COMPLAINED: { label: "Complained", color: "bg-orange-500/10 text-orange-600" },
  FAILED: { label: "Failed", color: "bg-red-500/10 text-red-600" },
};

function getNextSendTime(account: AccountDetail): string | null {
  if (account.warmingStatus !== "WARMING") return null;
  if (account.sentToday >= account.dailyTarget) return "Daily target reached";

  const now = new Date();
  const utcHour = now.getUTCHours();

  if (utcHour < 6) {
    const next = new Date(now);
    next.setUTCHours(6, 0, 0, 0);
    return next.toLocaleString();
  }
  if (utcHour >= 22) {
    const next = new Date(now);
    next.setUTCDate(next.getUTCDate() + 1);
    next.setUTCHours(6, 0, 0, 0);
    return next.toLocaleString();
  }

  const mins = now.getUTCMinutes();
  const nextWindow = Math.ceil((mins + 1) / 10) * 10;
  const next = new Date(now);
  if (nextWindow >= 60) {
    next.setUTCHours(utcHour + 1, 0, 0, 0);
  } else {
    next.setUTCMinutes(nextWindow, 0, 0);
  }
  return next.toLocaleString();
}

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const accountId = params.accountId as string;
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [emailData, setEmailData] = useState<EmailLogResponse | null>(null);
  const [emailPage, setEmailPage] = useState(1);
  const [emailFilter, setEmailFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState("");

  const fetchAccount = useCallback(async () => {
    const res = await fetch(`/api/webmail/${accountId}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.status === 404) {
      router.push("/dashboard");
      return;
    }
    const data = await res.json();
    setAccount(data);
    setLoading(false);
  }, [accountId, router]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  async function handleWarmingAction(action: "start" | "pause" | "resume") {
    setActionLoading(true);
    await fetch(`/api/webmail/${accountId}/warming/${action}`, { method: "POST" });
    await fetchAccount();
    setActionLoading(false);
  }

  async function handleScheduleChange(schedule: string) {
    await fetch(`/api/webmail/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warmingSchedule: schedule }),
    });
    await fetchAccount();
  }

  async function handleInitialize() {
    setInitLoading(true);
    setInitError("");
    try {
      const res = await fetch(`/api/webmail/${accountId}/initialize`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setInitError(data.error || "Initialization failed");
      } else {
        const data = await res.json();
        setAccount(data);
      }
    } catch {
      setInitError("Network error");
    } finally {
      setInitLoading(false);
    }
  }

  const fetchEmails = useCallback(async (page = 1, status = "") => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (status) params.set("status", status);
    const res = await fetch(`/api/webmail/${accountId}/emails?${params}`);
    if (res.ok) {
      setEmailData(await res.json());
    }
  }, [accountId]);

  if (loading || !account) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const chartData = [...(account.dailyStats || [])]
    .reverse()
    .map((s) => ({
      date: new Date(s.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      sent: s.sent,
      delivered: s.delivered,
      opened: s.opened,
      bounced: s.bounced,
      complained: s.complained,
    }));

  return (
    <>
      <PageHeader
        title={account.email}
        description={account.businessSummary || `${account.provider} email account`}
        actions={
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        }
      />

      <Tabs defaultValue="overview" onValueChange={(v) => { if (v === "emails") fetchEmails(1, emailFilter); }}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {account.isWarmingAccount && <TabsTrigger value="emails">Emails</TabsTrigger>}
          {account.isWarmingAccount && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          {initError && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive mb-4">
              {initError}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Reputation */}
            {account.isWarmingAccount && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Reputation Score</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  <WarmthIndicator score={account.reputationScore} size="lg" />
                </CardContent>
              </Card>
            )}

            {/* Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  {account.isWarmingAccount ? "Warming Status" : "Account Status"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  {account.isWarmingAccount ? (
                    <WarmingStatusBadge status={account.warmingStatus} />
                  ) : (
                    <Badge variant={account.isActive ? "success" : "outline"}>
                      {account.isActive ? "Active" : "Inactive"}
                    </Badge>
                  )}
                  <Badge variant="outline">{account.provider}</Badge>
                </div>

                {account.isWarmingAccount && account.warmingStatus === "NOT_STARTED" && !account.initialAnalysis && (
                  <div className="space-y-2">
                    <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-700">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      Account not initialized — AI analysis and content generation required.
                    </div>
                    <Button size="sm" onClick={handleInitialize} disabled={initLoading}>
                      <RefreshCw className={`h-4 w-4 mr-1 ${initLoading ? "animate-spin" : ""}`} />
                      {initLoading ? "Initializing..." : "Initialize Now"}
                    </Button>
                  </div>
                )}

                {account.isWarmingAccount && account.warmingStatus === "WARMING" && !account.initialAnalysis && (
                  <div className="space-y-2">
                    <div className="rounded-md bg-yellow-500/10 border border-yellow-500/20 p-3 text-sm text-yellow-700">
                      <AlertTriangle className="h-4 w-4 inline mr-1" />
                      Missing AI analysis — account is warming but was never analyzed. Click below to run domain analysis and generate content.
                    </div>
                    <Button size="sm" onClick={handleInitialize} disabled={initLoading}>
                      <RefreshCw className={`h-4 w-4 mr-1 ${initLoading ? "animate-spin" : ""}`} />
                      {initLoading ? "Analyzing..." : "Analyze & Initialize"}
                    </Button>
                  </div>
                )}

                {account.isWarmingAccount && account.warmingStatus === "WARMING" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Day {account.currentDay}</span>
                      <span>{account.sentToday}/{account.dailyTarget} sent today</span>
                    </div>
                    <Progress value={account.sentToday} max={account.dailyTarget || 1} />
                  </div>
                )}

                {account.isWarmingAccount && account.warmingStatus === "READY" && (
                  <div className="rounded-md bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600">
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    Ready for full cold email outreach
                  </div>
                )}

                {account.isWarmingAccount && (
                  <div className="flex gap-2">
                    {account.warmingStatus === "WARMING" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleWarmingAction("pause")}
                        disabled={actionLoading}
                      >
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    )}
                    {(account.warmingStatus === "PAUSED" || account.warmingStatus === "ISSUES") && (
                      <Button
                        size="sm"
                        onClick={() => handleWarmingAction("resume")}
                        disabled={actionLoading}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Resume
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Quick Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    Total Emails
                  </span>
                  <span className="font-medium">{account._count.emailLogs}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    Engagement Logs
                  </span>
                  <span className="font-medium">{account._count.engagementLogs}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Content Pool
                  </span>
                  <span className="font-medium">{account._count.generatedContent}</span>
                </div>
                {account.warmingStartedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-medium">
                      {new Date(account.warmingStartedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {getNextSendTime(account) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Next Send
                    </span>
                    <span className="font-medium text-xs">
                      {getNextSendTime(account)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Domain Analysis Card */}
          {account.isWarmingAccount && account.initialAnalysis && (() => {
            let analysis: DomainAnalysis | null = null;
            try { analysis = JSON.parse(account.initialAnalysis); } catch { /* ignore */ }
            if (!analysis) return null;

            return (
              <Card className="mt-4">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium">
                    <Shield className="h-4 w-4" />
                    Domain Analysis — {analysis.domain}
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleInitialize}
                    disabled={initLoading}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${initLoading ? "animate-spin" : ""}`} />
                    Re-analyze
                  </Button>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* AI Summary */}
                  <p className="text-sm text-muted-foreground">{analysis.summary}</p>

                  {/* DNS Checks */}
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      {analysis.checks.mx.found ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">MX Records</p>
                        <p className="text-xs text-muted-foreground">
                          {analysis.checks.mx.found
                            ? analysis.checks.mx.records.slice(0, 2).join(", ")
                            : "Not configured"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      {analysis.checks.spf.found ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">SPF Record</p>
                        <p className="text-xs text-muted-foreground">
                          {analysis.checks.spf.found ? "Configured" : "Not configured"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      {analysis.checks.dmarc.found ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">DMARC</p>
                        <p className="text-xs text-muted-foreground">
                          {analysis.checks.dmarc.found ? "Configured" : "Not configured"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 rounded-lg border p-3">
                      {analysis.checks.website.reachable ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
                      )}
                      <div>
                        <p className="text-sm font-medium">Website</p>
                        <p className="text-xs text-muted-foreground">
                          {analysis.checks.website.reachable ? "Reachable" : "Not reachable"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Recommendations */}
                  {analysis.recommendations.length > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <p className="text-sm font-medium text-yellow-800 mb-1">Recommendations</p>
                      <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                        {analysis.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* EMAILS TAB */}
        <TabsContent value="emails">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Email Log</CardTitle>
                {emailData && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {emailData.total} total emails
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={emailFilter}
                  onChange={(e) => {
                    setEmailFilter(e.target.value);
                    setEmailPage(1);
                    fetchEmails(1, e.target.value);
                  }}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All Statuses</option>
                  <option value="SENT">Sent</option>
                  <option value="DELIVERED">Delivered</option>
                  <option value="OPENED">Opened</option>
                  <option value="BOUNCED">Bounced</option>
                  <option value="FAILED">Failed</option>
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchEmails(emailPage, emailFilter)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {account.warmingStatus === "WARMING" && (
                <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                  <Clock className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>Next batch:</strong> {getNextSendTime(account) || "—"}
                    {" · "}
                    <strong>{account.dailyTarget - account.sentToday}</strong> remaining today
                  </span>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">From</th>
                      <th className="text-left p-3 font-medium">To</th>
                      <th className="text-left p-3 font-medium">Subject</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Sent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emailData?.emails.map((email) => {
                      const statusInfo = STATUS_CONFIG[email.status] || STATUS_CONFIG.SENT;
                      return (
                        <tr key={email.id} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-mono text-xs max-w-[180px] truncate">
                            {email.isReply && (
                              <Badge variant="outline" className="mr-1 text-[10px] px-1 py-0">Reply</Badge>
                            )}
                            {email.fromAddress}
                          </td>
                          <td className="p-3 font-mono text-xs max-w-[180px] truncate">
                            {email.toAddress}
                          </td>
                          <td className="p-3 max-w-[200px] truncate" title={email.subject}>
                            {email.subject}
                          </td>
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(email.sentAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {(!emailData || emailData.emails.length === 0) && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          No emails sent yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {emailData && emailData.totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    Page {emailData.page} of {emailData.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={emailData.page <= 1}
                      onClick={() => {
                        const p = emailPage - 1;
                        setEmailPage(p);
                        fetchEmails(p, emailFilter);
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={emailData.page >= emailData.totalPages}
                      onClick={() => {
                        const p = emailPage + 1;
                        setEmailPage(p);
                        fetchEmails(p, emailFilter);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Volume Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} name="Sent" />
                      <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} name="Delivered" />
                      <Line type="monotone" dataKey="opened" stroke="#a855f7" strokeWidth={2} name="Opened" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No data yet. Stats will appear after warming begins.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Deliverability Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="delivered" fill="#22c55e" name="Delivered" stackId="a" />
                      <Bar dataKey="bounced" fill="#ef4444" name="Bounced" stackId="a" />
                      <Bar dataKey="complained" fill="#f59e0b" name="Complained" stackId="a" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-center text-muted-foreground py-8">No data yet.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Account Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {account.isWarmingAccount && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Warming Schedule</label>
                  <Select
                    value={account.warmingSchedule}
                    onChange={(e) => handleScheduleChange(e.target.value)}
                  >
                    <option value="CONSERVATIVE">Conservative (30 days)</option>
                    <option value="MODERATE">Moderate (21 days)</option>
                    <option value="AGGRESSIVE">Aggressive (14 days)</option>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Conservative: slower ramp, safer. Aggressive: faster but higher risk.
                  </p>
                </div>
              )}

              {account.businessSummary && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">AI Business Summary</label>
                  <p className="text-sm text-muted-foreground rounded-lg border p-3">
                    {account.businessSummary}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
