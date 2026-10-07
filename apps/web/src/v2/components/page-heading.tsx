import type { ReactNode } from 'react';

interface PageHeadingProps {
  title: ReactNode;
  description: ReactNode;
  summary?: ReactNode;
}

export function PageHeading({ title, description, summary }: PageHeadingProps) {
  return (
    <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{description}</p>
      </div>
      {summary !== undefined && (
        <p className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
          {summary}
        </p>
      )}
    </header>
  );
}
