import { Suspense, type ReactNode } from 'react';
import { useInterfaceVersion } from '../v2/contexts/InterfaceContext';
import { PageFallback } from './PageFallback';

interface VariantProps {
  /** Rendered when the interface preference is 'v1' (the default). */
  v1: ReactNode;
  /** Rendered when the interface preference is 'v2'. */
  v2: ReactNode;
}

/**
 * Renders one of two elements for the same URL, picked by the stored interface
 * preference. This is what makes v2 a preference rather than a separate route
 * tree: every path in `routes/index.tsx` is declared once, and only the element
 * differs between the two interfaces.
 *
 * Both elements are constructed on every render, but constructing an element is
 * just an object — the lazy component behind it is only imported when React
 * actually renders it, so a v1 user never downloads a v2 chunk (and vice versa).
 * The Suspense boundary lives here so each route entry stays a one-liner.
 */
export function Variant({ v1, v2 }: VariantProps) {
  const { interfaceVersion } = useInterfaceVersion();
  return <Suspense fallback={<PageFallback />}>{interfaceVersion === 'v2' ? v2 : v1}</Suspense>;
}
