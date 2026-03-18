import { useEffect, useState } from "react";
import { Button, IconEye, IconEyeOff, Skeleton } from "../../components/ui";
import { instanceSettingsService } from "../../services/instanceService";
import { getApiErrorMessage } from "../../api/client";
import type { InstanceImageSection } from "../../api/types";

export function InstanceAdminImagePage() {
  const [image, setImage] = useState<InstanceImageSection>({
    unsplash_access_key_set: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAccessKey, setShowAccessKey] = useState(false);
  const [accessKeyLocal, setAccessKeyLocal] = useState<string | undefined>(
    undefined,
  );
  const [error, setError] = useState("");

  const accessKeyDisplay =
    accessKeyLocal !== undefined
      ? accessKeyLocal
      : (image.unsplash_access_key ?? "");

  useEffect(() => {
    let cancelled = false;
    instanceSettingsService
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const i = (settings.image || {}) as InstanceImageSection;
        setImage({
          unsplash_access_key_set: i.unsplash_access_key_set ?? false,
          unsplash_access_key: i.unsplash_access_key ?? "",
        });
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

  const handleSave = () => {
    setError("");
    setSaving(true);
    const accessKeyToSend =
      accessKeyLocal !== undefined ? accessKeyLocal : image.unsplash_access_key;
    const payload: InstanceImageSection = {
      ...image,
      unsplash_access_key: accessKeyToSend ?? "",
    };
    instanceSettingsService
      .updateSection(
        "image",
        payload as import("../../api/types").InstanceSettingSectionValue,
      )
      .then((res) => {
        setAccessKeyLocal(undefined);
        if (res.value)
          setImage((p) => ({ ...p, ...res.value }) as InstanceImageSection);
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl space-y-6">
        <div>
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-md" />
        </div>
        <section className="space-y-3">
          <div>
            <Skeleton className="h-3 w-44" />
            <Skeleton className="mt-0.5 h-8 w-full rounded" />
            <Skeleton className="mt-0.5 h-3 w-56" />
          </div>
        </section>
        <Skeleton className="h-8 w-24 rounded" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-base font-semibold text-(--txt-primary)">
          Third-party image libraries
        </h1>
        <p className="mt-0.5 text-xs text-(--txt-secondary)">
          Let your users search and choose images from third-party libraries.
        </p>
      </div>

      {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}

      <section className="space-y-3">
        <label className="block text-xs font-medium text-(--txt-secondary)">
          Access key from your Unsplash account
          <div className="relative mt-0.5">
            <input
              type={showAccessKey ? "text" : "password"}
              value={accessKeyDisplay}
              onChange={(e) => setAccessKeyLocal(e.target.value)}
              onFocus={() => {
                if (accessKeyLocal === undefined)
                  setAccessKeyLocal(accessKeyDisplay);
              }}
              placeholder={!accessKeyDisplay ? "Enter access key" : ""}
              className="block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 pr-9 text-xs text-(--txt-primary) focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowAccessKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
              aria-label={showAccessKey ? "Hide access key" : "Show access key"}
            >
              {showAccessKey ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">
            You will find your access key in your Unsplash developer console.{" "}
            <a
              href="https://unsplash.com/developers/docs/api-reference/access-key"
              target="_blank"
              rel="noopener noreferrer"
              className="text-(--txt-accent-primary) underline hover:no-underline"
            >
              Learn more.
            </a>
          </p>
        </label>
      </section>

      <Button
        size="sm"
        className="text-xs"
        onClick={handleSave}
        disabled={saving}
      >
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </div>
  );
}
