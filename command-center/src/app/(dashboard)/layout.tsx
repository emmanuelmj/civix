"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { DashboardProvider } from "@/lib/dashboard-context";
import { PulseProvider } from "@/lib/pulse-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <DashboardProvider>
      <PulseProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar — hidden on mobile, fixed on desktop */}
        <div className={`
          fixed inset-y-0 left-0 w-52 z-30 transition-transform duration-200
          lg:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}>
          <Sidebar onNavigate={() => setSidebarOpen(false)} />
        </div>

        <div className="flex-1 lg:ml-52 flex flex-col min-h-0">
          <Topbar onMenuToggle={() => setSidebarOpen(v => !v)} />
          <main className="flex-1 min-h-0 overflow-hidden" style={{ background: "var(--bg-base)" }}>
            {children}
          </main>
        </div>
      </div>
      </PulseProvider>
    </DashboardProvider>
  );
}
