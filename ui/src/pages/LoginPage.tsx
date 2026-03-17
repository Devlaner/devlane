import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Input, Card, CardContent } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const state = location.state as {
    from?: { pathname?: string; search?: string };
    email?: string;
  } | null;
  const from = state?.from;
  const returnPath = from ? (from.pathname ?? "/") + (from.search ?? "") : "/";
  const prefilledEmail = state?.email ?? "";

  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const success = await login(email, password);
      if (success) {
        navigate(returnPath, { replace: true });
      } else {
        setError("Invalid email or password.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-canvas) p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <h1 className="mb-2 text-2xl font-semibold text-(--txt-primary)">
            Sign in to Devlane
          </h1>
          <p className="mb-6 text-sm text-(--txt-secondary)">
            Enter your email and password to continue.
          </p>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              error={error || undefined}
              autoComplete="current-password"
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
