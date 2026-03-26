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
  Settings,
  Activity,
  LogOut,
  Menu,
  X,
  Shield,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import useSWR from "swr";
import { getRequests } from "@/lib/api";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/pending", label: "Pending", icon: Clock },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/rules", label: "Rules", icon: Settings },
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
      <Button variant="ghost" size="sm" className="w-full justify-start gap-3 text-muted-foreground">
        <Monitor className="h-4 w-4" />
        Theme
      </Button>
    );
  }

  const cycleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground transition-colors duration-150"
      onClick={cycleTheme}
    >
      <Icon className="h-4 w-4" />
      {label} mode
    </Button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: pendingRequests } = useSWR(
    "pending-requests",
    () => getRequests("pending"),
    { refreshInterval: 10000 }
  );
  const pendingCount = pendingRequests?.length ?? 0;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const NavContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5 border-b border-border">
        <Shield className="h-6 w-6 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
        <span className="font-semibold text-lg tracking-tight">AgentGate</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 mb-2">
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
                    : "text-muted-foreground hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-foreground"
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
      <div className="px-3 py-3 border-t border-border space-y-1">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground transition-colors duration-150"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-card h-screen sticky top-0">
        <NavContent />
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <span className="font-semibold">AgentGate</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
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
          "md:hidden fixed top-0 left-0 z-40 flex flex-col w-64 h-full bg-card border-r border-border transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
