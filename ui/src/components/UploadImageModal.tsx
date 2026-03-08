import { useCallback, useState } from 'react';
import { Button, Modal } from './ui';
import { uploadImage } from '../services/uploadService';

export interface UploadImageModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
  title?: string;
}

export function UploadImageModal({ open, onClose, onSave, title = 'Upload image' }: UploadImageModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(f.type)) {
      setError('Invalid file type. Supported: .jpeg, .jpg, .png, .webp');
      return;
    }
    setError(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(f.type)) {
      setError('Invalid file type. Supported: .jpeg, .jpg, .png, .webp');
      return;
    }
    setError(null);
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  const handleRemove = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
  }, []);

  const handleUploadSave = useCallback(async () => {
    if (!file) return;
    setError(null);
    setLoading(true);
    try {
      const { url } = await uploadImage(file);
      onSave(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  }, [file, onSave, onClose]);

  const footer = (
    <>
      {preview && (
        <Button variant="secondary" className="text-[var(--txt-danger-primary)]" onClick={handleRemove}>
          Remove
        </Button>
      )}
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      <Button disabled={!file || loading} onClick={handleUploadSave}>
        {loading ? 'Uploading…' : 'Upload & Save'}
      </Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={title} footer={footer} className="max-w-md">
      <div className="space-y-3">
        {!preview ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border-2 border-dashed border-[var(--border-subtle)] bg-[var(--bg-layer-2)] py-12 px-4"
          >
            <p className="text-sm text-[var(--txt-secondary)] mb-2">Drag & drop image here</p>
            <label className="cursor-pointer">
              <span className="text-sm font-medium text-[var(--txt-accent-primary)] hover:underline">Browse</span>
              <input type="file" accept=".jpeg,.jpg,.png,.webp" className="sr-only" onChange={handleFileChange} />
            </label>
          </div>
        ) : (
          <div className="relative rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-layer-2)]">
            <img src={preview} alt="Preview" className="w-full max-h-64 object-contain" />
            <div className="absolute top-2 right-2">
              <button
                type="button"
                onClick={handleRemove}
                className="text-xs font-medium text-[var(--txt-accent-primary)] hover:underline"
              >
                Edit
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--txt-tertiary)]">File formats supported: .jpeg, .jpg, .png, .webp</p>
        {error && <p className="text-sm text-[var(--txt-danger-primary)]">{error}</p>}
      </div>
    </Modal>
  );
}
