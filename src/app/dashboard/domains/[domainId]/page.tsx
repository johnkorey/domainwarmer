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
import { WarmingStatusBadge, DomainStatusBadge } from "@/components/domains/status-badge";
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  RefreshCw,
  Mail,
  TrendingUp,
  Calendar,
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

interface DomainDetail {
  id: string;
  domain: string;
  status: "PENDING" | "VERIFYING" | "ACTIVE" | "ERROR";
  warmingStatus: "NOT_STARTED" | "WARMING" | "READY" | "PAUSED" | "ISSUES";
  warmingSchedule: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE";
  reputationScore: number;
  currentDay: number;
  dailyTarget: number;
  sentToday: number;
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;
  mxValid: boolean;
  isVerified: boolean;
  businessSummary: string | null;
  warmingStartedAt: string | null;
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
}

export default function DomainDetailPage() {
  const params = useParams();
  const router = useRouter();
  const domainId = params.domainId as string;
  const [domain, setDomain] = useState<DomainDetail | null>(null);
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDomain = useCallback(async () => {
    const res = await fetch(`/api/domains/${domainId}`);
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.status === 404) {
      router.push("/dashboard/domains");
      return;
    }
    const data = await res.json();
    setDomain(data);
    setLoading(false);
  }, [domainId, router]);

  useEffect(() => {
    fetchDomain();
  }, [fetchDomain]);

  async function handleWarmingAction(action: "start" | "pause" | "resume") {
    setActionLoading(true);
    await fetch(`/api/domains/${domainId}/warming/${action}`, { method: "POST" });
    await fetchDomain();
    setActionLoading(false);
  }

  async function handleVerify() {
    setActionLoading(true);
    await fetch(`/api/domains/${domainId}/verify`, { method: "POST" });
    await fetchDomain();
    setActionLoading(false);
  }

  async function handleScheduleChange(schedule: string) {
    await fetch(`/api/domains/${domainId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warmingSchedule: schedule }),
    });
    await fetchDomain();
  }

  async function fetchEmails() {
    const res = await fetch(`/api/domains/${domainId}/stats`);
    if (res.ok) {
      // We don't have a separate email log endpoint, stats are in domain data
    }
  }

  if (loading || !domain) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const chartData = [...(domain.dailyStats || [])]
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
        title={domain.domain}
        description={domain.businessSummary || "Domain warming campaign"}
        actions={
          <Link href="/dashboard/domains">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="dns">DNS</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview">
          <div className="grid gap-4 md:grid-cols-3">
            {/* Reputation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Reputation Score</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-center">
                <WarmthIndicator score={domain.reputationScore} size="lg" />
              </CardContent>
            </Card>

            {/* Warming Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">Warming Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <WarmingStatusBadge status={domain.warmingStatus} />
                  <DomainStatusBadge status={domain.status} />
                </div>

                {domain.warmingStatus === "WARMING" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Day {domain.currentDay}</span>
                      <span>{domain.sentToday}/{domain.dailyTarget} sent today</span>
                    </div>
                    <Progress value={domain.sentToday} max={domain.dailyTarget || 1} />
                  </div>
                )}

                <div className="flex gap-2">
                  {domain.warmingStatus === "NOT_STARTED" && domain.isVerified && (
                    <Button
                      size="sm"
                      onClick={() => handleWarmingAction("start")}
                      disabled={actionLoading}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Start Warming
                    </Button>
                  )}
                  {domain.warmingStatus === "WARMING" && (
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
                  {(domain.warmingStatus === "PAUSED" || domain.warmingStatus === "ISSUES") && (
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
                  <span className="font-medium">{domain._count.emailLogs}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    Seed Addresses
                  </span>
                  <span className="font-medium">{domain._count.seedAddresses}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Content Pool
                  </span>
                  <span className="font-medium">{domain._count.generatedContent}</span>
                </div>
                {domain.warmingStartedAt && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-medium">
                      {new Date(domain.warmingStartedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
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
                  <p className="text-center text-muted-foreground py-8">
                    No data yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* DNS TAB */}
        <TabsContent value="dns">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>DNS Health</CardTitle>
              <Button variant="outline" size="sm" onClick={handleVerify} disabled={actionLoading}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Re-check
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { name: "SPF", valid: domain.spfValid },
                  { name: "DKIM", valid: domain.dkimValid },
                  { name: "DMARC", valid: domain.dmarcValid },
                  { name: "MX", valid: domain.mxValid },
                ].map((record) => (
                  <div
                    key={record.name}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      {record.valid ? (
                        <Check className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <X className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">{record.name}</span>
                    </div>
                    <Badge variant={record.valid ? "success" : "destructive"}>
                      {record.valid ? "Verified" : "Not Verified"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Warming Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Warming Schedule</label>
                <Select
                  value={domain.warmingSchedule}
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

              {domain.businessSummary && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">AI Business Summary</label>
                  <p className="text-sm text-muted-foreground rounded-lg border p-3">
                    {domain.businessSummary}
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
