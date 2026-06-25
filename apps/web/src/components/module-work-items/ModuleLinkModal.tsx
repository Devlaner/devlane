import { useEffect, useState, type FormEvent } from 'react';
import { Modal, Button, Input } from '../ui';
import type { ModuleLinkApiResponse } from '../../services/moduleService';

interface ModuleLinkModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, the modal edits this link; otherwise it creates a new one. */
  initial?: ModuleLinkApiResponse | null;
  onSubmit: (data: { url: string; title: string }, id?: string) => Promise<void>;
}

/** Add / edit a module link. Mirrors the create-update link modal layout. */
export function ModuleLinkModal({ open, onClose, initial, onSubmit }: ModuleLinkModalProps) {
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(initial?.url ?? '');
      setTitle(initial?.title ?? '');
    }
  }, [open, initial]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed || submitting) return;
    const parsed = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    setSubmitting(true);
    try {
      await onSubmit({ url: parsed, title: title.trim() }, initial?.id);
      onClose();
    } catch {
      // surfaced by the caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={initial ? 'Update link' : 'Add link'}>
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Type or paste a URL"
          autoFocus
        />
        <Input
          label="Display title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What you'd like to see this link as"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={!url.trim() || submitting}>
            {initial ? 'Update link' : 'Add link'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
