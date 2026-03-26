"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approveRequest, denyRequest, AuthRequest } from "@/lib/api";
import { toast } from "sonner";
import { Clock, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PendingCardProps {
  request: AuthRequest;
  agentName?: string;
  onResolved: (id: string) => void;
}

function getRemainingMs(expiresAt: string | null): number {
  if (!expiresAt) return Infinity;
  return new Date(expiresAt).getTime() - Date.now();
}

function formatCountdown(expiresAt: string | null): string {
  if (!expiresAt) return "";
  const diff = getRemainingMs(expiresAt);
  if (diff <= 0) return "Expired";
  const minutes = Math.floor(diff / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatAmount(amount: number | null, currency: string): string {
  if (amount === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

export function PendingCard({ request, agentName, onResolved }: PendingCardProps) {
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(request.expires_at)
  );
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    if (!request.expires_at) return;
    const interval = setInterval(() => {
      setCountdown(formatCountdown(request.expires_at));
    }, 1000);
    return () => clearInterval(interval);
  }, [request.expires_at]);

  async function handleApprove() {
    setLoading("approve");
    try {
      await approveRequest(request.id);
      toast.success("Request approved");
      onResolved(request.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to approve");
      setLoading(null);
    }
  }

  async function handleDeny() {
    setLoading("deny");
    try {
      await denyRequest(request.id);
      toast.success("Request denied");
      onResolved(request.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deny");
      setLoading(null);
    }
  }

  const remaining = getRemainingMs(request.expires_at);
  const isUrgent = request.expires_at !== null && remaining < 60 * 1000;
  const isWarningSoon = request.expires_at !== null && remaining < 5 * 60 * 1000;

  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 flex flex-col shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2">
        <div>
          <div className="font-bold text-sm">{agentName || "Unknown Agent"}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{request.action}</div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {request.amount !== null && (
            <span className="text-xl font-bold">
              {formatAmount(request.amount, request.currency)}
            </span>
          )}
          {request.category && (
            <Badge variant="secondary" className="text-xs">
              {request.category}
            </Badge>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="px-4 pb-3 flex-1 space-y-2">
        {(request.vendor || request.description) && (
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
            {request.vendor && (
              <>
                <span className="text-muted-foreground">Vendor</span>
                <span className="font-medium">{request.vendor}</span>
              </>
            )}
            {request.description && (
              <>
                <span className="text-muted-foreground">Description</span>
                <span className="text-muted-foreground line-clamp-2">{request.description}</span>
              </>
            )}
          </div>
        )}

        {request.escalation_reason && (
          <div className="flex items-start gap-2 rounded-md bg-amber-100 dark:bg-amber-900/30 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{request.escalation_reason}</span>
          </div>
        )}

        {countdown && (
          <div
            className={cn(
              "flex items-center gap-1.5 text-xs font-semibold",
              isUrgent
                ? "text-red-600 dark:text-red-400"
                : isWarningSoon
                ? "text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {countdown === "Expired" ? "Expired" : `Expires in ${countdown}`}
          </div>
        )}
      </div>

      {/* Footer buttons */}
      <div className="px-4 pb-4 flex gap-2">
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
            "bg-green-600 hover:bg-green-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          )}
          onClick={handleApprove}
          disabled={loading !== null}
        >
          {loading === "approve" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading === "approve" ? "Approving..." : "Approve"}
        </button>
        <button
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
            "bg-red-600 hover:bg-red-700 text-white disabled:opacity-60 disabled:cursor-not-allowed"
          )}
          onClick={handleDeny}
          disabled={loading !== null}
        >
          {loading === "deny" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {loading === "deny" ? "Denying..." : "Deny"}
        </button>
      </div>
    </div>
  );
}
