"use client";

import useSWR from "swr";
import { getRequests, getAgents } from "@/lib/api";
import { PendingCard } from "@/components/pending-card";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

export default function PendingPage() {
  const {
    data: requests,
    isLoading,
    error,
    mutate,
  } = useSWR("pending-requests-page", () => getRequests("pending"), {
    refreshInterval: 8000,
  });

  const { data: agents } = useSWR("agents", getAgents, {
    refreshInterval: 30000,
  });

  const agentMap = new Map(agents?.map((a) => [a.id, a.name]) ?? []);

  function handleResolved(id: string) {
    mutate((prev) => prev?.filter((r) => r.id !== id) ?? []);
  }

  const count = requests?.length ?? 0;

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-heading">
            Pending Requests
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isLoading
              ? "Loading..."
              : count > 0
              ? `${count} request${count === 1 ? "" : "s"} awaiting your review`
              : "Nothing to review"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load requests</span>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="max-w-2xl mx-auto space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer rounded-xl h-52" />
          ))}
        </div>
      ) : requests && requests.length > 0 ? (
        <div className="max-w-2xl mx-auto space-y-4">
          {requests.map((req) => (
            <PendingCard
              key={req.id}
              request={req}
              agentName={req.agent_id ? agentMap.get(req.agent_id) : undefined}
              onResolved={handleResolved}
            />
          ))}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto rounded-xl border border-dashed border-border p-16 text-center bg-white dark:bg-slate-800">
          <CheckCircle className="h-12 w-12 text-emerald-500/60 mx-auto mb-4" />
          <p className="text-base font-medium text-slate-900 dark:text-white">
            All caught up! No pending requests.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Your agents are operating within their rules
          </p>
        </div>
      )}
    </div>
  );
}
