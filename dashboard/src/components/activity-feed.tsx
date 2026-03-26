"use client";

import { ActivityItem } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
}

function eventColor(eventType: string | undefined | null): string {
  if (!eventType) return "bg-gray-500";
  if (eventType.includes("approved") || eventType.includes("auto_approved")) {
    return "bg-green-500";
  }
  if (
    eventType.includes("denied") ||
    eventType.includes("revoked") ||
    eventType.includes("expired")
  ) {
    return "bg-red-500";
  }
  if (eventType.includes("pending")) {
    return "bg-amber-500";
  }
  if (eventType.includes("created")) {
    return "bg-blue-500";
  }
  return "bg-blue-500";
}

function eventSentence(item: ActivityItem): string {
  const eventType = item.event_type ?? "";
  const details = item.details ?? {};
  const agentName =
    typeof details.agent_name === "string" && details.agent_name
      ? details.agent_name
      : "An agent";
  const amount =
    details.amount !== undefined && details.amount !== null
      ? `$${Number(details.amount).toFixed(2)}`
      : null;
  const vendor =
    typeof details.vendor === "string" && details.vendor
      ? ` at ${details.vendor}`
      : "";

  switch (eventType) {
    case "auto_approved":
      return amount
        ? `${agentName} purchased ${amount}${vendor}`
        : `${agentName}'s request was auto-approved${vendor}`;
    case "human_approved":
      return amount
        ? `You approved ${agentName}'s ${amount} request${vendor}`
        : `You approved ${agentName}'s request${vendor}`;
    case "human_denied":
      return `${agentName}'s request was denied`;
    case "request_created":
      return amount
        ? `${agentName}'s ${amount} request${vendor} requires approval`
        : `${agentName} submitted a request${vendor}`;
    case "request_expired":
      return `${agentName}'s request expired`;
    case "agent_registered":
      return `Agent "${agentName}" was registered`;
    case "agent_revoked":
      return `Agent "${agentName}" was revoked`;
    case "rule_created":
      return `A new rule was added for ${agentName}`;
    case "rule_deleted":
      return `A rule was removed for ${agentName}`;
    default:
      return eventType.replace(/_/g, " ");
  }
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ActivityFeed({ items, loading = false }: ActivityFeedProps) {
  if (loading) {
    return (
      <div className="space-y-0">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex gap-4 py-3 border-b border-border last:border-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <Skeleton className="h-2.5 w-2.5 rounded-full mt-1.5" />
            </div>
            <div className="flex-1 flex items-start justify-between gap-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-16 flex-shrink-0" />
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
    <div className="space-y-0">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex gap-4 py-3 border-b border-border last:border-0"
        >
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className={cn(
                "h-2.5 w-2.5 rounded-full mt-1.5",
                eventColor(item.event_type)
              )}
            />
          </div>
          <div className="flex-1 flex items-start justify-between gap-2 min-w-0">
            <p className="text-sm leading-snug">{eventSentence(item)}</p>
            <span className="text-xs text-muted-foreground/60 flex-shrink-0 mt-0.5">
              {timeAgo(item.created_at)}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
