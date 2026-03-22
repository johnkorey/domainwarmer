"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WarmthIndicator } from "@/components/domains/warmth-indicator";
import { WarmingStatusBadge } from "@/components/domains/status-badge";
import { Button } from "@/components/ui/button";
import { Mail, Flame, TrendingUp, Plus } from "lucide-react";

interface AccountData {
  id: string;
  email: string;
  provider: string;
  isWarmingAccount: boolean;
  warmingStatus: "NOT_STARTED" | "WARMING" | "READY" | "PAUSED" | "ISSUES";
  reputationScore: number;
  currentDay: number;
  dailyTarget: number;
  sentToday: number;
  isActive: boolean;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/webmail")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return [];
        }
        return res.json();
      })
      .then(setAccounts)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const warmingAccounts = accounts.filter((a) => a.isWarmingAccount);
  const engagementAccounts = accounts.filter((a) => !a.isWarmingAccount);
  const activelyWarming = warmingAccounts.filter((a) => a.warmingStatus === "WARMING").length;
  const readyAccounts = warmingAccounts.filter((a) => a.warmingStatus === "READY").length;
  const avgReputation =
    warmingAccounts.length > 0
      ? Math.round(
          warmingAccounts.reduce((sum, a) => sum + a.reputationScore, 0) / warmingAccounts.length
        )
      : 0;
  const totalSentToday = warmingAccounts.reduce((sum, a) => sum + a.sentToday, 0);

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
        title="Dashboard"
        description="Overview of your email warming campaigns"
        actions={
          <Link href="/dashboard/accounts/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Accounts</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">
              {warmingAccounts.length} warming, {engagementAccounts.length} engagement
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Actively Warming</CardTitle>
            <Flame className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activelyWarming}</div>
            <p className="text-xs text-muted-foreground">
              {readyAccounts} ready
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sent Today</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSentToday}</div>
            <p className="text-xs text-muted-foreground">warming emails</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Reputation</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgReputation}/100</div>
            <p className="text-xs text-muted-foreground">across warming accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Warming Accounts */}
      {warmingAccounts.length === 0 && engagementAccounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No accounts yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first email account to start warming
            </p>
            <Link href="/dashboard/accounts/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {warmingAccounts.map((account) => (
            <Link key={account.id} href={`/dashboard/accounts/${account.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate">{account.email}</CardTitle>
                    <WarmingStatusBadge status={account.warmingStatus} />
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">{account.provider}</Badge>
                    <Badge variant="secondary" className="text-xs">Warming</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1 mr-4">
                      {account.warmingStatus === "WARMING" && (
                        <>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Day {account.currentDay}</span>
                            <span>
                              {account.sentToday}/{account.dailyTarget} today
                            </span>
                          </div>
                          <Progress
                            value={account.sentToday}
                            max={account.dailyTarget || 1}
                          />
                        </>
                      )}
                      {account.warmingStatus === "READY" && (
                        <p className="text-sm text-emerald-600 font-medium">
                          Warming complete
                        </p>
                      )}
                      {account.warmingStatus === "NOT_STARTED" && (
                        <p className="text-sm text-muted-foreground">
                          Warming not started
                        </p>
                      )}
                    </div>
                    <WarmthIndicator score={account.reputationScore} size="sm" showLabel={false} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
          {engagementAccounts.map((account) => (
            <Link key={account.id} href={`/dashboard/accounts/${account.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base truncate">{account.email}</CardTitle>
                    <Badge variant={account.isActive ? "success" : "outline"}>
                      {account.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-xs">{account.provider}</Badge>
                    <Badge variant="secondary" className="text-xs">Engagement</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Engagement-only account
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
