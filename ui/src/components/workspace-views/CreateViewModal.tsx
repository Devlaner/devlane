import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Modal } from "../ui";
import { Button, Input } from "../ui";
import { Dropdown } from "../work-item";
import { useWorkspaceViewsState } from "../../contexts/WorkspaceViewsStateContext";
import { viewService } from "../../services/viewService";
import { workspaceViewFiltersToSearchParams } from "../../types/workspaceViewFilters";
import type { DisplayPropertyKey } from "../../types/workspaceViewDisplay";
import type { WorkspaceViewFilters } from "../../types/workspaceViewFilters";
import type { WorkspaceViewDisplay } from "../../types/workspaceViewDisplay";
import { WorkspaceViewsFiltersPanel } from "./WorkspaceViewsFiltersPanel";
import { WorkspaceViewsDisplayPanel } from "./WorkspaceViewsDisplayPanel";

export interface CreateViewModalProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateViewModal({
  open,
  onClose,
  onCreated,
}: CreateViewModalProps) {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const navigate = useNavigate();
  const { filters: contextFilters, display: contextDisplay } =
    useWorkspaceViewsState();
  const [openPanel, setOpenPanel] = useState<
    "create-view-filters" | "create-view-display" | null
  >(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [localFilters, setLocalFilters] =
    useState<WorkspaceViewFilters>(contextFilters);
  const [localDisplay, setLocalDisplay] =
    useState<WorkspaceViewDisplay>(contextDisplay);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLocalFilters(contextFilters);
      setLocalDisplay(contextDisplay);
    }
  }, [open, contextFilters, contextDisplay]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug?.trim() || !title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const filterParams = workspaceViewFiltersToSearchParams(localFilters);
      const display_properties: Record<string, boolean> = {};
      localDisplay.properties.forEach((k: DisplayPropertyKey) => {
        display_properties[k] = true;
      });
      const display_filters: Record<string, unknown> = {
        sub_issue: localDisplay.showSubWorkItems,
        layout: localDisplay.layout,
      };
      const created = await viewService.create(workspaceSlug, {
        name: title.trim(),
        description: description.trim() || undefined,
        filters: filterParams as Record<string, unknown>,
        display_filters,
        display_properties,
      });
      setTitle("");
      setDescription("");
      onClose();
      onCreated?.();
      navigate(`/${workspaceSlug}/views/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create view.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create View"
      className="max-w-lg"
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-view-form"
            disabled={submitting || !title.trim()}
          >
            Create View
          </Button>
        </>
      }
    >
      <form id="create-view-form" onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="View name"
          autoFocus
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--txt-secondary)]">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dropdown
            id="create-view-filters"
            openId={openPanel}
            onOpen={(id) =>
              setOpenPanel(
                id as "create-view-filters" | "create-view-display" | null,
              )
            }
            label="Filters"
            icon={null}
            displayValue=""
            triggerContent={<span>Filters</span>}
            triggerClassName="inline-flex items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            panelClassName="flex w-[280px] max-h-[min(70vh,28rem)] flex-col rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-raised)] overflow-hidden"
            align="left"
          >
            {workspaceSlug && (
              <WorkspaceViewsFiltersPanel
                filters={localFilters}
                onFiltersChange={setLocalFilters}
                workspaceSlug={workspaceSlug}
                onCloseParent={() => setOpenPanel(null)}
                compact
              />
            )}
          </Dropdown>
          <Dropdown
            id="create-view-display"
            openId={openPanel}
            onOpen={(id) =>
              setOpenPanel(
                id as "create-view-filters" | "create-view-display" | null,
              )
            }
            label="Display"
            icon={null}
            displayValue=""
            triggerContent={<span>Display</span>}
            triggerClassName="inline-flex items-center justify-center rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-3 py-2 text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)]"
            panelClassName="flex min-w-[280px] max-w-[320px] flex-col rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] shadow-[var(--shadow-raised)] overflow-hidden"
            align="left"
          >
            <WorkspaceViewsDisplayPanel
              display={localDisplay}
              onDisplayChange={setLocalDisplay}
            />
          </Dropdown>
        </div>
        {error && (
          <p className="text-sm text-[var(--txt-danger-primary)]">{error}</p>
        )}
      </form>
    </Modal>
  );
}
