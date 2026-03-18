import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Input } from "../../components/ui";
import { CreateWorkspaceSetupHint } from "../../components/instance-admin/CreateWorkspaceSetupHint";
import { useAuth } from "../../contexts/AuthContext";
import { workspaceService } from "../../services/workspaceService";
import { getApiErrorMessage } from "../../api/client";
import { slugFromName, validateWorkspaceSlug } from "../../utils/workspace";
import { ORGANIZATION_SIZE_OPTIONS } from "../../constants/workspace";

const IconChevronDown = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function InstanceAdminCreateWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [organizationSize, setOrganizationSize] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSetupHint, setShowSetupHint] = useState(false);

  const baseUrl =
    typeof window !== "undefined" ? `${window.location.origin}/` : "";

  useEffect(() => {
    const fromSetup =
      (location.state as { fromSetup?: boolean })?.fromSetup ?? false;
    setShowSetupHint(fromSetup);
  }, [location.state]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setName(next);
    if (!slug || slug === slugFromName(name)) {
      setSlug(slugFromName(next));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim().toLowerCase() || slugFromName(trimmedName);

    if (!trimmedName) {
      setError("Please enter a workspace name.");
      return;
    }
    if (!validateWorkspaceSlug(trimmedSlug)) {
      setError(
        "Workspace URL must be lowercase letters, numbers, and hyphens only.",
      );
      return;
    }
    if (!isAuthenticated || !user) {
      setError(
        "You need to be signed in to the app to create a workspace. Sign in from the main app, then return here.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await workspaceService.create({ name: trimmedName, slug: trimmedSlug });
      setShowSetupHint(false);
      navigate("/instance-admin/workspace", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div>
        <h1 className="text-base font-semibold text-(--txt-primary)">
          Create a new workspace on this instance.
        </h1>
        <p className="mt-1 text-sm text-(--txt-secondary)">
          You will need to invite users from Workspace Settings after you create
          this workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-5">
        <Input
          label="Name your workspace"
          value={name}
          onChange={handleNameChange}
          placeholder="Something familiar and recognizable is always best."
          autoComplete="organization"
        />

        <div className="flex flex-col gap-1">
          <label
            htmlFor="workspace-url"
            className="text-sm font-medium text-(--txt-secondary)"
          >
            Set your workspace&apos;s URL
          </label>
          <div className="flex flex-1 items-center gap-0 overflow-hidden rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) text-sm">
            <span className="shrink-0 truncate border-r border-(--border-subtle) bg-(--bg-layer-1) px-3 py-2 text-(--txt-tertiary)">
              {baseUrl}
            </span>
            <input
              id="workspace-url"
              type="text"
              value={slug}
              onChange={(e) =>
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
              }
              placeholder="workspace-name"
              className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2 text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="organization-size"
            className="text-sm font-medium text-(--txt-secondary)"
          >
            How many people will use this workspace?
          </label>
          <div className="relative">
            <select
              id="organization-size"
              value={organizationSize}
              onChange={(e) => setOrganizationSize(e.target.value)}
              className="h-9 w-full max-w-md appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) pl-3 pr-9 text-sm text-(--txt-primary) focus:outline-none"
            >
              {ORGANIZATION_SIZE_OPTIONS.map((opt) => (
                <option key={opt.value || "empty"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
              <IconChevronDown />
            </span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-(--txt-danger-primary)">{error}</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create workspace"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate("/instance-admin/workspace")}
          >
            Go back
          </Button>
        </div>
      </form>

      {showSetupHint && (
        <CreateWorkspaceSetupHint onDismiss={() => setShowSetupHint(false)} />
      )}
    </div>
  );
}
