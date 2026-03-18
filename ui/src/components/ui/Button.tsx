import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-(--bg-accent-primary) text-(--txt-on-color) hover:bg-(--bg-accent-primary-hover) active:bg-(--bg-accent-primary-active) disabled:opacity-50",
  secondary:
    "bg-(--bg-layer-1) text-(--txt-primary) border border-(--border-subtle) hover:bg-(--bg-layer-1-hover) active:bg-(--bg-layer-1-active) disabled:opacity-50",
  ghost:
    "bg-transparent text-(--txt-primary) hover:bg-(--bg-layer-1) active:bg-(--bg-layer-1-hover) disabled:opacity-50",
  danger:
    "bg-(--bg-danger-primary) text-(--txt-on-color) hover:bg-(--bg-danger-primary-hover) active:opacity-90 disabled:opacity-50",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-(--radius-md)",
  md: "h-9 px-4 text-sm rounded-(--radius-md)",
  lg: "h-10 px-5 text-base rounded-(--radius-lg)",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus:outline-none",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        disabled={disabled ?? isLoading}
        {...props}
      >
        {isLoading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
