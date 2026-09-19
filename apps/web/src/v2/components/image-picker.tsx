import { useCallback, useRef, useState, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageUpIcon, XIcon } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { cn } from '@/lib/utils';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface ImagePicker {
  file: File | null;
  preview: string | null;
  error: string | null;
  setError: (message: string | null) => void;
  accept: (picked: File | undefined) => void;
  clear: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/** File selection + preview state for {@link ImageDropZone}. */
export function useImagePicker(): ImagePicker {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(
    (picked: File | undefined) => {
      if (!picked) return;
      if (!ALLOWED_TYPES.includes(picked.type)) {
        setError(t('image.invalidType', 'Invalid file type. Supported: .jpeg, .jpg, .png, .webp'));
        return;
      }
      setError(null);
      setFile(picked);
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(picked);
    },
    [t],
  );

  const clear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }, []);

  return { file, preview, error, setError, accept, clear, inputRef };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ImageDropZoneProps {
  picker: ImagePicker;
  /** Rounds the preview, for avatars and logos. */
  circular?: boolean;
}

/** Drop target that turns into a preview once a file is chosen. */
export function ImageDropZone({ picker, circular = false }: ImageDropZoneProps) {
  const { t } = useTranslation();
  const { file, preview, accept, clear, inputRef } = picker;
  const [dragging, setDragging] = useState(false);

  const handleDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer.files?.[0]);
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".jpeg,.jpg,.png,.webp"
        className="sr-only"
        onChange={(e) => accept(e.target.files?.[0])}
      />

      {preview ? (
        <>
          <div className="bg-muted/40 relative grid place-items-center rounded-lg border p-4">
            <img
              src={preview}
              alt={t('image.previewAlt', 'Preview')}
              className={cn(
                'max-h-56 object-contain',
                circular ? 'size-32 rounded-full object-cover' : 'w-full',
              )}
            />
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="absolute top-2 right-2 size-7 shadow-sm"
              aria-label={t('common.remove', 'Remove')}
              onClick={clear}
            >
              <XIcon />
            </Button>
          </div>
          {file && (
            <p className="text-muted-foreground truncate text-xs">
              {file.name} · {formatBytes(file.size)}
            </p>
          )}
        </>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          className={cn(
            'focus-visible:ring-ring flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 transition-colors focus-visible:ring-2 focus-visible:outline-none',
            dragging ? 'border-primary bg-primary/5' : 'bg-muted/40 hover:bg-muted',
          )}
        >
          <span className="bg-background text-muted-foreground grid size-10 place-items-center rounded-full border">
            <ImageUpIcon className="size-5" />
          </span>
          <span className="text-sm font-medium">
            {t('image.dragDrop', 'Drag & drop image here')}
          </span>
          <span className="text-muted-foreground text-xs">
            {t('image.browseHint', 'or click to browse your files')}
          </span>
        </button>
      )}
    </div>
  );
}
