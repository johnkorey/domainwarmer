"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WarmthIndicator } from "@/components/domains/warmth-indicator";
import { WarmingStatusBadge } from "@/components/domains/status-badge";
import { Plus, RefreshCw, AlertTriangle, ExternalLink } from "lucide-react";

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
  initialAnalysis: string | null;
  businessSummary: string | null;
  lastError: string | null;
  _count: { emailLogs: number; engagementLogs: number };
}

export default function AccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initializingId, setInitializingId] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  async function fetchAccounts() {
    try {
      const res = await fetch("/api/webmail");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleInitialize(accountId: string) {
    setInitializingId(accountId);
    setInitError(null);
    try {
      const res = await fetch(`/api/webmail/${accountId}/initialize`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setInitError(data.error || "Initialization failed");
      } else {
        await fetchAccounts();
      }
    } catch {
      setInitError("Network error");
    } finally {
      setInitializingId(null);
    }
  }

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
        title="Accounts"
        description="Manage your warming and engagement email accounts"
        actions={
          <Button onClick={() => router.push("/dashboard/accounts/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Account
          </Button>
        }
      />

      {initError && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
          {initError}
        </div>
      )}

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold">No accounts yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first email account to start warming
            </p>
            <Button onClick={() => router.push("/dashboard/accounts/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Add Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Accounts ({accounts.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Email</th>
                    <th className="text-left p-3 font-medium">Provider</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Reputation</th>
                    <th className="text-left p-3 font-medium">Progress</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => {
                    const needsInit = account.isWarmingAccount && !account.initialAnalysis;
                    return (
                      <tr key={account.id} className="border-b hover:bg-muted/30">
                        <td className="p-3">
                          <Link
                            href={`/dashboard/accounts/${account.id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {account.email}
                          </Link>
                          {account.lastError && (
                            <p className="text-xs text-destructive mt-0.5 truncate max-w-[250px]" title={account.lastError}>
                              <AlertTriangle className="h-3 w-3 inline mr-1" />
                              {account.lastError}
                            </p>
                          )}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline">{account.provider}</Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary">
                            {account.isWarmingAccount ? "Warming" : "Engagement"}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {account.isWarmingAccount ? (
                            <WarmingStatusBadge status={account.warmingStatus} />
                          ) : (
                            <Badge variant={account.isActive ? "success" : "outline"}>
                              {account.isActive ? "Active" : "Inactive"}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {account.isWarmingAccount ? (
                            <WarmthIndicator score={account.reputationScore} size="sm" showLabel={false} />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-xs text-muted-foreground">
                          {account.isWarmingAccount && account.warmingStatus === "WARMING" ? (
                            <span>Day {account.currentDay} · {account.sentToday}/{account.dailyTarget} today</span>
                          ) : account.isWarmingAccount && account.warmingStatus === "READY" ? (
                            <span className="text-emerald-600">Complete</span>
                          ) : null}
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            {needsInit && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleInitialize(account.id)}
                                disabled={initializingId === account.id}
                              >
                                <RefreshCw className={`h-3 w-3 mr-1 ${initializingId === account.id ? "animate-spin" : ""}`} />
                                {initializingId === account.id ? "Initializing..." : "Initialize"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/dashboard/accounts/${account.id}`)}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View
                            </Button>
                          </div>
                        </td>
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
