import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckIcon, ImageIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/v2/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/v2/components/ui/empty';
import { Input } from '@/v2/components/ui/input';
import { ScrollArea } from '@/v2/components/ui/scroll-area';
import { Skeleton } from '@/v2/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/v2/components/ui/tabs';
import { ImageDropZone, useImagePicker } from '@/v2/components/image-picker';
import { cn } from '@/lib/utils';
import { instanceSettingsService, type UnsplashSearchResult } from '../../services/instanceService';
import { uploadImage } from '../../services/uploadService';

interface CoverImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen image URL. The dialog closes itself afterwards. */
  onSelect: (url: string) => void;
  title?: string;
}

type Tab = 'unsplash' | 'upload';

/** Cover picker: search Unsplash, or upload your own image. */
export function CoverImageDialog({ open, onOpenChange, onSelect, title }: CoverImageDialogProps) {
  const { t } = useTranslation();
  const picker = useImagePicker();
  const [tab, setTab] = useState<Tab>('unsplash');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UnsplashSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { clear } = picker;
  useEffect(() => {
    if (open) return;
    setTab('unsplash');
    setQuery('');
    setResults([]);
    setSearched(false);
    setSearchError(null);
    setSelectedUrl(null);
    clear();
  }, [open, clear]);

  const search = async () => {
    if (!query.trim()) return;
    setSearchError(null);
    setSearching(true);
    try {
      const { results: found } = await instanceSettingsService.unsplashSearch(query.trim());
      setResults(found);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : t('image.searchFailed', 'Search failed'));
      setResults([]);
    } finally {
      setSearched(true);
      setSearching(false);
    }
  };

  const upload = async () => {
    if (!picker.file) return;
    picker.setError(null);
    setUploading(true);
    try {
      const { url } = await uploadImage(picker.file);
      onSelect(url);
      onOpenChange(false);
    } catch (e) {
      picker.setError(e instanceof Error ? e.message : t('image.uploadFailed', 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !uploading && onOpenChange(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title ?? t('image.coverTitle', 'Select cover image')}</DialogTitle>
          <DialogDescription>
            {t(
              'image.coverDescription',
              'Search a free photo library, or upload your own .jpeg, .png, or .webp file.',
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            <TabsTrigger value="unsplash">Unsplash</TabsTrigger>
            <TabsTrigger value="upload">{t('image.tabUpload', 'Upload')}</TabsTrigger>
          </TabsList>

          <TabsContent value="unsplash" className="flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <SearchIcon
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void search()}
                  placeholder={t('image.searchImages', 'Search for images')}
                  className="pl-9"
                  aria-label={t('image.searchImages', 'Search for images')}
                />
              </div>
              <Button
                variant="outline"
                disabled={searching || !query.trim()}
                onClick={() => void search()}
              >
                {searching ? t('image.searching', 'Searching…') : t('common.search', 'Search')}
              </Button>
            </div>

            {searchError && <p className="text-destructive text-sm">{searchError}</p>}

            {searching ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-video w-full rounded-md" />
                ))}
              </div>
            ) : results.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ImageIcon />
                  </EmptyMedia>
                  <EmptyTitle>
                    {searched
                      ? t('image.noResults', 'No images found.')
                      : t('image.searchPrompt', 'Search for a cover image')}
                  </EmptyTitle>
                  <EmptyDescription>
                    {t(
                      'image.searchHint',
                      'Try a subject like “mountains”, “desk”, or “abstract”.',
                    )}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ScrollArea className="max-h-72">
                <div className="grid grid-cols-2 gap-2 pr-3 sm:grid-cols-4">
                  {results.map((result) => {
                    const selected = selectedUrl === result.url;
                    return (
                      <button
                        type="button"
                        key={result.id}
                        onClick={() => setSelectedUrl(result.url)}
                        aria-pressed={selected}
                        className={cn(
                          'focus-visible:ring-ring relative aspect-video overflow-hidden rounded-md border-2 transition-colors focus-visible:ring-2 focus-visible:outline-none',
                          selected
                            ? 'border-primary'
                            : 'hover:border-muted-foreground/40 border-transparent',
                        )}
                      >
                        <img src={result.thumb} alt="" className="size-full object-cover" />
                        {selected && (
                          <span className="bg-primary text-primary-foreground absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full">
                            <CheckIcon className="size-3" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="upload" className="flex flex-col gap-3">
            <ImageDropZone picker={picker} />
            {picker.error && <p className="text-destructive text-sm">{picker.error}</p>}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" disabled={uploading} onClick={() => onOpenChange(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          {tab === 'unsplash' ? (
            <Button
              disabled={!selectedUrl}
              onClick={() => {
                if (!selectedUrl) return;
                onSelect(selectedUrl);
                onOpenChange(false);
              }}
            >
              {t('common.select', 'Select')}
            </Button>
          ) : (
            <Button disabled={!picker.file || uploading} onClick={() => void upload()}>
              {uploading
                ? t('image.uploading', 'Uploading…')
                : t('image.uploadSave', 'Upload & Save')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
