"use client";

import { cn } from "@/lib/utils";

interface WarmthIndicatorProps {
  score: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-green-500";
  if (score >= 40) return "text-amber-500";
  if (score > 0) return "text-red-500";
  return "text-muted-foreground";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Caution";
  if (score > 0) return "Critical";
  return "No Data";
}

function getTrackColor(score: number): string {
  if (score >= 80) return "stroke-emerald-500";
  if (score >= 60) return "stroke-green-500";
  if (score >= 40) return "stroke-amber-500";
  if (score > 0) return "stroke-red-500";
  return "stroke-muted";
}

export function WarmthIndicator({ score, size = "md", showLabel = true }: WarmthIndicatorProps) {
  const sizes = {
    sm: { width: 48, stroke: 4, text: "text-xs" },
    md: { width: 80, stroke: 6, text: "text-lg" },
    lg: { width: 120, stroke: 8, text: "text-2xl" },
  };

  const s = sizes[size];
  const radius = (s.width - s.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: s.width, height: s.width }}>
        <svg className="rotate-[-90deg]" width={s.width} height={s.width}>
          <circle
            className="stroke-muted"
            fill="none"
            strokeWidth={s.stroke}
            r={radius}
            cx={s.width / 2}
            cy={s.width / 2}
          />
          <circle
            className={cn(getTrackColor(score), "transition-all duration-500")}
            fill="none"
            strokeWidth={s.stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            r={radius}
            cx={s.width / 2}
            cy={s.width / 2}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("font-bold", s.text, getScoreColor(score))}>
            {Math.round(score)}
          </span>
        </div>
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium", getScoreColor(score))}>
          {getScoreLabel(score)}
        </span>
      )}
    </div>
  );
}
