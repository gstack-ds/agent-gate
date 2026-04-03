"use client";

import useSWR from "swr";
import { useEffect } from "react";
import { toast } from "sonner";
import { getDashboardStats, getRequests, getAgents, getUsage, UsageData } from "@/lib/api";
import { MetricCard } from "@/components/metric-card";
import { PendingCard } from "@/components/pending-card";
import {
  Activity,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Zap,
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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const NEXT_PLAN: Record<string, { name: string; requests: number; price: string }> = {
  free:    { name: "Starter", requests: 5000,  price: "$29/mo" },
  starter: { name: "Pro",     requests: 50000, price: "$99/mo" },
  pro:     { name: "Business", requests: -1,   price: "Custom" },
};

function UsageSection({ usage }: { usage: UsageData }) {
  const { plan, authorizations_this_month, requests_limit, agents_active, agents_limit } = usage;

  if (requests_limit === null) {
    // Business plan — unlimited, show compact summary
    return (
      <div className="rounded-xl border border-border bg-white dark:bg-slate-800 p-4 flex items-center gap-3">
        <Zap className="h-4 w-4 text-indigo-500 flex-shrink-0" />
        <span className="text-sm text-muted-foreground">
          <span className="font-medium text-slate-900 dark:text-white">{capitalize(plan)} plan</span>
          {" — "}unlimited authorizations · {agents_active} agent{agents_active !== 1 ? "s" : ""} active
        </span>
      </div>
    );
  }

  const usagePct = requests_limit > 0 ? authorizations_this_month / requests_limit : 0;
  const isOver = usagePct >= 1;
  const isWarning = usagePct >= 0.8;
  const hardCap = Math.floor(requests_limit * 1.1);

  const barColor = isOver
    ? "bg-red-500"
    : isWarning
    ? "bg-amber-500"
    : "bg-indigo-500";

  const nextPlanInfo = NEXT_PLAN[plan];

  return (
    <div className="space-y-3">
      {/* Usage bar */}
      <div className="rounded-xl border border-border bg-white dark:bg-slate-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-900 dark:text-white">
              {capitalize(plan)} plan
            </span>
            <span className="text-xs text-muted-foreground">
              · {agents_active}{agents_limit !== null ? `/${agents_limit}` : ""} agent{agents_active !== 1 ? "s" : ""} active
            </span>
          </div>
          <span className={`text-xs font-medium ${isOver ? "text-red-600 dark:text-red-400" : isWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
            {authorizations_this_month.toLocaleString()} / {requests_limit.toLocaleString()} authorizations this month
          </span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${Math.min(usagePct * 100, 100)}%` }}
          />
        </div>
        {isOver && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">
            Over limit — authorizations blocked at {hardCap.toLocaleString()}
          </p>
        )}
      </div>

      {/* Hard-limit banner */}
      {isOver && nextPlanInfo && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                Monthly limit reached — agents are paused
              </p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                You&apos;ve used {authorizations_this_month.toLocaleString()} of {requests_limit.toLocaleString()} authorizations.
                Upgrade to {nextPlanInfo.name} for {nextPlanInfo.requests > 0 ? `${nextPlanInfo.requests.toLocaleString()} authorizations/month` : "unlimited authorizations"}.
              </p>
            </div>
            <Link href="/billing">
              <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white flex-shrink-0">
                Upgrade · {nextPlanInfo.price}
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* 80% warning upsell */}
      {isWarning && !isOver && nextPlanInfo && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                You&apos;ve used {Math.round(usagePct * 100)}% of your monthly authorizations
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {authorizations_this_month.toLocaleString()} of {requests_limit.toLocaleString()} used.
                Upgrade to {nextPlanInfo.name} for {nextPlanInfo.requests > 0 ? `${nextPlanInfo.requests.toLocaleString()} authorizations/month` : "unlimited"} — {nextPlanInfo.price}.
              </p>
            </div>
            <Link href="/billing">
              <Button size="sm" variant="outline" className="border-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-amber-700 dark:text-amber-300 flex-shrink-0">
                Upgrade
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
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

  const { data: usageData, mutate: mutateUsage } = useSWR("usage", getUsage, {
    refreshInterval: 60000,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      toast.success("Plan upgraded successfully!");
      mutateUsage();
      window.history.replaceState({}, "", window.location.pathname);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {usageData && <UsageSection usage={usageData} />}

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
                agentName={req.agent_id ? agentMap.get(req.agent_id) : undefined}
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
