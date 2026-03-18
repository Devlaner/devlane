import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { instanceService } from "../services/instanceService";

const PageFallback = () => (
  <div className="flex items-center justify-center p-8 text-sm text-(--txt-tertiary)">
    Loading...
  </div>
);

/**
 * When instance setup is required (no users yet), redirects to /setup for any path
 * except /setup, /setup/configure, /setup/complete. Ensures first-time self-hosted
 * users are taken to the setup flow whether they open /, /login, or any other URL.
 */
export function SetupGate() {
  const location = useLocation();
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);

  const isSetupPath =
    location.pathname === "/setup" || location.pathname.startsWith("/setup/");

  useEffect(() => {
    if (isSetupPath) {
      // Intentional: clear setup flag on setup route (kept for future use)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetupRequired(false);
      return;
    }
    let cancelled = false;
    instanceService
      .getSetupStatus()
      .then((res) => {
        if (!cancelled) setSetupRequired(res.setup_required);
      })
      .catch(() => {
        if (!cancelled) setSetupRequired(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSetupPath, location.pathname]);

  if (isSetupPath) {
    return <Outlet />;
  }

  if (setupRequired === null) {
    return <PageFallback />;
  }

  if (setupRequired) {
    return <Navigate to="/setup" replace />;
  }

  return <Outlet />;
}
