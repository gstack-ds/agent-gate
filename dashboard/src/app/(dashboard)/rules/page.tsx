"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  getAgents,
  getAgentRules,
  createRule,
  deleteRule,
  getGlobalRuleTemplates,
  restoreAgentRules,
  RuleTemplate,
} from "@/lib/api";
import { RuleRow } from "@/components/rule-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Shield, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const RULE_TYPES = [
  { value: "max_per_transaction", label: "Max per transaction", hasAmount: true },
  { value: "max_per_day", label: "Max per day", hasAmount: true },
  { value: "max_per_month", label: "Max per month", hasAmount: true },
  { value: "require_approval_above", label: "Require approval above", hasAmount: true },
  { value: "auto_approve_below", label: "Auto-approve below", hasAmount: true },
  { value: "allowed_vendors", label: "Allowed vendors", hasList: true },
  { value: "blocked_vendors", label: "Blocked vendors", hasList: true },
  { value: "allowed_categories", label: "Allowed categories", hasList: true },
  { value: "blocked_categories", label: "Blocked categories", hasList: true },
];

const FALLBACK_TEMPLATES: RuleTemplate[] = [
  {
    name: "Conservative",
    description: "Tight controls: requires approval for anything over $25, hard daily/monthly caps.",
    risk_level: "low",
    rules: [
      { rule_type: "require_approval_above", value: { amount: 25 } },
      { rule_type: "max_per_day", value: { amount: 100 } },
      { rule_type: "max_per_month", value: { amount: 500 } },
    ],
  },
  {
    name: "Moderate",
    description: "Balanced: auto-approves small purchases, flags large ones, reasonable spend caps.",
    risk_level: "medium",
    rules: [
      { rule_type: "auto_approve_below", value: { amount: 50 } },
      { rule_type: "require_approval_above", value: { amount: 200 } },
      { rule_type: "max_per_day", value: { amount: 500 } },
      { rule_type: "max_per_month", value: { amount: 2000 } },
    ],
  },
  {
    name: "Permissive",
    description: "Minimal friction: auto-approves most purchases, only blocks truly large spends.",
    risk_level: "high",
    rules: [
      { rule_type: "auto_approve_below", value: { amount: 500 } },
      { rule_type: "max_per_day", value: { amount: 2000 } },
      { rule_type: "max_per_month", value: { amount: 10000 } },
    ],
  },
  {
    name: "Online Shopping",
    description: "E-commerce focused: auto-approves small purchases, flags mid-range, blocks large transactions with a daily cap.",
    risk_level: "medium",
    rules: [
      { rule_type: "auto_approve_below", value: { amount: 50 } },
      { rule_type: "require_approval_above", value: { amount: 50 } },
      { rule_type: "max_per_transaction", value: { amount: 500 } },
      { rule_type: "max_per_day", value: { amount: 300 } },
    ],
  },
  {
    name: "Procurement",
    description: "Business purchasing: auto-approves small orders from any vendor, flags larger purchases, with a daily spend cap.",
    risk_level: "medium",
    rules: [
      { rule_type: "auto_approve_below", value: { amount: 100 } },
      { rule_type: "require_approval_above", value: { amount: 100 } },
      { rule_type: "max_per_day", value: { amount: 1000 } },
    ],
  },
  {
    name: "Ad Spending",
    description: "Advertising budget control: auto-approves small ad buys, flags anything larger, with a tight daily cap.",
    risk_level: "medium",
    rules: [
      { rule_type: "auto_approve_below", value: { amount: 25 } },
      { rule_type: "require_approval_above", value: { amount: 25 } },
      { rule_type: "max_per_day", value: { amount: 200 } },
    ],
  },
];

const TEMPLATE_STYLES: Record<
  string,
  { border: string; bg: string; badge: string; badgeText: string; applyBtn: string }
> = {
  conservative: {
    border: "border-emerald-200 dark:border-emerald-800",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    badge: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    badgeText: "Conservative",
    applyBtn: "border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300",
  },
  moderate: {
    border: "border-amber-200 dark:border-amber-800",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    badge: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    badgeText: "Moderate",
    applyBtn: "border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-700 dark:text-amber-300",
  },
  permissive: {
    border: "border-rose-200 dark:border-rose-800",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    badge: "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300",
    badgeText: "Permissive",
    applyBtn: "border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-700 dark:text-rose-300",
  },
  shopping: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    badgeText: "Shopping",
    applyBtn: "border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-blue-700 dark:text-blue-300",
  },
  procurement: {
    border: "border-violet-200 dark:border-violet-800",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    badge: "bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300",
    badgeText: "Procurement",
    applyBtn: "border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 text-violet-700 dark:text-violet-300",
  },
  adspending: {
    border: "border-orange-200 dark:border-orange-800",
    bg: "bg-orange-50 dark:bg-orange-950/30",
    badge: "bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300",
    badgeText: "Ad Spending",
    applyBtn: "border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-700 dark:text-orange-300",
  },
};

function getTemplateStyle(name: string) {
  const key = name.toLowerCase().replace(/\s+/g, "");
  if (key.includes("conservative")) return TEMPLATE_STYLES.conservative;
  if (key.includes("permissive")) return TEMPLATE_STYLES.permissive;
  if (key.includes("shopping")) return TEMPLATE_STYLES.shopping;
  if (key.includes("procurement")) return TEMPLATE_STYLES.procurement;
  if (key.includes("ad")) return TEMPLATE_STYLES.adspending;
  return TEMPLATE_STYLES.moderate;
}

function getRiskLevelBadge(riskLevel?: string): { text: string; className: string } | null {
  if (!riskLevel) return null;
  const level = riskLevel.toLowerCase();
  if (level === "low") return {
    text: "Low risk",
    className: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
  };
  if (level === "high") return {
    text: "High risk",
    className: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
  };
  return {
    text: "Medium risk",
    className: "bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300",
  };
}

function ruleTypeSummary(ruleType: string, value: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    max_per_transaction: "Max/transaction",
    max_per_day: "Max/day",
    max_per_month: "Max/month",
    require_approval_above: "Approval above",
    auto_approve_below: "Auto-approve below",
  };
  const label = labels[ruleType] || ruleType.replace(/_/g, " ");
  if (value.amount !== undefined) {
    return `${label}: $${value.amount}`;
  }
  return label;
}

export default function RulesPage() {
  const { data: agents, isLoading: agentsLoading } = useSWR("agents", getAgents);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const {
    data: rules,
    isLoading: rulesLoading,
    mutate: mutateRules,
  } = useSWR(
    selectedAgentId ? `rules-${selectedAgentId}` : null,
    () => getAgentRules(selectedAgentId)
  );

  const { data: fetchedTemplates } = useSWR<RuleTemplate[] | null>(
    "rule-templates",
    () => getGlobalRuleTemplates().catch(() => null)
  );
  const templates = fetchedTemplates ?? FALLBACK_TEMPLATES;

  const [addOpen, setAddOpen] = useState(false);
  const [ruleType, setRuleType] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [listValue, setListValue] = useState("");
  const [adding, setAdding] = useState(false);

  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);
  const [confirmTemplate, setConfirmTemplate] = useState<RuleTemplate | null>(null);
  const [pendingHighThresholdRule, setPendingHighThresholdRule] = useState<{
    ruleType: string;
    value: Record<string, unknown>;
  } | null>(null);

  const selectedRuleType = RULE_TYPES.find((r) => r.value === ruleType);

  function templateToastMessage(template: RuleTemplate): string {
    const key = template.name.toLowerCase();
    if (key.includes("conservative")) {
      return "Conservative rules applied — all purchases require your approval, $50/day limit.";
    }
    if (key.includes("moderate")) {
      return "Moderate rules applied — purchases under $25 auto-approved, over $100 require your approval, $200/day limit.";
    }
    if (key.includes("permissive")) {
      return "Permissive rules applied — purchases under $100 auto-approved, $500/day limit.";
    }
    return `${template.name} applied — ${template.rules.length} rule${template.rules.length !== 1 ? "s" : ""} active.`;
  }

  const HIGH_THRESHOLD_TYPES = new Set(["auto_approve_below", "require_approval_above"]);
  const HIGH_THRESHOLD_LIMIT = 1000;

  async function _submitRule(rt: string, value: Record<string, unknown>) {
    try {
      await createRule(selectedAgentId, rt, value);
      toast.success("Rule added");
      setAddOpen(false);
      setRuleType("");
      setAmountValue("");
      setListValue("");
      mutateRules();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add rule");
    } finally {
      setAdding(false);
    }
  }

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgentId || !ruleType) return;
    setAdding(true);

    let value: Record<string, unknown> = {};
    if (selectedRuleType?.hasAmount) {
      const amt = parseFloat(amountValue);
      if (isNaN(amt) || amt < 0) {
        toast.error("Enter a valid amount");
        setAdding(false);
        return;
      }
      value = { amount: amt };
      // Warn before creating a high auto-approve threshold
      if (HIGH_THRESHOLD_TYPES.has(ruleType) && amt > HIGH_THRESHOLD_LIMIT) {
        setPendingHighThresholdRule({ ruleType, value });
        setAdding(false);
        return;
      }
    } else if (selectedRuleType?.hasList) {
      const items = listValue
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length === 0) {
        toast.error("Enter at least one item");
        setAdding(false);
        return;
      }
      const key = ruleType.includes("vendor") ? "vendors" : "categories";
      value = { [key]: items };
    }

    await _submitRule(ruleType, value);
  }

  async function handleConfirmHighThreshold() {
    if (!pendingHighThresholdRule) return;
    const { ruleType: rt, value } = pendingHighThresholdRule;
    setPendingHighThresholdRule(null);
    setAdding(true);
    await _submitRule(rt, value);
  }

  function handleApplyTemplate(template: RuleTemplate) {
    if (!selectedAgentId) {
      toast.warning("Select an agent first");
      return;
    }
    setConfirmTemplate(template);
  }

  async function handleConfirmApplyTemplate() {
    if (!confirmTemplate || !selectedAgentId) return;
    const template = confirmTemplate;
    const agentId = selectedAgentId;
    setConfirmTemplate(null);
    setApplyingTemplate(template.name);

    try {
      // Step 1: delete all existing rules — stop on first failure
      const currentRules = rules ?? [];
      for (const rule of currentRules) {
        await deleteRule(rule.id);
      }

      // Step 2: create template rules
      for (const rule of template.rules) {
        await createRule(agentId, rule.rule_type, rule.value);
      }

      toast("Template applied.", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await restoreAgentRules(agentId);
              mutateRules();
              toast.success("Rules restored.");
            } catch {
              toast.error("Failed to restore previous rules.");
            }
          },
        },
      });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to apply template"
      );
    } finally {
      setApplyingTemplate(null);
      mutateRules();
    }
  }

  function handleRuleDeleted(id: string) {
    mutateRules((prev) => prev?.filter((r) => r.id !== id) ?? []);
  }

  const selectedAgent = agents?.find((a) => a.id === selectedAgentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-heading">
          Rules
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure auto-approval and spending limits per agent
        </p>
      </div>

      {/* Quick Setup Templates — always visible */}
      <div>
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 font-heading">
          Quick Setup Templates
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tmpl) => {
            const style = getTemplateStyle(tmpl.name);
            const isApplying = applyingTemplate === tmpl.name;
            const riskBadge = getRiskLevelBadge(tmpl.risk_level);
            const isConservative = tmpl.name.toLowerCase().includes("conservative");
            const dailyCap = tmpl.rules.find((r) => r.rule_type === "max_per_day");
            return (
              <div
                key={tmpl.name}
                className={cn(
                  "rounded-xl border p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow duration-150",
                  style.border,
                  style.bg
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        style.badge
                      )}
                    >
                      {style.badgeText}
                    </span>
                    {riskBadge && (
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full",
                          riskBadge.className
                        )}
                      >
                        {riskBadge.text}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">
                    {tmpl.rules.length} rules
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900 dark:text-white">
                    {tmpl.name}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tmpl.description}
                  </p>
                </div>
                <ul className="space-y-1">
                  {tmpl.rules.map((r, i) => (
                    <li key={i} className="text-xs text-muted-foreground font-mono">
                      • {ruleTypeSummary(r.rule_type, r.value)}
                      {isConservative && r.rule_type === "max_per_day" && (
                        <p className="font-sans not-italic mt-0.5 pl-2 text-muted-foreground/70">
                          Daily spending across all purchases is capped at ${dailyCap?.value?.amount as number}. Once reached, all further requests are denied for the day.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="outline"
                  className={cn("mt-auto transition-colors duration-150", style.applyBtn)}
                  onClick={() => handleApplyTemplate(tmpl)}
                  disabled={applyingTemplate !== null}
                  title={!selectedAgentId ? "Select an agent first" : undefined}
                >
                  {isApplying ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Applying...
                    </>
                  ) : (
                    "Apply"
                  )}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Templates replace all current rules for the selected agent.
          {!selectedAgentId && " Select an agent below to apply a template."}
        </p>
      </div>

      {/* Agent selector */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>Select agent</Label>
              {agentsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={selectedAgentId}
                  onValueChange={(v) => setSelectedAgentId(v ?? "")}
                >
                  <SelectTrigger className="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    {selectedAgentId && selectedAgent ? (
                      <span className="font-medium">{selectedAgent.name}</span>
                    ) : (
                      <SelectValue placeholder="Choose an agent to manage rules" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {agents?.filter((a) => a.status !== "revoked").map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {agent.name}
                            {agent.status !== "active" && (
                              <span className="ml-2 text-muted-foreground text-xs font-normal">
                                ({agent.status})
                              </span>
                            )}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {selectedAgentId && (
              <Button
                onClick={() => setAddOpen(true)}
                className="gap-2 flex-shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150"
              >
                <Plus className="h-4 w-4" />
                Add rule
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedAgentId && (
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-3 font-heading">
            Rules for {selectedAgent?.name}
          </h2>

          {rulesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : rules && rules.length > 0 ? (
            <div className="space-y-2">
              {rules.map((rule) => (
                <RuleRow key={rule.id} rule={rule} onDeleted={handleRuleDeleted} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-10 text-center">
              <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium">No rules configured</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Apply a template above or add rules manually.
              </p>
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400 text-left max-w-sm mx-auto">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>All requests require your approval</strong> until you
                  set rules.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {!selectedAgentId && !agentsLoading && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-medium">Select an agent to manage rules</p>
          <p className="text-xs text-muted-foreground mt-1">
            Choose an agent from the dropdown above to view and edit its rules.
          </p>
        </div>
      )}

      {/* High-threshold warning dialog */}
      <Dialog
        open={pendingHighThresholdRule !== null}
        onOpenChange={(open) => { if (!open) setPendingHighThresholdRule(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              High auto-approve threshold
            </DialogTitle>
            <DialogDescription>
              Purchases up to{" "}
              <span className="font-medium text-foreground">
                ${Number(pendingHighThresholdRule?.value?.amount ?? 0).toLocaleString()}
              </span>{" "}
              will be approved without your review. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPendingHighThresholdRule(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmHighThreshold}
              className="bg-amber-600 hover:bg-amber-700 text-white transition-colors duration-150"
            >
              Yes, create rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Template Apply Dialog */}
      <Dialog
        open={confirmTemplate !== null}
        onOpenChange={(open) => { if (!open) setConfirmTemplate(null); }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply {confirmTemplate?.name} template?</DialogTitle>
            <DialogDescription>
              This will{" "}
              <span className="font-medium text-foreground">
                permanently replace all current rules
              </span>{" "}
              for{" "}
              <span className="font-medium text-foreground">
                {selectedAgent?.name}
              </span>
              . Your existing rules will be backed up and can be restored.
            </DialogDescription>
          </DialogHeader>
          {confirmTemplate?.name.toLowerCase().includes("permissive") && (
            <div className="flex items-start gap-2 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 px-3 py-2.5 text-sm text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                This template auto-approves purchases up to $100 without your review. Your agents could spend up to $500/day without asking.
              </span>
            </div>
          )}
          {confirmTemplate && (
            <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1">
              {confirmTemplate.rules.map((r, i) => (
                <div key={i} className="text-muted-foreground font-mono text-xs">
                  • {ruleTypeSummary(r.rule_type, r.value)}
                </div>
              ))}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmTemplate(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmApplyTemplate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150"
            >
              Apply template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Rule Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add rule</DialogTitle>
            <DialogDescription>
              Configure a spending rule for {selectedAgent?.name}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddRule}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Rule type</Label>
                <Select value={ruleType} onValueChange={(v) => setRuleType(v ?? "")}>
                  <SelectTrigger className="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <SelectValue placeholder="Select rule type" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((rt) => (
                      <SelectItem key={rt.value} value={rt.value}>
                        {rt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedRuleType?.hasAmount && (
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount (USD)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 50.00"
                    value={amountValue}
                    onChange={(e) => setAmountValue(e.target.value)}
                    className="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              )}

              {selectedRuleType?.hasList && (
                <div className="space-y-2">
                  <Label htmlFor="list-value">
                    {ruleType.includes("vendor") ? "Vendors" : "Categories"}{" "}
                    <span className="text-muted-foreground font-normal">
                      (comma-separated)
                    </span>
                  </Label>
                  <Input
                    id="list-value"
                    placeholder={
                      ruleType.includes("vendor")
                        ? "e.g. AWS, GCP, Azure"
                        : "e.g. cloud_services, office_supplies"
                    }
                    value={listValue}
                    onChange={(e) => setListValue(e.target.value)}
                    className="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
              )}
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={adding}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={adding || !ruleType}
                className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150"
              >
                {adding ? "Adding..." : "Add rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
