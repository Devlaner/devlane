import { Bot, CheckCircle2, CircleAlert, Clock3, LoaderCircle, PauseCircle } from 'lucide-react';
import type { AgentRunStatus } from '../../api/types';

export function AgentMark({ name, enabled = true }: { name: string; enabled?: boolean }) {
  return (
    <span
      className={`relative flex size-9 shrink-0 items-center justify-center rounded-md border border-(--border-subtle) ${
        enabled
          ? 'bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
          : 'bg-(--bg-layer-1) text-(--txt-tertiary)'
      }`}
      aria-label={`${name} agent`}
    >
      <Bot className="size-4.5" aria-hidden />
      <span
        className={`absolute -bottom-1 -right-1 size-2.5 rounded-full border-2 border-(--bg-surface-1) ${
          enabled ? 'bg-green-500' : 'bg-(--neutral-400)'
        }`}
        aria-hidden
      />
    </span>
  );
}

const RUN_STATUS: Record<
  AgentRunStatus,
  { label: string; className: string; icon: typeof Clock3 }
> = {
  queued: { label: 'Queued', className: 'text-(--txt-warning-primary)', icon: Clock3 },
  running: { label: 'Running', className: 'text-(--txt-accent-primary)', icon: LoaderCircle },
  needs_review: {
    label: 'Needs review',
    className: 'text-(--txt-warning-primary)',
    icon: CircleAlert,
  },
  completed: { label: 'Completed', className: 'text-(--txt-success-primary)', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'text-(--txt-danger-primary)', icon: CircleAlert },
  cancelled: { label: 'Cancelled', className: 'text-(--txt-tertiary)', icon: PauseCircle },
};

export function AgentRunStatusBadge({ status }: { status: AgentRunStatus }) {
  const config = RUN_STATUS[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.className}`}>
      <Icon className={`size-3.5 ${status === 'running' ? 'animate-spin' : ''}`} aria-hidden />
      {config.label}
    </span>
  );
}
