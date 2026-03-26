"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  getAgents,
  getAgentRules,
  createRule,
  getRuleTemplates,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const TEMPLATE_STYLES: Record<
  string,
  { border: string; bg: string; badge: string; badgeText: string }
> = {
  conservative: {
    border: "border-gray-200 dark:border-gray-700",
    bg: "bg-gray-50 dark:bg-gray-900/40",
    badge: "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    badgeText: "Conservative",
  },
  moderate: {
    border: "border-blue-200 dark:border-blue-800",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    badge: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    badgeText: "Moderate",
  },
  permissive: {
    border: "border-green-200 dark:border-green-800",
    bg: "bg-green-50 dark:bg-green-950/30",
    badge: "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300",
    badgeText: "Permissive",
  },
};

function getTemplateStyle(name: string) {
  const key = name.toLowerCase();
  if (key.includes("conservative")) return TEMPLATE_STYLES.conservative;
  if (key.includes("permissive")) return TEMPLATE_STYLES.permissive;
  return TEMPLATE_STYLES.moderate;
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

  const { data: templates, isLoading: templatesLoading } = useSWR(
    selectedAgentId ? `templates-${selectedAgentId}` : null,
    () => getRuleTemplates(selectedAgentId)
  );

  const [addOpen, setAddOpen] = useState(false);
  const [ruleType, setRuleType] = useState("");
  const [amountValue, setAmountValue] = useState("");
  const [listValue, setListValue] = useState("");
  const [adding, setAdding] = useState(false);

  const [applyingTemplate, setApplyingTemplate] = useState<string | null>(null);

  const selectedRuleType = RULE_TYPES.find((r) => r.value === ruleType);

  async function handleAddRule(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgentId || !ruleType) return;
    setAdding(true);

    let value: Record<string, unknown> = {};
    if (selectedRuleType?.hasAmount) {
      const amt = parseFloat(amountValue);
      if (isNaN(amt) || amt <= 0) {
        toast.error("Enter a valid positive amount");
        setAdding(false);
        return;
      }
      value = { amount: amt };
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

    try {
      await createRule(selectedAgentId, ruleType, value);
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

  async function handleApplyTemplate(template: RuleTemplate) {
    if (!selectedAgentId) return;
    setApplyingTemplate(template.name);
    try {
      for (const rule of template.rules) {
        await createRule(selectedAgentId, rule.rule_type, rule.value);
      }
      toast.success(
        `Applied "${template.name}" template (${template.rules.length} rules)`
      );
      mutateRules();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to apply template"
      );
    } finally {
      setApplyingTemplate(null);
    }
  }

  function handleRuleDeleted(id: string) {
    mutateRules((prev) => prev?.filter((r) => r.id !== id) ?? []);
  }

  const selectedAgent = agents?.find((a) => a.id === selectedAgentId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rules</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure auto-approval and spending limits per agent
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
                    <SelectValue placeholder="Choose an agent to manage rules" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents?.map((agent) => (
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
                          <span className="text-xs text-muted-foreground font-mono">
                            {agent.id}
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
        <>
          {/* Templates row */}
          {templatesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : templates && templates.length > 0 ? (
            <div>
              <h2 className="text-base font-semibold mb-3">Quick templates</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {templates.map((tmpl) => {
                  const style = getTemplateStyle(tmpl.name);
                  const isApplying = applyingTemplate === tmpl.name;
                  return (
                    <div
                      key={tmpl.name}
                      className={cn(
                        "rounded-lg border p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow",
                        style.border,
                        style.bg
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            "text-xs font-semibold px-2 py-0.5 rounded-full",
                            style.badge
                          )}
                        >
                          {style.badgeText}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {tmpl.rules.length} rules
                        </span>
                      </div>
                      <div>
                        <div className="font-semibold text-sm">{tmpl.name}</div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {tmpl.description}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-auto transition-colors duration-150"
                        onClick={() => handleApplyTemplate(tmpl)}
                        disabled={applyingTemplate !== null}
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
                Templates add rules to the existing set — they don&apos;t
                replace current rules.
              </p>
            </div>
          ) : null}

          {/* Rules list */}
          <div>
            <h2 className="text-base font-semibold mb-3">
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
                  All requests require manual approval until you add rules.
                </p>
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400 text-left max-w-sm mx-auto">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>All requests require your approval</strong> until you
                    set rules. Add rules or apply a template to enable
                    auto-approval.
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
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
                    min="0.01"
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
