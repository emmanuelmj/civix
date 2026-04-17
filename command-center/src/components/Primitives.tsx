import { ReactNode } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent";

const variantStyles: Record<BadgeVariant, { bg: string; color: string }> = {
  default: { bg: "var(--bg-surface)", color: "var(--fg-secondary)" },
  success: { bg: "#dcf5e7", color: "var(--success)" },
  warning: { bg: "#fef3dc", color: "var(--warning)" },
  danger: { bg: "#fde8e6", color: "var(--danger)" },
  accent: { bg: "var(--accent-soft)", color: "var(--accent)" },
};

export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  const style = variantStyles[variant];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {children}
    </span>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base = "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

  const variants: Record<ButtonVariant, string> = {
    primary: "",
    secondary: "",
    ghost: "",
  };

  const variantInline: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: "var(--accent)",
      color: "#fff",
    },
    secondary: {
      background: "var(--bg-surface)",
      color: "var(--fg-primary)",
      border: "1px solid var(--border)",
    },
    ghost: {
      background: "transparent",
      color: "var(--fg-secondary)",
    },
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      style={variantInline[variant]}
      {...props}
    >
      {children}
    </button>
  );
}
