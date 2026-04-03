"use client";

import { useState } from "react";
import { ArrowRight, Zap } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createCheckoutSession } from "@/lib/api";

const PLANS = [
  {
    id: "starter" as const,
    name: "Starter",
    price: "$29",
    period: "/mo",
    requests: "5,000 authorizations/mo",
    agents: "Up to 10 agents",
    popular: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$99",
    period: "/mo",
    requests: "50,000 authorizations/mo",
    agents: "Up to 50 agents",
    popular: true,
  },
];

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const [loading, setLoading] = useState<"starter" | "pro" | null>(null);

  async function handleSubscribe(plan: "starter" | "pro") {
    setLoading(plan);
    try {
      const { url } = await createCheckoutSession(plan);
      window.location.href = url;
    } catch {
      toast.error("Failed to start checkout. Please try again.");
      setLoading(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-400" />
            Upgrade your plan
          </DialogTitle>
          <DialogDescription>
            More authorizations, more agents. Pick the plan that fits your workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 pt-1">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={cn(
                "rounded-lg border p-4",
                plan.popular
                  ? "border-indigo-500/40 bg-indigo-500/5"
                  : "border-border bg-muted/30"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      {plan.name}
                    </span>
                    {plan.popular && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-400/10 px-1.5 py-0.5 rounded">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{plan.requests}</p>
                  <p className="text-xs text-muted-foreground">{plan.agents}</p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <div className="text-right">
                    <span className="text-lg font-bold text-slate-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-xs text-muted-foreground">{plan.period}</span>
                  </div>
                  <Button
                    size="sm"
                    variant={plan.popular ? "default" : "outline"}
                    className={cn(
                      plan.popular && "bg-indigo-600 hover:bg-indigo-700 text-white"
                    )}
                    disabled={loading !== null}
                    onClick={() => handleSubscribe(plan.id)}
                  >
                    {loading === plan.id ? (
                      "Redirecting…"
                    ) : (
                      <>
                        Subscribe
                        <ArrowRight className="h-3 w-3" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
