'use client';

import { cn } from '@/lib/utils';
import { PrismGradient } from '@/v2/components/ui/prism-gradient';

interface HeroGeometricProps {
  className?: string; // Explicitly included
  /** Animation speed multiplier passed to the gradient. */
  speed?: number;
}

/**
 * Upstream (`@componentry/hero-geometric`) paints its background with a three.js
 * canvas in a fixed blue palette and stacks a headline over it. Here the
 * background is `PrismGradient`, the WebGL2 shader already vendored for the v2
 * auth panel: it follows the Devlane theme, falls back to a CSS radial gradient
 * where WebGL is unavailable, and drops three.js and @react-three/fiber (~1 MB)
 * from the chunk. The headline and its framer-motion reveal are gone with it —
 * this renders as a band behind other content, which carries the text.
 */
export default function HeroGeometric({ speed = 1, className }: HeroGeometricProps) {
  return (
    <div
      className={cn(
        'bg-background text-foreground relative flex min-h-screen w-full flex-col items-center overflow-hidden',
        className,
      )}
      style={{ containerType: 'size' }}
    >
      <PrismGradient speed={speed} noise={{ opacity: 0.35 }} className="pointer-events-none" />
    </div>
  );
}
