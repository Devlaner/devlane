import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import { ImageDropZone, useImagePicker } from '@/v2/components/image-picker';
import { uploadImage } from '../../services/uploadService';

interface UploadImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the uploaded file's URL. The dialog closes itself afterwards. */
  onSave: (url: string) => void;
  title?: string;
  description?: string;
  /** Rounds the preview, for avatars and logos. */
  circular?: boolean;
}

/** Pick an image by drop or file browser, preview it, then upload. */
export function UploadImageDialog({
  open,
  onOpenChange,
  onSave,
  title,
  description,
  circular = false,
}: UploadImageDialogProps) {
  const { t } = useTranslation();
  const picker = useImagePicker();
  const [uploading, setUploading] = useState(false);

  const { clear } = picker;
  useEffect(() => {
    if (!open) clear();
  }, [open, clear]);

  const upload = async () => {
    if (!picker.file) return;
    picker.setError(null);
    setUploading(true);
    try {
      const { url } = await uploadImage(picker.file);
      onSave(url);
      onOpenChange(false);
    } catch (e) {
      picker.setError(e instanceof Error ? e.message : t('image.uploadFailed', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title ?? t('image.uploadTitle', 'Upload image')}</DialogTitle>
          <DialogDescription>
            {description ??
              t('image.formatsSupported', 'File formats supported: .jpeg, .jpg, .png, .webp')}
          </DialogDescription>
        </DialogHeader>

        <ImageDropZone picker={picker} circular={circular} />

        {picker.error && <p className="text-destructive text-sm">{picker.error}</p>}

        <DialogFooter>
          {picker.preview && (
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive mr-auto"
              disabled={uploading}
              onClick={picker.clear}
            >
              {t('common.remove', 'Remove')}
            </Button>
          )}
          <Button variant="outline" disabled={uploading} onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button disabled={!picker.file || uploading} onClick={() => void upload()}>
            {uploading
              ? t('image.uploading', 'Uploading…')
              : t('image.uploadSave', 'Upload & Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
