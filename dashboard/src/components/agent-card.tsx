"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Agent, revokeAgent } from "@/lib/api";
import { toast } from "sonner";
import { Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
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
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  paused: {
    label: "Paused",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  revoked: {
    label: "Revoked",
    className: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
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
      <div className="rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">{initials}</span>
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{agent.name}</div>
              <div className="text-xs text-muted-foreground font-mono mt-0.5 truncate">
                {agent.api_key_prefix}...
              </div>
            </div>
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

        {/* No-rules warning */}
        {hasNoRules && (
          <div className="flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
            <span>No rules — all requests require manual approval</span>
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            Created {new Date(agent.created_at).toLocaleDateString()}
          </span>
          {agent.status !== "revoked" && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 gap-1.5 h-7 px-2 transition-colors duration-150"
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
              className="bg-red-600 hover:bg-red-700 text-white"
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
