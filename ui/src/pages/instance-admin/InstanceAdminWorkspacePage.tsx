import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Skeleton } from "../../components/ui";
import { workspaceService } from "../../services/workspaceService";
import { instanceSettingsService } from "../../services/instanceService";
import { getApiErrorMessage } from "../../api/client";
import type { InstanceGeneralSection } from "../../api/types";

export function InstanceAdminWorkspacePage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<
    Array<{ id: string; name: string; slug: string }>
  >([]);
  const [onlyAdminCanCreate, setOnlyAdminCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    workspaceService
      .list()
      .then((list) => {
        if (!cancelled) {
          setWorkspaces(
            list.map((w) => ({
              id: w.id,
              name: w.name,
              slug: w.slug,
            })),
          );
        }
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    instanceSettingsService
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const g = (settings.general || {}) as InstanceGeneralSection;
        setOnlyAdminCanCreate(Boolean(g.only_admin_can_create_workspace));
      })
      .catch(() => {
        if (!cancelled) setOnlyAdminCanCreate(false);
      })
      .finally(() => {
        if (!cancelled) setSettingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = () => {
    const next = !onlyAdminCanCreate;
    setError("");
    setSaving(true);
    instanceSettingsService
      .updateSection("general", { only_admin_can_create_workspace: next })
      .then(() => setOnlyAdminCanCreate(next))
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="w-full space-y-6">
        <div>
          <Skeleton className="h-4 w-56" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-md" />
        </div>
        <section className="flex items-start justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3">
          <div className="min-w-0 flex-1 space-y-1">
            <Skeleton className="h-3 w-72" />
            <Skeleton className="h-3 w-full max-w-lg" />
          </div>
          <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="space-y-1">
              <Skeleton className="h-3 w-52" />
              <Skeleton className="h-3 w-full max-w-sm" />
            </div>
          </div>
          <ul className="space-y-2">
            {[1, 2, 3].map((i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3"
              >
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-0.5 h-3 w-20" />
                </div>
                <Skeleton className="h-8 w-20 rounded" />
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-base font-semibold text-(--txt-primary)">
          Workspaces on this instance
        </h1>
        <p className="mt-0.5 text-xs text-(--txt-secondary)">
          See all workspaces and control who can create them.
        </p>
      </div>

      {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}

      <section className="flex items-start justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3">
        <div>
          <p className="text-xs font-medium text-(--txt-primary)">
            Prevent anyone else from creating a workspace.
          </p>
          <p className="mt-0.5 text-xs text-(--txt-secondary)">
            Toggling this on will let only you (the instance admin) create
            workspaces. You will have to invite users to new workspaces.
          </p>
        </div>
        <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-(--neutral-400) has-[:checked]:bg-(--brand-default)">
          <input
            type="checkbox"
            className="peer sr-only"
            checked={onlyAdminCanCreate}
            onChange={handleToggle}
            disabled={settingsLoading || saving}
          />
          <span className="pointer-events-none inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-disabled:opacity-50" />
        </label>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-(--txt-secondary)">
              All workspaces on this instance • {workspaces.length}
            </h2>
            <p className="mt-0.5 text-xs text-(--txt-secondary)">
              You can&apos;t yet delete workspaces and you can only go to the
              workspace if you are an Admin or a Member.
            </p>
          </div>
          <Button
            size="sm"
            type="button"
            className="text-xs"
            onClick={() => navigate("/instance-admin/workspace/create")}
          >
            Create workspace
          </Button>
        </div>
        {error && (
          <p className="mb-3 text-sm text-(--txt-danger-primary)">{error}</p>
        )}
        <ul className="space-y-2">
          {workspaces.map((w) => (
            <li
              key={w.id}
              className="flex items-center justify-between gap-3 rounded border border-(--border-subtle) bg-(--bg-surface-1) p-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-(--bg-layer-2) text-sm font-semibold text-(--txt-icon-secondary)">
                  {w.name.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--txt-primary)">
                    {w.name}
                  </p>
                  <p className="text-xs text-(--txt-tertiary)">[{w.slug}]</p>
                </div>
              </div>
              <Link
                to={`/${w.slug}`}
                className="flex size-8 shrink-0 items-center justify-center rounded text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
                aria-label="Go to workspace"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
