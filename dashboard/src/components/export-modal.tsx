"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { exportActivity, type Agent, type ExportParams } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
}

const DATE_PRESETS = [
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "All time", value: "all" },
  { label: "Custom", value: "custom" },
] as const;

type DatePreset = (typeof DATE_PRESETS)[number]["value"];

const STATUSES = [
  { label: "Any status", value: "" },
  { label: "Auto-approved", value: "auto_approved" },
  { label: "Approved", value: "approved" },
  { label: "Pending", value: "pending" },
  { label: "Denied", value: "denied" },
  { label: "Expired", value: "expired" },
  { label: "Cancelled", value: "cancelled" },
];

function getDateParams(
  preset: DatePreset,
  customStart: string,
  customEnd: string
): Pick<ExportParams, "start_date" | "end_date"> {
  if (preset === "all") return {};
  if (preset === "custom") {
    return {
      start_date: customStart ? `${customStart}T00:00:00.000Z` : undefined,
      end_date: customEnd ? `${customEnd}T23:59:59.999Z` : undefined,
    };
  }
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const start = new Date();
  start.setDate(start.getDate() - days);
  return { start_date: start.toISOString() };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportModal({ open, onOpenChange, agents }: ExportModalProps) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const params: ExportParams = {
        format,
        ...getDateParams(datePreset, customStart, customEnd),
        agent_id: agentId || undefined,
        status: status || undefined,
        category: category.trim() || undefined,
      };
      const { blob, filename } = await exportActivity(params);
      triggerDownload(blob, filename);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      if (msg.includes("429") || msg.toLowerCase().includes("rate limit")) {
        toast.error("Rate limit reached — max 10 exports per hour.");
      } else {
        toast.error("Export failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-4 w-4 text-indigo-400" />
            Export Activity
          </DialogTitle>
          <DialogDescription>
            Download your authorization history as a file.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Format */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Format
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(["csv", "json"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setFormat(fmt)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    format === fmt
                      ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-400"
                      : "border-border text-muted-foreground hover:border-slate-500 hover:text-foreground"
                  )}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Date range
            </Label>
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDatePreset(p.value)}
                  className={cn(
                    "rounded-md border px-3 py-1 text-xs font-medium transition-colors",
                    datePreset === p.value
                      ? "border-indigo-500/60 bg-indigo-500/10 text-indigo-400"
                      : "border-border text-muted-foreground hover:border-slate-500 hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {datePreset === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">From</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    max={customEnd || undefined}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">To</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    min={customStart || undefined}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Filters <span className="normal-case">(optional)</span>
            </Label>

            {/* Agent */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Agent</Label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All agents</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Input
                placeholder="e.g. cloud_services"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" disabled={loading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleDownload} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Exporting…
              </>
            ) : (
              <>
                <Download className="mr-2 h-3.5 w-3.5" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
