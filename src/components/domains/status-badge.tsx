import { Badge } from "@/components/ui/badge";

type WarmingStatus = "NOT_STARTED" | "WARMING" | "READY" | "PAUSED" | "ISSUES";

const warmingVariants: Record<WarmingStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" }> = {
  NOT_STARTED: { label: "Not Started", variant: "secondary" },
  WARMING: { label: "Warming", variant: "warning" },
  READY: { label: "Ready", variant: "success" },
  PAUSED: { label: "Paused", variant: "outline" },
  ISSUES: { label: "Issues", variant: "destructive" },
};

export function WarmingStatusBadge({ status }: { status: WarmingStatus }) {
  const config = warmingVariants[status] || warmingVariants.NOT_STARTED;
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
