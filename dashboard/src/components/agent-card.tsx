"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Agent, revokeAgent } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AgentCardProps {
  agent: Agent;
  onRevoked: (id: string) => void;
  ruleCount?: number | null;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

const statusConfig: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  paused: {
    label: "Paused",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  revoked: {
    label: "Revoked",
    className: "bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400",
  },
};

export function AgentCard({ agent, onRevoked, ruleCount }: AgentCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRevoke() {
    setLoading(true);
    try {
      await revokeAgent(agent.id);
      toast.success(`Agent "${agent.name}" revoked`);
      onRevoked(agent.id);
      setConfirmOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke agent");
      setLoading(false);
    }
  }

  const status = statusConfig[agent.status] ?? statusConfig.revoked;
  const initials = getInitials(agent.name);
  const hasNoRules = ruleCount === 0;

  return (
    <>
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow duration-150 flex flex-col gap-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="h-12 w-12 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-base">{initials}</span>
          </div>
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0",
              status.className
            )}
          >
            {status.label}
          </span>
        </div>

        {/* Agent info */}
        <div className="min-w-0">
          <div className="font-semibold text-base text-slate-900 dark:text-white truncate">
            {agent.name}
          </div>
          <div className="text-xs text-slate-400 font-mono mt-0.5 truncate">
            {agent.api_key_prefix}...
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Created {new Date(agent.created_at).toLocaleDateString()}
          </div>
        </div>

        {/* No-rules warning */}
        {hasNoRules && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>No rules — all requests require manual approval</span>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center gap-2 pt-1 mt-auto">
          <Link href="/rules" className="flex-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800 dark:hover:bg-indigo-950/30 transition-colors duration-150"
            >
              View Rules
            </Button>
          </Link>
          {agent.status !== "revoked" && (
            <Button
              variant="outline"
              size="sm"
              className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-800 dark:hover:bg-rose-950/30 gap-1.5 transition-colors duration-150"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Revoke
            </Button>
          )}
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke agent?</DialogTitle>
            <DialogDescription>
              Revoking <strong>{agent.name}</strong> will immediately invalidate its
              API key. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleRevoke}
              disabled={loading}
            >
              {loading ? "Revoking..." : "Revoke agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
