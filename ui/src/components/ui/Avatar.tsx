import { useState } from 'react';
import { cn } from '../../lib/utils';

export type AvatarSize = 'sm' | 'md' | 'lg';

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  if (parts.length === 0) {
    return '?';
  }
  if (parts.length === 1) {
    const w = parts[0];
    return w.slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const sizeStyles: Record<AvatarSize, string> = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
};

type AvatarInnerProps = {
  name: string;
  resolvedSrc: string;
  size: AvatarSize;
  className?: string;
};

/** Holds image error state; parent remounts via `key` when `resolvedSrc` changes. */
function AvatarInner({ name, resolvedSrc, size, className }: AvatarInnerProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = resolvedSrc !== '' && !imgFailed;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--bg-accent-primary) font-medium text-(--txt-on-color)',
        sizeStyles[size],
        className,
      )}
      title={name}
    >
      {showImg ? (
        <img
          src={resolvedSrc}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        getInitials(name)
      )}
    </span>
  );
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const resolvedSrc = src?.trim() ?? '';
  const remountKey = resolvedSrc !== '' ? resolvedSrc : `initials:${name}`;

  return (
    <AvatarInner
      key={remountKey}
      name={name}
      resolvedSrc={resolvedSrc}
      size={size}
      className={className}
    />
  );
}
