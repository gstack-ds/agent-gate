import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { LucideIcon } from "lucide-react";

type MetricColor = "blue" | "green" | "amber" | "red";

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
};

const iconColors: Record<MetricColor, string> = {
  blue: "text-blue-500",
  green: "text-green-500",
  amber: "text-amber-500",
  red: "text-red-500",
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
        "rounded-lg border bg-card shadow-sm hover:shadow-md transition-shadow border-l-4 p-5",
        borderColors[color]
      )}
    >
      <div className="flex items-center justify-between pb-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {Icon && (
          <Icon className={cn("h-4 w-4", iconColors[color])} />
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="h-8 w-24 mb-1" />
          {description !== undefined && <Skeleton className="h-4 w-32 mt-1" />}
        </>
      ) : (
        <>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
        </>
      )}
    </div>
  );
}
