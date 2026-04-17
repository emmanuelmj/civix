import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  change?: string;
  changeType?: "up" | "down" | "neutral";
  icon: string;
}

export function StatCard({ label, value, change, changeType = "neutral", icon }: StatCardProps) {
  const changeColor =
    changeType === "up"
      ? "var(--success)"
      : changeType === "down"
        ? "var(--danger)"
        : "var(--fg-muted)";

  return (
    <div
      className="rounded-xl p-5 border transition-shadow hover:shadow-sm"
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-light)",
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--fg-muted)" }}>
          {label}
        </span>
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--fg-primary)" }}>
        {value}
      </p>
      {change && (
        <p className="text-xs mt-1 font-medium" style={{ color: changeColor }}>
          {change}
        </p>
      )}
    </div>
  );
}

interface CardProps {
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-xl border ${className}`}
      style={{
        background: "var(--bg-card)",
        borderColor: "var(--border-light)",
      }}
    >
      {title && (
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-light)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--fg-primary)" }}>
            {title}
          </h3>
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
