import { useState } from "react";
import { useParams } from "react-router-dom";
import { Modal } from "../ui";
import { Button, Input } from "../ui";
import { viewService } from "../../services/viewService";
import {
  parseWorkspaceViewFiltersFromSearchParams,
  workspaceViewFiltersToSearchParams,
} from "../../types/workspaceViewFilters";
import { useSearchParams } from "react-router-dom";

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
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"filters" | "display">("filters");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceSlug?.trim() || !title.trim()) {
      setError("Title is required.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const filters = parseWorkspaceViewFiltersFromSearchParams(searchParams);
      const filterParams = workspaceViewFiltersToSearchParams(filters);
      await viewService.create(workspaceSlug, {
        name: title.trim(),
        description: description.trim() || undefined,
        filters: filterParams as Record<string, unknown>,
        display_filters: {},
        display_properties: {},
      });
      setTitle("");
      setDescription("");
      onClose();
      onCreated?.();
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
        <div className="flex gap-1 border-b border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setActiveTab("filters")}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === "filters"
                ? "border-b-2 border-[var(--brand-default)] text-[var(--txt-primary)]"
                : "text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
            }`}
          >
            Filters
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("display")}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === "display"
                ? "border-b-2 border-[var(--brand-default)] text-[var(--txt-primary)]"
                : "text-[var(--txt-secondary)] hover:text-[var(--txt-primary)]"
            }`}
          >
            Display
          </button>
        </div>
        {activeTab === "filters" && (
          <p className="text-sm text-[var(--txt-secondary)]">
            Current filters from the Views page will be saved with this view.
          </p>
        )}
        {activeTab === "display" && (
          <p className="text-sm text-[var(--txt-secondary)]">
            Display options can be configured after creating the view.
          </p>
        )}
        {error && (
          <p className="text-sm text-[var(--txt-danger-primary)]">{error}</p>
        )}
      </form>
    </Modal>
  );
}
