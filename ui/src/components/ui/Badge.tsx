import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--bg-accent-subtle)] text-[var(--txt-accent-primary)]",
  success: "bg-[var(--bg-success-subtle)] text-[var(--txt-success-primary)]",
  warning: "bg-[var(--bg-warning-subtle)] text-[var(--txt-warning-primary)]",
  danger: "bg-[var(--bg-danger-subtle)] text-[var(--txt-danger-primary)]",
  neutral: "bg-[var(--bg-layer-1)] text-[var(--txt-secondary)]",
};

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
