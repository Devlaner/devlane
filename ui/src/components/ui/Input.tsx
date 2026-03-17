import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-(--txt-secondary)"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-9 w-full rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none",
            error && "border-(--border-danger-strong)",
            className,
          )}
          {...props}
        />
        {error && (
          <span className="text-xs text-(--txt-danger-primary)">{error}</span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
