"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { WarmthIndicator } from "@/components/domains/warmth-indicator";
import { WarmingStatusBadge, DomainStatusBadge } from "@/components/domains/status-badge";
import { Button } from "@/components/ui/button";
import { Globe, Mail, Flame, TrendingUp, Plus } from "lucide-react";

interface DomainData {
  id: string;
  domain: string;
  status: "PENDING" | "VERIFYING" | "ACTIVE" | "ERROR";
  warmingStatus: "NOT_STARTED" | "WARMING" | "READY" | "PAUSED" | "ISSUES";
  reputationScore: number;
  currentDay: number;
  dailyTarget: number;
  sentToday: number;
  spfValid: boolean;
  dkimValid: boolean;
  warmingSchedule: string;
}

export default function DashboardPage() {
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/domains")
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return [];
        }
        return res.json();
      })
      .then(setDomains)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalDomains = domains.length;
  const activelyWarming = domains.filter((d) => d.warmingStatus === "WARMING").length;
  const readyDomains = domains.filter((d) => d.warmingStatus === "READY").length;
  const avgReputation =
    domains.length > 0
      ? Math.round(
          domains.reduce((sum, d) => sum + d.reputationScore, 0) / domains.length
        )
      : 0;
  const totalSentToday = domains.reduce((sum, d) => sum + d.sentToday, 0);

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
        description="Overview of your domain warming campaigns"
        actions={
          <Link href="/dashboard/domains/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Domain
            </Button>
          </Link>
        }
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Domains</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalDomains}</div>
            <p className="text-xs text-muted-foreground">
              {readyDomains} ready for campaigns
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
            <p className="text-xs text-muted-foreground">domains in progress</p>
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
            <p className="text-xs text-muted-foreground">across all domains</p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Grid */}
      {domains.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No domains yet</h3>
            <p className="text-muted-foreground mb-4">
              Add your first domain to start warming
            </p>
            <Link href="/dashboard/domains/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Domain
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {domains.map((domain) => (
            <Link key={domain.id} href={`/dashboard/domains/${domain.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{domain.domain}</CardTitle>
                    <WarmingStatusBadge status={domain.warmingStatus} />
                  </div>
                  <div className="flex gap-2">
                    <DomainStatusBadge status={domain.status} />
                    <Badge variant={domain.spfValid && domain.dkimValid ? "success" : "outline"} className="text-xs">
                      DNS {domain.spfValid && domain.dkimValid ? "OK" : "Pending"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1 mr-4">
                      {domain.warmingStatus === "WARMING" && (
                        <>
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Day {domain.currentDay}</span>
                            <span>
                              {domain.sentToday}/{domain.dailyTarget} today
                            </span>
                          </div>
                          <Progress
                            value={domain.sentToday}
                            max={domain.dailyTarget || 1}
                          />
                        </>
                      )}
                      {domain.warmingStatus === "READY" && (
                        <p className="text-sm text-emerald-600 font-medium">
                          Ready for campaigns
                        </p>
                      )}
                      {domain.warmingStatus === "NOT_STARTED" && (
                        <p className="text-sm text-muted-foreground">
                          Warming not started
                        </p>
                      )}
                    </div>
                    <WarmthIndicator score={domain.reputationScore} size="sm" showLabel={false} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
