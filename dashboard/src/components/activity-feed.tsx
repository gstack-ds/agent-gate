"use client";

import { ActivityItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
}

function formatCurrency(amount: unknown): string {
  const n = Number(amount);
  if (isNaN(n)) return "";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function buildSentence(item: ActivityItem): string {
  const eventType = item.event_type ?? "";
  const agent = item.agent_name || "An agent";
  const vendor = item.vendor || "unknown vendor";
  const action = item.action || "purchase";
  const amountStr = item.amount !== null && item.amount !== undefined
    ? formatCurrency(item.amount)
    : "";

  switch (eventType) {
    case "request_created":
      return amountStr
        ? `${agent} requested ${action} at ${vendor} for ${amountStr}`
        : `${agent} requested ${action} at ${vendor}`;
    case "auto_approved":
      return amountStr
        ? `${agent} auto-approved: ${action} at ${vendor} for ${amountStr}`
        : `${agent}'s request was auto-approved at ${vendor}`;
    case "approved":
    case "human_approved":
      return amountStr
        ? `You approved ${agent}'s ${action} at ${vendor} for ${amountStr}`
        : `You approved ${agent}'s request at ${vendor}`;
    case "request_denied_by_rule":
      return `${agent}'s request at ${vendor} was blocked by a rule`;
    case "denied":
    case "human_denied":
      return amountStr
        ? `You denied ${agent}'s request at ${vendor} for ${amountStr}`
        : `You denied ${agent}'s request at ${vendor}`;
    case "request_pending":
      return amountStr
        ? `${agent}'s ${action} at ${vendor} (${amountStr}) — awaiting your approval`
        : `${agent}'s request at ${vendor} is awaiting your approval`;
    case "request_cancelled":
      return `${agent} cancelled their request`;
    case "request_expired":
      return `${agent}'s request at ${vendor} expired without a response`;
    default:
      return eventType ? eventType.replace(/_/g, " ") : "Unknown event";
  }
}

function eventColor(eventType: string | undefined | null): string {
  if (!eventType) return "bg-slate-400";
  if (eventType === "auto_approved" || eventType === "approved" || eventType === "human_approved") {
    return "bg-emerald-500";
  }
  if (
    eventType.includes("denied") ||
    eventType.includes("revoked") ||
    eventType.includes("expired") ||
    eventType.includes("blocked")
  ) {
    return "bg-rose-500";
  }
  if (eventType.includes("pending")) {
    return "bg-amber-500";
  }
  if (eventType.includes("created") || eventType.includes("registered")) {
    return "bg-blue-500";
  }
  return "bg-slate-400";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}


export function ActivityFeed({ items, loading = false }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="relative pl-8 border-l-2 border-slate-200 dark:border-slate-700 ml-3 space-y-0">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="relative pb-6">
            <div className="absolute -left-9 top-1.5 w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700 skeleton-shimmer" />
            <div className="space-y-1.5">
              <div className="skeleton-shimmer h-4 w-64 rounded" />
              <div className="skeleton-shimmer h-3 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        <div className="text-3xl mb-3">📋</div>
        <p className="font-medium">No activity yet</p>
        <p className="text-xs mt-1">Events will appear here as your agents operate</p>
      </div>
    );
  }

  return (
    <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3">
      {items.map((item) => {
        const sentence = buildSentence(item);
        const agentName = item.agent_name || "";
        const dotColor = eventColor(item.event_type);

        let displaySentence: React.ReactNode = sentence;
        if (agentName && sentence.includes(agentName)) {
          const parts = sentence.split(agentName);
          displaySentence = (
            <>
              {parts[0]}
              <span className="font-medium text-slate-900 dark:text-white">{agentName}</span>
              {parts.slice(1).join(agentName)}
            </>
          );
        }

        return (
          <div key={item.id} className="relative pl-8 pb-6">
            <div
              className={cn(
                "absolute left-0 top-1.5 w-3 h-3 rounded-full -translate-x-1.5",
                dotColor
              )}
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">
                {displaySentence}
              </p>
              <span className="text-xs text-slate-400 flex-shrink-0 mt-0.5">
                {timeAgo(item.created_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
