"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type TabId =
  | "Live Grid"
  | "Intake Feed"
  | "Swarm Log"
  | "Agent Canvas"
  | "Reports"
  | "Analytics"
  | "Officers"
  | "Settings";

interface DashboardContextValue {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<TabId>("Live Grid");

  return (
    <DashboardContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}
