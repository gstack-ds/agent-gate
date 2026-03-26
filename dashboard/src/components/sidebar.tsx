"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Clock,
  Bot,
  Settings2,
  Activity,
  LogOut,
  Menu,
  X,
  Shield,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { getDashboardStats } from "@/lib/api";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/pending", label: "Pending Requests", icon: Clock },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/rules", label: "Rules", icon: Settings2 },
  { href: "/activity", label: "Activity", icon: Activity },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150">
        <Sun className="h-4 w-4" />
        Theme
      </button>
    );
  }

  const cycleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const Icon = theme === "dark" ? Moon : Sun;
  const label = theme === "dark" ? "Dark" : "Light";

  return (
    <button
      className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150"
      onClick={cycleTheme}
    >
      <Icon className="h-4 w-4" />
      {label} mode
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: stats } = useSWR("dashboard-stats-sidebar", getDashboardStats, {
    refreshInterval: 15000,
  });
  const pendingCount = stats?.pending ?? 0;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-slate-800">
        <Shield className="h-6 w-6 text-indigo-400 flex-shrink-0" />
        <span className="font-semibold text-lg text-white tracking-tight">AgentGate</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 px-3 mb-2">
          Navigation
        </p>
        <div className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            const isPending = href === "/pending";
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span className="flex-1">{label}</span>
                {isPending && pendingCount > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center h-5 min-w-[20px] rounded-full text-xs font-bold px-1.5",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-amber-500 text-white"
                    )}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-slate-800 space-y-1">
        <ThemeToggle />
        <div className="px-3 py-2">
          <span className="bg-slate-800 text-slate-400 text-xs px-3 py-1 rounded inline-block">
            Free plan
          </span>
        </div>
        <button
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors duration-150"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 h-screen sticky top-0 bg-slate-900">
        <NavContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-400" />
          <span className="font-semibold text-white">AgentGate</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="text-slate-300 hover:text-white hover:bg-slate-800"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "md:hidden fixed top-0 left-0 z-40 flex flex-col w-64 h-full bg-slate-900 border-r border-slate-800 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
