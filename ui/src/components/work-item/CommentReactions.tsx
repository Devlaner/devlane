import { useEffect, useRef, useState } from 'react';
import { SmilePlus } from 'lucide-react';
import { commentService } from '../../services/commentService';
import type { CommentReactionApiResponse } from '../../api/types';

const QUICK_EMOJIS = ['👍', '🎉', '❤️', '🚀', '👀', '😄'];

interface CommentReactionsProps {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  commentId: string;
  /** ID of the current user — needed to know which reactions are "mine" so we can toggle. */
  currentUserId?: string | null;
}

/**
 * Renders the reactions row under a comment + a small "add reaction" button.
 *
 * The picker is intentionally minimal — six common emojis. A real picker
 * (with categories and search) would be a much bigger component; we can
 * always swap it later.
 */
export function CommentReactions({
  workspaceSlug,
  projectId,
  issueId,
  commentId,
  currentUserId,
}: CommentReactionsProps) {
  const [reactions, setReactions] = useState<CommentReactionApiResponse[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    commentService
      .listReactions(workspaceSlug, projectId, issueId, commentId)
      .then((list) => {
        if (!cancelled) setReactions(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setReactions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceSlug, projectId, issueId, commentId]);

  // Close picker on outside click.
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  // Group by emoji, count, and remember if I reacted.
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const cur = grouped.get(r.reaction) ?? { count: 0, mine: false };
    cur.count += 1;
    if (currentUserId && r.actor_id === currentUserId) cur.mine = true;
    grouped.set(r.reaction, cur);
  }

  const toggle = async (emoji: string) => {
    const existing = grouped.get(emoji);
    setPickerOpen(false);
    try {
      if (existing?.mine) {
        await commentService.removeReaction(workspaceSlug, projectId, issueId, commentId, emoji);
      } else {
        await commentService.addReaction(workspaceSlug, projectId, issueId, commentId, emoji);
      }
      // Refetch — small list, simpler than reconciling locally.
      const next = await commentService.listReactions(workspaceSlug, projectId, issueId, commentId);
      setReactions(next ?? []);
    } catch {
      // best-effort; a missing reaction or network blip shouldn't disrupt the UX
    }
  };

  if (grouped.size === 0 && !pickerOpen) {
    return (
      <div ref={wrapperRef} className="relative mt-1.5">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-(--radius-md) px-1.5 py-0.5 text-[11px] text-(--txt-tertiary) opacity-0 transition-opacity hover:bg-(--bg-layer-1-hover) hover:text-(--txt-secondary) group-hover/comment:opacity-100"
          onClick={() => setPickerOpen(true)}
          aria-label="Add reaction"
        >
          <SmilePlus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="relative mt-1.5 flex flex-wrap items-center gap-1">
      {[...grouped.entries()].map(([emoji, info]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => void toggle(emoji)}
          className={`inline-flex h-6 items-center gap-1 rounded-(--radius-md) border px-1.5 text-[11px] transition-colors ${
            info.mine
              ? 'border-(--bg-accent-primary) bg-(--bg-accent-subtle) text-(--txt-accent-primary)'
              : 'border-(--border-subtle) bg-(--bg-surface-1) text-(--txt-secondary) hover:bg-(--bg-layer-1-hover)'
          }`}
          aria-label={`${emoji} ${info.count}`}
        >
          <span>{emoji}</span>
          <span>{info.count}</span>
        </button>
      ))}
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-(--radius-md) text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
        onClick={() => setPickerOpen((v) => !v)}
        aria-label="Add reaction"
      >
        <SmilePlus className="h-3.5 w-3.5" />
      </button>
      {pickerOpen && (
        <div className="absolute left-0 top-full z-20 mt-1 inline-flex items-center gap-0.5 rounded-md border border-(--border-subtle) bg-(--bg-surface-1) px-1.5 py-1 shadow-(--shadow-raised)">
          {QUICK_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => void toggle(e)}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-base hover:bg-(--bg-layer-1-hover)"
              aria-label={`React with ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
