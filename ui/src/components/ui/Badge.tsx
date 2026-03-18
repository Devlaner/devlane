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
  default: "bg-(--bg-accent-subtle) text-(--txt-accent-primary)",
  success: "bg-(--bg-success-subtle) text-(--txt-success-primary)",
  warning: "bg-(--bg-warning-subtle) text-(--txt-warning-primary)",
  danger: "bg-(--bg-danger-subtle) text-(--txt-danger-primary)",
  neutral: "bg-(--bg-layer-1) text-(--txt-secondary)",
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
