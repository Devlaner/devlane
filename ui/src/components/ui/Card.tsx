import { type HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "elevated" | "outlined";
}

export function Card({
  className,
  variant = "outlined",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--bg-layer-2)]",
        variant === "elevated" &&
          "border border-[var(--border-subtle)] shadow-[var(--shadow-raised)]",
        variant === "outlined" && "border border-[var(--border-subtle)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Props for card header; extends div attributes. Kept as type for future props. */
export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

export function CardHeader({ className, children, ...props }: CardHeaderProps) {
  return (
    <div
      className={cn(
        "border-b border-[var(--border-subtle)] px-4 py-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Props for card content; extends div attributes. Kept as type for future props. */
export type CardContentProps = HTMLAttributes<HTMLDivElement>;

export function CardContent({
  className,
  children,
  ...props
}: CardContentProps) {
  return (
    <div className={cn("p-4", className)} {...props}>
      {children}
    </div>
  );
}
