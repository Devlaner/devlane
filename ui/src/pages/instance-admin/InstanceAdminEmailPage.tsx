import { useEffect, useState } from "react";
import { Button, IconEye, IconEyeOff, Skeleton } from "../../components/ui";
import { instanceSettingsService } from "../../services/instanceService";
import { getApiErrorMessage } from "../../api/client";
import type { InstanceEmailSection } from "../../api/types";

export function InstanceAdminEmailPage() {
  const [email, setEmail] = useState<InstanceEmailSection>({
    host: "",
    port: "587",
    sender_email: "",
    security: "TLS",
    username: "",
    password_set: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [smtpPasswordLocal, setSmtpPasswordLocal] = useState<
    string | undefined
  >(undefined); // undefined = show stored mask, '' = user cleared, string = user typed
  const [error, setError] = useState("");

  const smtpPasswordDisplay =
    smtpPasswordLocal !== undefined
      ? smtpPasswordLocal
      : (email.password ?? "");

  useEffect(() => {
    let cancelled = false;
    instanceSettingsService
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const e = (settings.email || {}) as InstanceEmailSection;
        setEmail({
          host: e.host ?? "",
          port: e.port ?? "587",
          sender_email: e.sender_email ?? "",
          security: e.security ?? "TLS",
          username: e.username ?? "",
          password_set: e.password_set ?? false,
          password: e.password ?? "",
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
    const passwordToSend =
      smtpPasswordLocal !== undefined ? smtpPasswordLocal : email.password;
    const payload: InstanceEmailSection = {
      ...email,
      password: passwordToSend ?? "",
    };
    instanceSettingsService
      .updateSection(
        "email",
        payload as import("../../api/types").InstanceSettingSectionValue,
      )
      .then((res) => {
        setSmtpPasswordLocal(undefined);
        if (res.value)
          setEmail((p) => ({ ...p, ...res.value }) as InstanceEmailSection);
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl space-y-6">
        <div>
          <Skeleton className="h-4 w-72" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-2xl" />
        </div>
        <section className="space-y-3">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <Skeleton className="h-3 w-12" />
              <Skeleton className="mt-0.5 h-8 w-full rounded" />
            </div>
            <div>
              <Skeleton className="h-3 w-10" />
              <Skeleton className="mt-0.5 h-8 w-full rounded" />
            </div>
          </div>
          <div>
            <Skeleton className="h-3 w-36" />
            <Skeleton className="mt-0.5 h-8 w-full rounded" />
          </div>
          <div>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-0.5 h-8 w-full rounded" />
          </div>
        </section>
        <section className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-full max-w-md" />
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-0.5 h-8 w-full rounded" />
          </div>
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-0.5 h-8 w-full rounded" />
          </div>
        </section>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded" />
          <Skeleton className="h-8 w-32 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-base font-semibold text-(--txt-primary)">
          Secure emails from your own instance
        </h1>
        <p className="mt-0.5 text-xs text-(--txt-secondary)">
          Devlane can send useful emails to you and your users from your own
          instance without talking to the Internet. Set it up below and please
          test your settings before you save them.{" "}
          <span className="text-(--txt-danger-primary)">
            Misconfigs can lead to email bounces and errors.
          </span>
        </p>
      </div>

      {error && <p className="text-sm text-(--txt-danger-primary)">{error}</p>}

      <section className="space-y-3">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <label className="block text-xs font-medium text-(--txt-secondary)">
            Host
            <input
              type="text"
              value={email.host ?? ""}
              onChange={(e) =>
                setEmail((p) => ({ ...p, host: e.target.value }))
              }
              className="mt-0.5 block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-xs text-(--txt-primary) focus:outline-none"
            />
          </label>
          <label className="block text-xs font-medium text-(--txt-secondary)">
            Port
            <input
              type="text"
              value={email.port ?? ""}
              onChange={(e) =>
                setEmail((p) => ({ ...p, port: e.target.value }))
              }
              className="mt-0.5 block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-xs text-(--txt-primary) focus:outline-none"
            />
          </label>
        </div>
        <label className="block text-xs font-medium text-(--txt-secondary)">
          Sender&apos;s email address
          <input
            type="email"
            value={email.sender_email ?? ""}
            onChange={(e) =>
              setEmail((p) => ({ ...p, sender_email: e.target.value }))
            }
            className="mt-0.5 block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-xs text-(--txt-primary) focus:outline-none"
          />
          <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">
            This is the email address your users will see when getting emails
            from this instance. You will need to verify this address.
          </p>
        </label>
        <label className="block text-xs font-medium text-(--txt-secondary)">
          Email security
          <select
            value={email.security ?? "TLS"}
            onChange={(e) =>
              setEmail((p) => ({ ...p, security: e.target.value }))
            }
            className="mt-0.5 block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-xs text-(--txt-primary) focus:outline-none"
          >
            <option value="TLS">TLS</option>
            <option value="SSL">SSL</option>
            <option value="None">None</option>
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-(--txt-secondary)">
          Authentication
        </h2>
        <p className="text-xs text-(--txt-secondary)">
          This is optional, but we recommend setting up a username and a
          password for your SMTP server.
        </p>
        <label className="block text-xs font-medium text-(--txt-secondary)">
          Username
          <input
            type="text"
            value={email.username ?? ""}
            onChange={(e) =>
              setEmail((p) => ({ ...p, username: e.target.value }))
            }
            className="mt-0.5 block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 text-xs text-(--txt-primary) focus:outline-none"
          />
        </label>
        <label className="block text-xs font-medium text-(--txt-secondary)">
          Password
          <div className="relative mt-0.5">
            <input
              type={showSmtpPassword ? "text" : "password"}
              value={smtpPasswordDisplay}
              onChange={(e) => setSmtpPasswordLocal(e.target.value)}
              onFocus={() => {
                if (smtpPasswordLocal === undefined)
                  setSmtpPasswordLocal(smtpPasswordDisplay);
              }}
              placeholder={!smtpPasswordDisplay ? "Set password" : ""}
              className="block w-full rounded border border-(--border-subtle) bg-(--bg-surface-1) px-2.5 py-1.5 pr-9 text-xs text-(--txt-primary) focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowSmtpPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-(--txt-icon-tertiary) hover:bg-(--bg-layer-1-hover) hover:text-(--txt-icon-secondary)"
              aria-label={showSmtpPassword ? "Hide password" : "Show password"}
            >
              {showSmtpPassword ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">
            Leave blank to keep existing password.
          </p>
        </label>
      </section>

      <div className="flex gap-2">
        <Button
          size="sm"
          className="text-xs"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button variant="secondary" size="sm" className="text-xs" disabled>
          Send test email
        </Button>
      </div>
    </div>
  );
}
