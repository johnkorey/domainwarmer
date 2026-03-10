"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { WarmingStatusBadge, DomainStatusBadge } from "@/components/domains/status-badge";
import { WarmthIndicator } from "@/components/domains/warmth-indicator";
import { Plus, Check, X, Trash2, Clock } from "lucide-react";

function getNextSendTime(domain: DomainData): string | null {
  if (domain.warmingStatus !== "WARMING") return null;
  if (domain.sentToday >= domain.dailyTarget) return "Done for today";

  const now = new Date();
  const utcHour = now.getUTCHours();

  if (utcHour < 6) {
    const next = new Date(now);
    next.setUTCHours(6, 0, 0, 0);
    return next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (utcHour >= 22) {
    return "Tomorrow 6:00 UTC";
  }

  const mins = now.getUTCMinutes();
  const nextWindow = Math.ceil((mins + 1) / 10) * 10;
  const next = new Date(now);
  if (nextWindow >= 60) {
    next.setUTCHours(utcHour + 1, 0, 0, 0);
  } else {
    next.setUTCMinutes(nextWindow, 0, 0);
  }
  return next.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

interface DomainData {
  id: string;
  domain: string;
  status: "PENDING" | "VERIFYING" | "ACTIVE" | "ERROR";
  warmingStatus: "NOT_STARTED" | "WARMING" | "READY" | "PAUSED" | "ISSUES";
  warmingSchedule: string;
  reputationScore: number;
  currentDay: number;
  dailyTarget: number;
  sentToday: number;
  spfValid: boolean;
  dkimValid: boolean;
  dmarcValid: boolean;
  mxValid: boolean;
  createdAt: string;
}

export default function DomainsPage() {
  const [domains, setDomains] = useState<DomainData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, []);

  async function fetchDomains() {
    const res = await fetch("/api/domains");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setDomains(data);
    setLoading(false);
  }

  async function deleteDomain(id: string, name: string) {
    if (!confirm(`Delete domain "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/domains/${id}`, { method: "DELETE" });
    fetchDomains();
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
        title="Domains"
        description={`${domains.length} domain${domains.length !== 1 ? "s" : ""} registered`}
        actions={
          <Link href="/dashboard/domains/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Domain
            </Button>
          </Link>
        }
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">Domain</th>
                  <th className="text-left p-4 font-medium">Status</th>
                  <th className="text-left p-4 font-medium">Warming</th>
                  <th className="text-center p-4 font-medium">SPF</th>
                  <th className="text-center p-4 font-medium">DKIM</th>
                  <th className="text-center p-4 font-medium">MX</th>
                  <th className="text-left p-4 font-medium">Progress</th>
                  <th className="text-left p-4 font-medium">Next Send</th>
                  <th className="text-center p-4 font-medium">Score</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {domains.map((domain) => (
                  <tr key={domain.id} className="border-b hover:bg-muted/30">
                    <td className="p-4">
                      <Link
                        href={`/dashboard/domains/${domain.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {domain.domain}
                      </Link>
                    </td>
                    <td className="p-4">
                      <DomainStatusBadge status={domain.status} />
                    </td>
                    <td className="p-4">
                      <WarmingStatusBadge status={domain.warmingStatus} />
                    </td>
                    <td className="p-4 text-center">
                      {domain.spfValid ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {domain.dkimValid ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {domain.mxValid ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <X className="h-4 w-4 text-red-500 mx-auto" />
                      )}
                    </td>
                    <td className="p-4">
                      {domain.warmingStatus === "WARMING" ? (
                        <div className="space-y-1 min-w-[120px]">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Day {domain.currentDay}</span>
                            <span>{domain.sentToday}/{domain.dailyTarget}</span>
                          </div>
                          <Progress value={domain.sentToday} max={domain.dailyTarget || 1} />
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      {getNextSendTime(domain) ? (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{getNextSendTime(domain)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex justify-center">
                        <WarmthIndicator score={domain.reputationScore} size="sm" showLabel={false} />
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteDomain(domain.id, domain.domain)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {domains.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-muted-foreground">
                      No domains added yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
