import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui";

/** Devlane logo mark: blue square with white star */
const LogoMark = () => (
  <span
    className="flex size-9 items-center justify-center rounded-lg bg-(--bg-accent-primary) text-(--txt-on-color)"
    aria-hidden
  >
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2l3 9h9l-7 5 2.5 8-7.5-5.5-7.5 5.5 2.5-8-7-5h9z" />
    </svg>
  </span>
);

/** Illustration: workspace/launch theme (layers + upward motion) */
const WelcomeIllustration = () => (
  <div className="relative mx-auto flex h-48 w-full max-w-sm items-center justify-center">
    <svg
      viewBox="0 0 280 160"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {/* Soft grid / layers in background */}
      <defs>
        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="0.5"
          />
        </pattern>
        <linearGradient id="rocketGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--bg-layer-2)" />
          <stop offset="100%" stopColor="var(--bg-layer-1)" />
        </linearGradient>
        <linearGradient id="accentGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--bg-accent-primary)" />
          <stop offset="100%" stopColor="var(--txt-accent-secondary)" />
        </linearGradient>
      </defs>
      <rect width="280" height="160" fill="url(#grid)" />
      {/* Central “rocket” / arrow shape */}
      <path
        d="M140 32 L168 88 L156 88 L156 128 L124 128 L124 88 L112 88 Z"
        fill="url(#rocketGrad)"
        stroke="var(--border-subtle)"
        strokeWidth="1"
      />
      <path d="M140 24 L148 48 L132 48 Z" fill="url(#accentGrad)" />
      {/* Small “confetti” circles */}
      <circle
        cx="80"
        cy="50"
        r="4"
        fill="var(--bg-accent-subtle)"
        opacity="0.9"
      />
      <circle
        cx="200"
        cy="60"
        r="3"
        fill="var(--bg-success-subtle)"
        opacity="0.9"
      />
      <circle
        cx="70"
        cy="100"
        r="3"
        fill="var(--bg-warning-subtle)"
        opacity="0.9"
      />
      <circle
        cx="210"
        cy="90"
        r="4"
        fill="var(--bg-accent-subtle)"
        opacity="0.8"
      />
      <circle
        cx="100"
        cy="120"
        r="3"
        fill="var(--bg-success-subtle)"
        opacity="0.8"
      />
      <circle
        cx="180"
        cy="45"
        r="3"
        fill="var(--bg-warning-subtle)"
        opacity="0.8"
      />
    </svg>
  </div>
);

export function InstanceSetupWelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-(--bg-canvas)">
      {/* Subtle grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.4] [background-image:linear-gradient(var(--border-subtle)_1px,transparent_1px),linear-gradient(90deg,var(--border-subtle)_1px,transparent_1px)] [background-size:24px_24px]"
        aria-hidden
      />

      <header className="relative z-10 shrink-0 px-6 py-4">
        <div className="flex items-center gap-2 text-lg font-semibold text-(--txt-primary)">
          <LogoMark />
          Devlane
        </div>
      </header>

      <main className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-md flex-col items-center text-center">
          <h1 className="text-3xl font-bold tracking-tight text-(--txt-primary) sm:text-4xl">
            Welcome aboard Devlane!
          </h1>
          <div className="mt-6 w-full">
            <WelcomeIllustration />
          </div>
          <p className="mt-2 text-sm text-(--txt-secondary)">
            Get started by setting up your instance and workspace.
          </p>
          <Button
            type="button"
            size="lg"
            className="mt-8 w-full max-w-xs"
            onClick={() => navigate("/setup/configure", { replace: true })}
          >
            Get started
          </Button>
        </div>
      </main>
    </div>
  );
}
