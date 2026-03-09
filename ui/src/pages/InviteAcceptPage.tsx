import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, Button } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { invitationService } from "../services/invitationService";
import { workspaceService } from "../services/workspaceService";

const IconCheck = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconX = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

const IconChevronRight = () => (
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
    <path d="m9 18 6-6-6-6" />
  </svg>
);

const IconGlobe = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
    className="shrink-0 text-[var(--txt-icon-secondary)]"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    <path d="M2 12h20" />
  </svg>
);

const IconClear = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const token = searchParams.get("token") ?? "";

  const [invite, setInvite] = useState<{
    workspace_name: string;
    workspace_slug: string;
    email: string;
    invitation_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [ignoring, setIgnoring] = useState(false);
  const [step, setStep] = useState<"invite" | "join">("invite");
  const [joinEmail, setJoinEmail] = useState("");

  useEffect(() => {
    if (!token.trim()) {
      navigate("/", { replace: true });
      return;
    }
    let cancelled = false;
    invitationService
      .getByToken(token)
      .then((data) => {
        if (!cancelled) setInvite(data);
      })
      .catch(() => {
        if (!cancelled) setError("Invite not found or expired.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  // When user returns from login (already authenticated), auto-accept and go to workspace
  useEffect(() => {
    if (
      !user ||
      !invite ||
      !token ||
      step !== "invite" ||
      autoAcceptDone.current
    )
      return;
    autoAcceptDone.current = true;
    doJoinWorkspace();
  }, [user, invite, token, step]);

  const handleAccept = () => {
    if (!token || !invite) return;
    if (!user) {
      setJoinEmail(invite.email);
      setStep("join");
      return;
    }
    doJoinWorkspace();
  };

  const doJoinWorkspace = async () => {
    if (!token || !invite) return;
    setAccepting(true);
    try {
      await workspaceService.joinByToken(token);
      navigate(`/${invite.workspace_slug}`, { replace: true });
    } catch {
      setError("Failed to join workspace. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const handleIgnore = async () => {
    if (!token) return;
    setIgnoring(true);
    try {
      await invitationService.declineByToken(token);
      navigate("/", { replace: true });
    } catch {
      setError("Failed to decline. Please try again.");
    } finally {
      setIgnoring(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
        <p className="text-sm text-[var(--txt-tertiary)]">Loading…</p>
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-sm text-[var(--txt-secondary)]">{error}</p>
            <Button
              variant="secondary"
              className="mt-4"
              onClick={() => navigate("/", { replace: true })}
            >
              Go home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invite) return null;

  // Step 2: Join [workspace] — email + Continue → login
  if (step === "join") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h1 className="flex items-center gap-2 text-2xl font-semibold text-[var(--txt-primary)]">
              <span className="text-[var(--txt-secondary)]">Join</span>
              <IconGlobe />
              <span>{invite.workspace_name}</span>
            </h1>
            <p className="mt-2 text-sm text-[var(--txt-secondary)]">
              Log in to start managing work with your team.
            </p>

            <div className="mt-6">
              <label className="mb-1 block text-sm font-medium text-[var(--txt-secondary)]">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={joinEmail}
                  onChange={(e) => setJoinEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="h-9 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] py-2 pl-3 pr-9 text-sm text-[var(--txt-primary)] placeholder:text-[var(--txt-placeholder)] focus:outline-none focus:border-[var(--border-strong)]"
                  autoComplete="email"
                />
                {joinEmail && (
                  <button
                    type="button"
                    onClick={() => setJoinEmail("")}
                    className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
                    aria-label="Clear email"
                  >
                    <IconClear />
                  </button>
                )}
              </div>
            </div>

            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() =>
                navigate("/invite/sign-up", {
                  replace: true,
                  state: {
                    email: joinEmail,
                    token,
                    workspaceName: invite.workspace_name,
                    workspaceSlug: invite.workspace_slug,
                  },
                })
              }
            >
              Continue
            </Button>

            <p className="mt-4 text-center text-sm text-[var(--txt-secondary)]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() =>
                  navigate("/login", {
                    replace: true,
                    state: {
                      from: { pathname: "/invite", search: `?token=${token}` },
                      email: joinEmail,
                    },
                  })
                }
                className="font-medium text-[var(--txt-accent)] hover:underline"
              >
                Sign in
              </button>
            </p>

            <p className="mt-6 text-center text-xs text-[var(--txt-tertiary)]">
              By signing in, you understand and agree to our{" "}
              <a
                href="/terms"
                className="underline hover:text-[var(--txt-secondary)]"
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="/privacy"
                className="underline hover:text-[var(--txt-secondary)]"
              >
                Privacy Policy
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8">
          <h1 className="text-xl font-semibold text-[var(--txt-primary)]">
            You have been invited to {invite.workspace_name}
          </h1>
          <p className="mt-3 text-sm text-[var(--txt-secondary)]">
            Your workspace is where you'll create projects, collaborate on work
            items, and organize different streams of work in your Devlane
            account.
          </p>

          {error && (
            <p className="mt-3 text-sm text-[var(--txt-destructive)]">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={handleAccept}
              disabled={accepting || ignoring}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-3 text-left text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)] disabled:opacity-50"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--bg-accent-primary)] text-[var(--txt-on-color)]">
                  <IconCheck />
                </span>
                Accept
              </span>
              <span className="text-[var(--txt-icon-tertiary)]">
                <IconChevronRight />
              </span>
            </button>

            <button
              type="button"
              onClick={handleIgnore}
              disabled={accepting || ignoring}
              className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-4 py-3 text-left text-sm font-medium text-[var(--txt-primary)] hover:bg-[var(--bg-layer-1-hover)] disabled:opacity-50"
            >
              <span className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[var(--bg-layer-2)] text-[var(--txt-icon-secondary)]">
                  <IconX />
                </span>
                Ignore
              </span>
              <span className="text-[var(--txt-icon-tertiary)]">
                <IconChevronRight />
              </span>
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
