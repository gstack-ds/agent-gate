"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { getAgents, createAgent, createRule, getAgentRules, Agent } from "@/lib/api";
import { AgentCard } from "@/components/agent-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Bot, Copy, Check, AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function AgentsPage() {
  const {
    data: agents,
    isLoading,
    error,
    mutate,
  } = useSWR("agents", getAgents, { refreshInterval: 30000 });

  const [registerOpen, setRegisterOpen] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [registering, setRegistering] = useState(false);

  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [newAgentName, setNewAgentName] = useState<string>("");
  const [newAgentId, setNewAgentId] = useState<string>("");
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);

  const [ruleCounts, setRuleCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!agents || agents.length === 0) return;
    Promise.all(
      agents.map((a: Agent) =>
        getAgentRules(a.id)
          .then((rules) => ({ id: a.id, count: rules.length }))
          .catch(() => ({ id: a.id, count: -1 }))
      )
    ).then((results) => {
      const counts: Record<string, number> = {};
      for (const r of results) {
        counts[r.id] = r.count;
      }
      setRuleCounts(counts);
    });
  }, [agents]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!agentName.trim()) return;
    setRegistering(true);
    try {
      const agent = await createAgent(agentName.trim());
      toast.success(`Agent "${agent.name}" registered`);
      setAgentName("");
      setRegisterOpen(false);
      setNewApiKey(agent.api_key);
      setNewAgentName(agent.name);
      setNewAgentId(agent.id);
      setApiKeyCopied(false);
      setKeyDialogOpen(true);
      mutate();

      try {
        await Promise.all([
          createRule(agent.id, "require_approval_above", { amount: 25 }),
          createRule(agent.id, "max_per_day", { amount: 100 }),
        ]);
        toast.success(
          "Default safety rules applied — all purchases over $25 require your approval."
        );
        setRuleCounts((prev) => ({ ...prev, [agent.id]: 2 }));
      } catch {
        toast.warning(
          `Agent "${agent.name}" was created, but default rules could not be applied. Add rules manually on the Rules page.`
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to register agent"
      );
    } finally {
      setRegistering(false);
    }
  }

  function handleCopyKey() {
    if (newApiKey) {
      navigator.clipboard.writeText(newApiKey);
      setApiKeyCopied(true);
      setTimeout(() => setApiKeyCopied(false), 3000);
    }
  }

  function handleRevoked(id: string) {
    mutate(
      (prev) =>
        prev?.map((a) =>
          a.id === id ? { ...a, status: "revoked" as const } : a
        ) ?? []
    );
  }

  return (
    <div className="space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-heading">
            Agents
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Register and manage your AI agents
          </p>
        </div>
        <Button
          onClick={() => setRegisterOpen(true)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150"
        >
          <Plus className="h-4 w-4" />
          Register Agent
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive flex items-center justify-between">
          <span>Failed to load agents</span>
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-shimmer rounded-xl h-40" />
          ))}
        </div>
      ) : agents && agents.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onRevoked={handleRevoked}
              ruleCount={ruleCounts[agent.id] ?? null}
            />
          ))}
        </div>
      ) : (
        <Card className="border-slate-200 dark:border-slate-700">
          <CardContent className="flex flex-col items-center py-16">
            <Bot className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-base font-medium text-slate-900 dark:text-white">
              No agents yet
            </p>
            <p className="text-sm text-muted-foreground mt-1 mb-4 text-center max-w-xs">
              Register your first agent to get started. You&apos;ll receive an
              API key to use in your agent code.
            </p>
            <Button
              onClick={() => setRegisterOpen(true)}
              className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150"
            >
              <Plus className="h-4 w-4" />
              Register Agent
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Register Agent Dialog */}
      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register new agent</DialogTitle>
            <DialogDescription>
              Give your agent a descriptive name. You&apos;ll receive an API key
              to integrate into your agent code.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister}>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Agent name</Label>
                <Input
                  id="agent-name"
                  placeholder="e.g. Shopping Agent, Research Bot"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterOpen(false)}
                disabled={registering}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={registering || !agentName.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150"
              >
                {registering ? "Registering..." : "Register"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* API Key Dialog */}
      <Dialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agent registered: {newAgentName}</DialogTitle>
            <DialogDescription>
              Copy your API key now — it will never be shown again.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-slate-900 text-emerald-400 font-mono text-sm break-all select-all p-4">
              {newApiKey}
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 transition-colors duration-150"
              onClick={handleCopyKey}
            >
              {apiKeyCopied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy API key
                </>
              )}
            </Button>

            <div className="flex items-start gap-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Store this key now — it will never be shown again. Default safety rules have been applied (approval required above $25).
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              All requests require your approval until you set rules.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Link href={`/rules?agent=${newAgentId}`}>
              <Button
                variant="outline"
                onClick={() => setKeyDialogOpen(false)}
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 dark:text-indigo-400 dark:border-indigo-800"
              >
                View Rules
              </Button>
            </Link>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white transition-colors duration-150"
              onClick={() => setKeyDialogOpen(false)}
            >
              I&apos;ve saved the key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
