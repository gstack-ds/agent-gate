import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

type MetricColor = "blue" | "green" | "amber" | "red" | "indigo" | "emerald" | "rose" | "slate";

interface MetricCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  description?: string;
  loading?: boolean;
  color?: MetricColor;
}

const borderColors: Record<MetricColor, string> = {
  blue: "border-l-blue-500",
  green: "border-l-green-500",
  amber: "border-l-amber-500",
  red: "border-l-red-500",
  indigo: "border-l-indigo-500",
  emerald: "border-l-emerald-500",
  rose: "border-l-rose-500",
  slate: "border-l-slate-400",
};

const iconColors: Record<MetricColor, string> = {
  blue: "text-blue-500",
  green: "text-green-500",
  amber: "text-amber-500",
  red: "text-red-500",
  indigo: "text-indigo-500",
  emerald: "text-emerald-500",
  rose: "text-rose-500",
  slate: "text-slate-400",
};

export function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  loading = false,
  color = "blue",
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm hover:shadow-md transition-shadow duration-150 border-l-4",
        borderColors[color]
      )}
    >
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        {Icon && (
          <Icon className={cn("h-4 w-4", iconColors[color])} />
        )}
      </div>
      {loading ? (
        <>
          <div className="skeleton-shimmer h-9 w-24 rounded mb-1" />
          {description !== undefined && (
            <div className="skeleton-shimmer h-3 w-32 rounded mt-1" />
          )}
        </>
      ) : (
        <>
          <div className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            {value}
          </div>
          {description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
          )}
        </>
      )}
    </div>
  );
}
