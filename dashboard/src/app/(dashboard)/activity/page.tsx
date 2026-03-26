"use client";

import useSWR from "swr";
import { getActivity } from "@/lib/api";
import { ActivityFeed } from "@/components/activity-feed";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ActivityPage() {
  const {
    data: items,
    isLoading,
    error,
    mutate,
  } = useSWR("activity", getActivity, { refreshInterval: 15000 });

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-heading">
            Activity
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Recent events across all your agents
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load activity</span>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      )}

      <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block" />
              Approved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block" />
              Pending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 inline-block" />
              Denied / Expired
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 inline-block" />
              System
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityFeed items={items ?? []} loading={isLoading} />
        </CardContent>
      </Card>
    </div>
  );
}
