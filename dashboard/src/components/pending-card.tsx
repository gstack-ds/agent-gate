"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { approveRequest, denyRequest, AuthRequest } from "@/lib/api";
import { toast } from "sonner";
import { Clock, Loader2, X } from "lucide-react";
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

function formatAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export function PendingCard({ request, agentName, onResolved }: PendingCardProps) {
  const [countdown, setCountdown] = useState(() =>
    formatCountdown(request.expires_at)
  );
  const [loading, setLoading] = useState<"approve" | "deny" | null>(null);
  const [denyExpanded, setDenyExpanded] = useState(false);
  const [denyReason, setDenyReason] = useState("");

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
    if (!denyExpanded) {
      setDenyExpanded(true);
      return;
    }
    setLoading("deny");
    try {
      await denyRequest(request.id, denyReason.trim() || undefined);
      toast.success("Request denied");
      onResolved(request.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deny");
      setLoading(null);
    }
  }

  function handleCancelDeny() {
    setDenyExpanded(false);
    setDenyReason("");
  }

  const remaining = getRemainingMs(request.expires_at);
  const isUrgent = request.expires_at !== null && remaining < 60 * 1000;
  const isWarningSoon = request.expires_at !== null && remaining < 5 * 60 * 1000;

  const displayName = agentName || request.agent_name || "Unknown Agent";
  const initials = getInitials(displayName);

  return (
    <div className="rounded-xl border-l-4 border-amber-400 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 bg-amber-50/50 dark:bg-amber-900/10 flex flex-col shadow-sm hover:shadow-md transition-shadow duration-150">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">{initials}</span>
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-900 dark:text-white truncate">
              {displayName}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">
              {request.action}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {request.amount !== null && (
            <span className="text-xl font-bold text-slate-900 dark:text-white">
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
                <span className="font-medium text-slate-900 dark:text-white">{request.vendor}</span>
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


        {countdown && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded",
              isUrgent
                ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                : isWarningSoon
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            {countdown === "Expired" ? "Expired" : `Expires in ${countdown}`}
          </div>
        )}
      </div>

      {/* Deny reason input */}
      {denyExpanded && (
        <div className="px-4 pb-3 space-y-2">
          <Textarea
            placeholder="Reason for denial (optional)"
            value={denyReason}
            onChange={(e) => setDenyReason(e.target.value)}
            className="text-sm resize-none h-16"
            autoFocus
          />
        </div>
      )}

      {/* Footer buttons */}
      <div className="px-4 pb-4 flex gap-2">
        {denyExpanded ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="flex-shrink-0 text-slate-500"
              onClick={handleCancelDeny}
              disabled={loading !== null}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors duration-150"
              onClick={handleDeny}
              disabled={loading !== null}
            >
              {loading === "deny" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {loading === "deny" ? "Denying..." : "Confirm Deny"}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              className="flex-1 border-rose-300 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors duration-150"
              onClick={handleDeny}
              disabled={loading !== null}
            >
              Deny
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white transition-colors duration-150"
              onClick={handleApprove}
              disabled={loading !== null}
            >
              {loading === "approve" && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
              {loading === "approve" ? "Approving..." : "Approve"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
