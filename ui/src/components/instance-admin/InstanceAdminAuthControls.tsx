import { useState } from 'react';
import { Copy } from 'lucide-react';

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function InstanceAdminCopyRow({
  label,
  hint,
  value,
}: {
  label: string;
  hint: string;
  value: string;
}) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const onCopy = () => {
    if (!value) return;
    void (async () => {
      const ok = await copyTextToClipboard(value);
      if (ok) {
        setCopyState('copied');
        setTimeout(() => setCopyState('idle'), 2000);
      } else {
        setCopyState('failed');
        setTimeout(() => setCopyState('idle'), 2000);
      }
    })();
  };
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-(--txt-secondary)">{label}</label>
        <button
          type="button"
          onClick={onCopy}
          disabled={!value}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-(--txt-accent) hover:bg-(--bg-subtle) disabled:opacity-40"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : 'Copy'}
        </button>
      </div>
      <input
        readOnly
        value={value}
        className="w-full rounded border border-(--border-subtle) bg-(--bg-layer-1) px-2 py-1.5 font-mono text-xs text-(--txt-primary)"
        aria-label={label}
      />
      <p className="mt-0.5 text-[11px] text-(--txt-tertiary)">{hint}</p>
    </div>
  );
}

export function InstanceAdminToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-(--neutral-400) has-[:checked]:bg-(--brand-default)">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="pointer-events-none inline-block h-5 w-5 translate-x-0.5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
    </label>
  );
}
