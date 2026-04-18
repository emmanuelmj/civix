"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDashboard, type TabId } from "@/lib/dashboard-context";

interface SidebarProps {
  onNavigate?: () => void;
}

const navItems: { label: TabId; icon: string; href: string }[] = [
  { label: "Live Grid",       icon: "◫", href: "/" },
  { label: "Intake Feed",     icon: "◉", href: "/intake" },
  { label: "Swarm Log",       icon: "⧉", href: "/swarm-log" },
  { label: "Agent Canvas",    icon: "⬡", href: "/canvas" },
  { label: "Knowledge Graph", icon: "◈", href: "/graph" },
  { label: "Leaderboard",     icon: "▦", href: "/leaderboard" },
  { label: "Reports",         icon: "▤", href: "/reports" },
  { label: "Analytics",       icon: "◔", href: "/analytics" },
  { label: "Officers",        icon: "⊕", href: "/officers" },
  { label: "Settings",        icon: "⚙", href: "/settings" },
];

export function Sidebar({ onNavigate }: SidebarProps) {
  const { setActiveTab } = useDashboard();
  const pathname = usePathname();
  const router = useRouter();

  const handleClick = (item: typeof navItems[number]) => {
    // Keep legacy activeTab in sync for any component still reading it,
    // then perform a real URL navigation so browser back/forward + deep-links work.
    setActiveTab(item.label);
    router.push(item.href);
    onNavigate?.(); // close mobile sidebar
  };

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 w-52 flex flex-col border-r z-30"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)", boxShadow: "var(--shadow-card)" }}
    >
      {/* Logo */}
      <div className="px-4 py-4 border-b" style={{ borderColor: "var(--border-light)" }}>
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "var(--accent-blue-dim)", color: "var(--accent-blue)" }}>
            CP
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: "var(--accent-green)" }} />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight" style={{ color: "var(--fg-primary)" }}>
              Civix Pulse
            </span>
            <p className="text-[10px] font-mono" style={{ color: "var(--fg-muted)" }}>v0.1.0</p>
          </div>
        </div>
      </div>

      {/* Nav — real Next.js Links so URL changes + prefetching works */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              prefetch
              onClick={() => handleClick(item)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all"
              style={{
                background: isActive ? "var(--accent-blue-dim)" : "transparent",
                color: isActive ? "var(--accent-blue)" : "var(--fg-secondary)",
              }}
            >
              <span className="text-sm opacity-70">{item.icon}</span>
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-blue)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* System status */}
      <div className="px-3 py-3 border-t" style={{ borderColor: "var(--border-light)" }}>
        <div className="px-2 py-2 rounded-md" style={{ background: "var(--bg-surface)" }}>
          <p className="text-[10px] font-mono uppercase tracking-wider mb-1.5" style={{ color: "var(--fg-muted)" }}>
            System
          </p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)" }} />
            <span className="text-[11px] font-mono" style={{ color: "var(--accent-green)" }}>
              All agents online
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
