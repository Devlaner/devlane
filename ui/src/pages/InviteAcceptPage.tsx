import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Card, CardContent } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { workspaceService } from "../services/workspaceService";

export function InviteAcceptPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("Invalid or missing invite link.");
      return;
    }
    if (authLoading) return;
    if (!user) {
      navigate("/login", {
        replace: true,
        state: {
          from: {
            pathname: "/invite",
            search: searchParams.toString(),
          },
        },
      });
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError("");
    workspaceService
      .joinByToken(token)
      .then((workspace) => {
        if (cancelled) return;
        setStatus("success");
        navigate(`/${workspace.slug}`, { replace: true });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        const msg =
          err?.response?.data?.error ??
          (err instanceof Error
            ? err.message
            : "Invalid or expired invite. Please request a new link.");
        setError(String(msg));
      });
    return () => {
      cancelled = true;
    };
  }, [token, user, authLoading, navigate, searchParams]);

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h1 className="mb-2 text-xl font-semibold text-[var(--txt-primary)]">
              Invalid invite link
            </h1>
            <p className="mb-4 text-sm text-[var(--txt-secondary)]">
              This invite link is missing a token. Please use the link from your
              invitation email.
            </p>
            <Button
              variant="secondary"
              onClick={() => navigate("/login", { replace: true })}
            >
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading || status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-sm text-[var(--txt-secondary)]">
              Accepting invitation…
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <h1 className="mb-2 text-xl font-semibold text-[var(--txt-primary)]">
              Invite could not be accepted
            </h1>
            <p className="mb-4 text-sm text-[var(--txt-danger-primary)]">
              {error}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => navigate("/login", { replace: true })}
              >
                Sign in
              </Button>
              <Button onClick={() => navigate("/", { replace: true })}>
                Go home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-canvas)] p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <p className="text-sm text-[var(--txt-secondary)]">
            Redirecting to workspace…
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
