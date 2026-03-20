import { useCallback, useEffect, useState } from 'react';
import { Button, Modal } from './ui';
import { instanceSettingsService, type UnsplashSearchResult } from '../services/instanceService';
import { uploadImage } from '../services/uploadService';

const TAB_UNSPLASH = 'unsplash';
const TAB_UPLOAD = 'upload';
type Tab = typeof TAB_UNSPLASH | typeof TAB_UPLOAD;

export interface CoverImageModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  title?: string;
}

export function CoverImageModal({
  open,
  onClose,
  onSelect,
  title = 'Select cover image',
}: CoverImageModalProps) {
  const [tab, setTab] = useState<Tab>(TAB_UNSPLASH);
  const [unsplashQuery, setUnsplashQuery] = useState('');
  const [unsplashResults, setUnsplashResults] = useState<UnsplashSearchResult[]>([]);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashError, setUnsplashError] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setTab(TAB_UNSPLASH);
      setUnsplashQuery('');
      setUnsplashResults([]);
      setUnsplashError(null);
      setSelectedUrl(null);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadError(null);
    }
  }, [open]);

  const handleSearch = useCallback(async () => {
    if (!unsplashQuery.trim()) return;
    setUnsplashError(null);
    setUnsplashLoading(true);
    try {
      const { results } = await instanceSettingsService.unsplashSearch(unsplashQuery.trim());
      setUnsplashResults(results);
    } catch (e) {
      setUnsplashError(e instanceof Error ? e.message : 'Search failed');
      setUnsplashResults([]);
    } finally {
      setUnsplashLoading(false);
    }
  }, [unsplashQuery]);

  const handleUnsplashSelect = useCallback(() => {
    if (selectedUrl) {
      onSelect(selectedUrl);
      onClose();
    }
  }, [selectedUrl, onSelect, onClose]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadError('Invalid file type. Supported: .jpeg, .jpg, .png, .webp');
      return;
    }
    setUploadError(null);
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadError('Invalid file type. Supported: .jpeg, .jpg, .png, .webp');
      return;
    }
    setUploadError(null);
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = () => setUploadPreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => e.preventDefault(), []);

  const handleUploadSave = useCallback(async () => {
    if (!uploadFile) return;
    setUploadError(null);
    setUploadLoading(true);
    try {
      const { url } = await uploadImage(uploadFile);
      onSelect(url);
      onClose();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadLoading(false);
    }
  }, [uploadFile, onSelect, onClose]);

  const handleRemoveUpload = useCallback(() => {
    setUploadFile(null);
    setUploadPreview(null);
    setUploadError(null);
  }, []);

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose}>
        Cancel
      </Button>
      {tab === TAB_UNSPLASH && (
        <Button disabled={!selectedUrl} onClick={handleUnsplashSelect}>
          Select
        </Button>
      )}
      {tab === TAB_UPLOAD && (
        <Button disabled={!uploadFile || uploadLoading} onClick={handleUploadSave}>
          {uploadLoading ? 'Uploading…' : 'Upload & Save'}
        </Button>
      )}
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={title} footer={footer} className="max-w-2xl">
      <div className="flex gap-2 border-b border-(--border-subtle) pb-3 mb-3">
        <button
          type="button"
          onClick={() => setTab(TAB_UNSPLASH)}
          className={`rounded-(--radius-md) px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === TAB_UNSPLASH
              ? 'bg-(--brand-default) text-white'
              : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover)'
          }`}
        >
          Unsplash
        </button>
        <button
          type="button"
          onClick={() => setTab(TAB_UPLOAD)}
          className={`rounded-(--radius-md) px-3 py-1.5 text-sm font-medium transition-colors ${
            tab === TAB_UPLOAD
              ? 'bg-(--brand-default) text-white'
              : 'text-(--txt-secondary) hover:bg-(--bg-layer-transparent-hover)'
          }`}
        >
          Upload
        </button>
      </div>

      {tab === TAB_UNSPLASH && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={unsplashQuery}
              onChange={(e) => setUnsplashQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search for images"
              className="min-w-0 flex-1 rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 text-sm text-(--txt-primary) placeholder:text-(--txt-placeholder) focus:outline-none focus:border-(--border-strong)"
            />
            <Button variant="secondary" onClick={handleSearch} disabled={unsplashLoading}>
              {unsplashLoading ? 'Searching…' : 'Search'}
            </Button>
          </div>
          {unsplashError && <p className="text-sm text-(--txt-danger-primary)">{unsplashError}</p>}
          <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
            {unsplashResults.map((r) => (
              <button
                type="button"
                key={r.id}
                onClick={() => setSelectedUrl(r.url)}
                className={`relative aspect-video rounded-(--radius-md) overflow-hidden border-2 transition-colors ${
                  selectedUrl === r.url
                    ? 'border-(--brand-default) ring-2 ring-(--brand-200)'
                    : 'border-transparent hover:border-(--border-strong)'
                }`}
              >
                <img src={r.thumb} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === TAB_UPLOAD && (
        <div className="space-y-3">
          {!uploadPreview ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="flex flex-col items-center justify-center rounded-(--radius-md) border-2 border-dashed border-(--border-subtle) bg-(--bg-layer-2) py-12 px-4"
            >
              <p className="text-sm text-(--txt-secondary) mb-2">Drag & drop image here</p>
              <label className="cursor-pointer">
                <span className="text-sm font-medium text-(--txt-accent-primary) hover:underline">
                  Browse
                </span>
                <input
                  type="file"
                  accept=".jpeg,.jpg,.png,.webp"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>
            </div>
          ) : (
            <div className="relative rounded-(--radius-md) border border-(--border-subtle) overflow-hidden bg-(--bg-layer-2)">
              <img src={uploadPreview} alt="Preview" className="w-full max-h-64 object-contain" />
              <div className="absolute top-2 right-2">
                <button
                  type="button"
                  onClick={handleRemoveUpload}
                  className="text-xs font-medium text-(--txt-accent-primary) hover:underline"
                >
                  Edit
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-(--txt-tertiary)">
            File formats supported: .jpeg, .jpg, .png, .webp
          </p>
          {uploadError && <p className="text-sm text-(--txt-danger-primary)">{uploadError}</p>}
        </div>
      )}
    </Modal>
  );
}
