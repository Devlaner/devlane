import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SettingsPanelProps {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or filters that belong with the panel heading. */
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Heading + body for one settings section. */
export function SettingsPanel({
  title,
  description,
  actions,
  className,
  children,
}: SettingsPanelProps) {
  return (
    <section className={cn('flex flex-col gap-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

interface SettingRowProps {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  /** The row's control. Labelled by the row title via `titleId` when given. */
  control: ReactNode;
  titleId?: string;
  /** Extra content under the description, e.g. a dependent select. */
  children?: ReactNode;
}

/** A bordered "label + description on the left, control on the right" row. */
export function SettingRow({
  title,
  description,
  icon,
  control,
  titleId,
  children,
}: SettingRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <p id={titleId} className="text-sm font-medium">
            {title}
          </p>
          {description && <p className="text-muted-foreground mt-0.5 text-sm">{description}</p>}
          {children}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{control}</div>
    </div>
  );
}

/** Reads an API error message, falling back to a translated default. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  const data = (error as { response?: { data?: { error?: string } } })?.response?.data;
  return typeof data?.error === 'string' ? data.error : fallback;
}
