import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { ChevronRight, Folder, FolderPlus, IterationCw, LayoutGrid, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FavoriteApiResponse } from '../../api/types';
import { useWorkspaceFavorites } from '../../hooks/useWorkspaceFavorites';

function entityHref(baseUrl: string, fav: FavoriteApiResponse): string | null {
  if (!fav.project_id) return null;
  const p = `${baseUrl}/projects/${fav.project_id}`;
  if (fav.entity_type === 'cycle') return `${p}/cycles/${fav.entity_identifier}`;
  if (fav.entity_type === 'module') return `${p}/modules/${fav.entity_identifier}`;
  return null;
}

function EntityIcon({ type }: { type: string }) {
  if (type === 'cycle') return <IterationCw className="size-3.5" />;
  return <LayoutGrid className="size-3.5" />;
}

/**
 * Renders the workspace favorites tree (cycle/module favorites grouped into
 * folders, ordered) with create-folder, drag-to-reorder, drag-into-folder, and
 * remove. Persists every change through the favorites API.
 */
export function WorkspaceFavoritesTree({
  workspaceSlug,
  baseUrl,
}: {
  workspaceSlug: string;
  baseUrl: string;
}) {
  const { t } = useTranslation();
  const { favorites, updateFavorite, removeById, createFolder } =
    useWorkspaceFavorites(workspaceSlug);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const { roots, childrenByFolder } = useMemo(() => {
    const byParent = new Map<string, FavoriteApiResponse[]>();
    const top: FavoriteApiResponse[] = [];
    for (const f of favorites) {
      if (f.parent_id) {
        byParent.set(f.parent_id, [...(byParent.get(f.parent_id) ?? []), f]);
      } else {
        top.push(f);
      }
    }
    return { roots: top, childrenByFolder: byParent };
  }, [favorites]);

  if (favorites.length === 0) {
    return (
      <button
        type="button"
        onClick={() => void createFolder(t('nav.newFolder', 'New folder'))}
        className="flex w-full items-center gap-2 rounded-(--radius-md) px-2 py-1 text-[13px] text-(--txt-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-secondary)"
      >
        <FolderPlus className="size-3.5" /> {t('nav.newFavoritesFolder', 'New favorites folder')}
      </button>
    );
  }

  const moveInto = (id: string, parentId: string | null) => {
    if (id === parentId) return;
    void updateFavorite(id, { parent_id: parentId });
  };
  const reorderBefore = (id: string, target: FavoriteApiResponse) => {
    if (id === target.id) return;
    void updateFavorite(id, {
      parent_id: target.parent_id ?? null,
      sort_order: target.sort_order - 1,
    });
  };

  const Row = ({ fav, nested }: { fav: FavoriteApiResponse; nested: boolean }) => {
    const href = entityHref(baseUrl, fav);
    const isDrop = dropTarget === fav.id;
    const dragHandlers = {
      draggable: true,
      onDragStart: () => setDragId(fav.id),
      onDragEnd: () => {
        setDragId(null);
        setDropTarget(null);
      },
      onDragOver: (e: React.DragEvent) => {
        if (dragId && dragId !== fav.id) {
          e.preventDefault();
          setDropTarget(fav.id);
        }
      },
      onDragLeave: () => setDropTarget((t) => (t === fav.id ? null : t)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault();
        if (!dragId || dragId === fav.id) return;
        if (fav.is_folder) moveInto(dragId, fav.id);
        else reorderBefore(dragId, fav);
        setDropTarget(null);
        setDragId(null);
      },
    };

    const rowClass = cn(
      'group flex items-center gap-2 rounded-(--radius-md) px-2 py-1 text-[13px]',
      nested && 'ml-4',
      isDrop && 'ring-1 ring-(--brand-default)',
    );

    if (fav.is_folder) {
      const kids = childrenByFolder.get(fav.id) ?? [];
      const open = expanded[fav.id] ?? true;
      return (
        <div>
          <div className={cn(rowClass, 'text-(--txt-secondary)')} {...dragHandlers}>
            <button
              type="button"
              onClick={() => setExpanded((e) => ({ ...e, [fav.id]: !open }))}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              <ChevronRight
                className={cn(
                  'size-3.5 text-(--txt-icon-tertiary) transition',
                  open && 'rotate-90',
                )}
              />
              <Folder className="size-3.5 text-(--txt-icon-tertiary)" />
              <span className="truncate">{fav.name}</span>
              <span className="text-xs text-(--txt-tertiary)">{kids.length}</span>
            </button>
            <button
              type="button"
              aria-label={t('nav.deleteFolder', 'Delete folder')}
              onClick={() => void removeById(fav.id)}
              className="opacity-0 transition group-hover:opacity-100"
            >
              <X className="size-3.5 text-(--txt-icon-tertiary) hover:text-(--txt-danger-primary)" />
            </button>
          </div>
          {open && kids.map((k) => <Row key={k.id} fav={k} nested />)}
        </div>
      );
    }

    return (
      <div className={rowClass} {...dragHandlers}>
        <NavLink
          to={href ?? '#'}
          className={({ isActive }) =>
            cn(
              'flex min-w-0 flex-1 items-center gap-2 outline-none',
              isActive
                ? 'text-(--txt-primary)'
                : 'text-(--txt-secondary) hover:text-(--txt-primary)',
            )
          }
        >
          <span className="text-(--txt-icon-tertiary)">
            <EntityIcon type={fav.entity_type} />
          </span>
          <span className="truncate">{fav.name}</span>
        </NavLink>
        <button
          type="button"
          aria-label={t('nav.removeFavorite', 'Remove favorite')}
          onClick={() => void removeById(fav.id)}
          className="opacity-0 transition group-hover:opacity-100"
        >
          <X className="size-3.5 text-(--txt-icon-tertiary) hover:text-(--txt-danger-primary)" />
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-0.5">
      {roots.map((fav) => (
        <Row key={fav.id} fav={fav} nested={false} />
      ))}
      <button
        type="button"
        onClick={() => void createFolder(t('nav.newFolder', 'New folder'))}
        onDragOver={(e) => {
          if (dragId) e.preventDefault();
        }}
        onDrop={() => {
          if (dragId) moveInto(dragId, null);
          setDragId(null);
        }}
        className="mt-0.5 flex items-center gap-2 rounded-(--radius-md) px-2 py-1 text-[13px] text-(--txt-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-secondary)"
      >
        <FolderPlus className="size-3.5" /> {t('nav.newFolder', 'New folder')}
      </button>
    </div>
  );
}
