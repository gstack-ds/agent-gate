"use client";

import useSWR from "swr";
import { getDashboardStats, getRequests, getAgents } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { PendingCard } from "@/components/pending-card";
import {
  Activity,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function safeNum(val: number | null | undefined): number {
  if (val === null || val === undefined || isNaN(val as number)) return 0;
  return val;
}

function formatDollar(val: number | null | undefined): string {
  const n = safeNum(val);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function formatPct(val: number | null | undefined): string {
  const n = safeNum(val);
  return `${(n * 100).toFixed(1)}%`;
}

export default function OverviewPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    mutate: mutateStats,
  } = useSWR("dashboard-stats", getDashboardStats, {
    refreshInterval: 15000,
  });

  const {
    data: pendingRequests,
    isLoading: pendingLoading,
    mutate: mutatePending,
  } = useSWR("pending-requests", () => getRequests("pending"), {
    refreshInterval: 10000,
  });

  const { data: agents, isLoading: agentsLoading } = useSWR("agents", getAgents, {
    refreshInterval: 30000,
  });

  const agentMap = new Map(agents?.map((a) => [a.id, a.name]) ?? []);

  function handleResolved(id: string) {
    mutatePending((prev) => prev?.filter((r) => r.id !== id) ?? []);
    mutateStats();
  }

  return (
    <div className="space-y-8 page-enter">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-heading">
          Overview
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor your agent activity and spending
        </p>
      </div>

      {statsError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load stats</span>
          <Button variant="outline" size="sm" onClick={() => mutateStats()}>
            Retry
          </Button>
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <MetricCard
          title="Total Requests"
          value={safeNum(stats?.total_requests).toLocaleString()}
          icon={Activity}
          loading={statsLoading}
          color="blue"
        />
        <MetricCard
          title="Auto-Approved"
          value={safeNum(stats?.auto_approved).toLocaleString()}
          icon={CheckCircle}
          loading={statsLoading}
          color="emerald"
        />
        <MetricCard
          title="Pending"
          value={safeNum(stats?.pending).toLocaleString()}
          icon={Clock}
          description="Awaiting your review"
          loading={statsLoading}
          color="amber"
        />
        <MetricCard
          title="Total Spend"
          value={formatDollar(stats?.total_spend)}
          icon={DollarSign}
          loading={statsLoading}
          color="indigo"
        />
        <MetricCard
          title="Approval Rate"
          value={formatPct(stats?.approval_rate)}
          icon={TrendingUp}
          loading={statsLoading}
          color="green"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white font-heading">
            Requires Your Attention
          </h2>
          {(pendingRequests?.length ?? 0) > 3 && (
            <Link href="/pending">
              <Button variant="outline" size="sm" className="transition-colors duration-150">
                View all
              </Button>
            </Link>
          )}
        </div>

        {pendingLoading || agentsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer rounded-xl h-48" />
            ))}
          </div>
        ) : pendingRequests && pendingRequests.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingRequests.slice(0, 3).map((req) => (
              <PendingCard
                key={req.id}
                request={req}
                agentName={agentMap.get(req.agent_id)}
                onResolved={handleResolved}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-12 text-center bg-white dark:bg-slate-800">
            <CheckCircle className="h-10 w-10 text-emerald-500/60 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              All caught up!
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              No pending requests — your agents are operating within their rules
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
