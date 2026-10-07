import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DownloadIcon } from 'lucide-react';
import { Button } from '@/v2/components/ui/button';
import { Label } from '@/v2/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/v2/components/ui/select';
import { SettingsPanel } from '@/v2/components/settings/settings-panel';
import { exportService } from '../../../../services/exportService';
import { issueService } from '../../../../services/issueService';
import type { ProjectApiResponse } from '../../../../api/types';

interface WorkspaceExportsPanelProps {
  workspaceSlug: string;
  projects: ProjectApiResponse[];
}

type ExportFormat = 'csv' | 'json' | 'xlsx';

const CSV_HEADERS = [
  'id',
  'project_id',
  'project_name',
  'name',
  'priority',
  'state_id',
  'created_at',
  'updated_at',
  'description',
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function toCsv(rows: Record<string, unknown>[]): string {
  const lines = rows.map((row) =>
    CSV_HEADERS.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      const text =
        typeof value === 'object' && header === 'description'
          ? ((row.description_html as string) ?? JSON.stringify(value))
          : String(value);
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }).join(','),
  );
  return [CSV_HEADERS.join(','), ...lines].join('\r\n');
}

/** Downloads a snapshot of the workspace's work items as CSV, JSON, or Excel. */
export function WorkspaceExportsPanel({ workspaceSlug, projects }: WorkspaceExportsPanelProps) {
  const { t } = useTranslation();
  const [projectValue, setProjectValue] = useState('all');
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runExport = async () => {
    setError(null);
    setExporting(true);
    try {
      const projectIds = projectValue === 'all' ? projects.map((p) => p.id) : [projectValue];
      const base = `export-${workspaceSlug}-${new Date().toISOString().slice(0, 10)}`;

      /* Excel is generated server-side (a real .xlsx); CSV and JSON are built
         here from the same paged issue listing the app already uses. */
      if (format === 'xlsx') {
        downloadBlob(await exportService.createXlsx(workspaceSlug, projectIds), `${base}.xlsx`);
        return;
      }

      const rows: Record<string, unknown>[] = [];
      const limit = 2000;
      for (const projectId of projectIds) {
        const project = projects.find((p) => p.id === projectId);
        let offset = 0;
        for (;;) {
          const issues = await issueService.list(workspaceSlug, projectId, { limit, offset });
          if (!issues.length) break;
          for (const issue of issues) {
            rows.push({ ...issue, project_id: projectId, project_name: project?.name });
          }
          if (issues.length < limit) break;
          offset += issues.length;
        }
      }

      if (format === 'json') {
        downloadBlob(
          new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }),
          `${base}.json`,
        );
      } else {
        downloadBlob(new Blob([toCsv(rows)], { type: 'text/csv' }), `${base}.csv`);
      }
    } catch {
      setError(t('settings.export.failed', 'Export failed. Please try again.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <SettingsPanel
      title={t('settings.export.title', 'Exports')}
      description={t(
        'settings.export.subtitle',
        'Export your project data in various formats and access your export history with download links.',
      )}
    >
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="export-project">
            {t('settings.export.exportingProject', 'Exporting project')}
          </Label>
          <Select value={projectValue} onValueChange={setProjectValue}>
            <SelectTrigger id="export-project" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t('settings.export.allProjects', 'All projects')}
              </SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="export-format">{t('settings.export.format', 'Format')}</Label>
          <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
            <SelectTrigger id="export-format" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">CSV</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="xlsx">{t('settings.export.formatExcel', 'Excel')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button disabled={exporting} onClick={() => void runExport()}>
          <DownloadIcon />
          {exporting
            ? t('settings.export.exporting', 'Exporting…')
            : t('settings.export.action', 'Export')}
        </Button>
      </div>

      {format === 'xlsx' && (
        <p className="text-muted-foreground text-sm">
          {t(
            'settings.export.xlsxHint',
            'Exports as a real Excel workbook (.xlsx) generated on the server.',
          )}
        </p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </SettingsPanel>
  );
}
