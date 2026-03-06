import { useEffect, useState } from 'react';
import { Button, IconEye, IconEyeOff, Skeleton } from '../../components/ui';
import { instanceSettingsService } from '../../services/instanceService';
import { getApiErrorMessage } from '../../api/client';
import type { InstanceAISection } from '../../api/types';

export function InstanceAdminAIPage() {
  const [ai, setAi] = useState<InstanceAISection>({ model: 'gpt-4o-mini', api_key_set: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyLocal, setApiKeyLocal] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  const apiKeyDisplay = apiKeyLocal !== undefined ? apiKeyLocal : (ai.api_key ?? '');

  useEffect(() => {
    let cancelled = false;
    instanceSettingsService
      .getSettings()
      .then((settings) => {
        if (cancelled) return;
        const a = (settings.ai || {}) as InstanceAISection;
        setAi({
          model: a.model ?? 'gpt-4o-mini',
          api_key_set: a.api_key_set ?? false,
          api_key: a.api_key ?? '',
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
    setError('');
    setSaving(true);
    const apiKeyToSend = apiKeyLocal !== undefined ? apiKeyLocal : ai.api_key;
    const payload: InstanceAISection = { ...ai, api_key: apiKeyToSend ?? '' };
    instanceSettingsService
      .updateSection('ai', payload)
      .then((res) => {
        setApiKeyLocal(undefined);
        if (res.value) setAi((p) => ({ ...p, ...res.value } as InstanceAISection));
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="w-full max-w-6xl space-y-6">
        <div>
          <Skeleton className="h-4 w-72" />
          <Skeleton className="mt-1.5 h-3 w-full max-w-xl" />
        </div>
        <section className="space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-48" />
          <div>
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-0.5 h-8 w-full rounded" />
            <Skeleton className="mt-0.5 h-3 w-40" />
          </div>
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-0.5 h-8 w-full rounded" />
            <Skeleton className="mt-0.5 h-3 w-56" />
          </div>
        </section>
        <Skeleton className="h-8 w-24 rounded" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-base font-semibold text-[var(--txt-primary)]">AI features for all your workspaces</h1>
        <p className="mt-0.5 text-xs text-[var(--txt-secondary)]">
          Configure your AI API credentials so Devlane AI features are turned on for all your workspaces.
        </p>
      </div>

      {error && <p className="text-sm text-[var(--txt-danger-primary)]">{error}</p>}

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--txt-secondary)]">OpenAI</h2>
        <p className="text-xs text-[var(--txt-secondary)]">If you use ChatGPT, this is for you.</p>
        <label className="block text-xs font-medium text-[var(--txt-secondary)]">
          LLM Model
          <input
            type="text"
            value={ai.model ?? ''}
            onChange={(e) => setAi((p) => ({ ...p, model: e.target.value }))}
            className="mt-0.5 block w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-2.5 py-1.5 text-xs text-[var(--txt-primary)] focus:outline-none"
          />
          <p className="mt-0.5 text-[11px] text-[var(--txt-tertiary)]">
            Choose an OpenAI engine. <a href="#" className="text-[var(--txt-accent-primary)] underline hover:no-underline">Learn more</a>
          </p>
        </label>
        <label className="block text-xs font-medium text-[var(--txt-secondary)]">
          API key
          <div className="relative mt-0.5">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={apiKeyDisplay}
              onChange={(e) => setApiKeyLocal(e.target.value)}
              onFocus={() => {
                if (apiKeyLocal === undefined) setApiKeyLocal(apiKeyDisplay);
              }}
              placeholder={!apiKeyDisplay ? 'Enter API key' : ''}
              className="block w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface-1)] px-2.5 py-1.5 pr-9 text-xs text-[var(--txt-primary)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--txt-icon-tertiary)] hover:bg-[var(--bg-layer-1-hover)] hover:text-[var(--txt-icon-secondary)]"
              aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
            >
              {showApiKey ? <IconEyeOff /> : <IconEye />}
            </button>
          </div>
          <p className="mt-0.5 text-[11px] text-[var(--txt-tertiary)]">
            You will find your API key <a href="#" className="text-[var(--txt-accent-primary)] underline hover:no-underline">here</a>. Leave blank to keep existing key.
          </p>
        </label>
      </section>

      <Button size="sm" className="text-xs" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </div>
  );
}
