import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../ui';
import { IconChevronDown } from '../icons';
import { issueService } from '../../../services/issueService';
import { exportService } from '../../../services/exportService';
import type { ProjectApiResponse, WorkspaceApiResponse } from '../../../api/types';

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  workspaceSlug: string | undefined;
  workspace: WorkspaceApiResponse | null;
  projects: ProjectApiResponse[];
  exportFormat: string;
  exportProjectValue: string;
  setExportProjectValue: (value: string) => void;
  exporting: boolean;
  setExporting: (value: boolean) => void;
  setExportProjectOpen: (value: boolean) => void;
}

/** Export-issues modal: choose a project (or all) and download a CSV/JSON snapshot. */
export function ExportModal({
  open,
  onClose,
  workspaceSlug,
  workspace,
  projects,
  exportFormat,
  exportProjectValue,
  setExportProjectValue,
  exporting,
  setExporting,
  setExportProjectOpen,
}: ExportModalProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('settings.export.modalTitle', 'Export {{format}}', {
        format: exportFormat.toUpperCase(),
      })}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => setExportProjectOpen(false)}
            disabled={exporting}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            disabled={exporting}
            onClick={async () => {
              if (!workspaceSlug) return;
              setError(null);
              setExporting(true);
              try {
                const projectIds =
                  exportProjectValue === 'all' ? projects.map((p) => p.id) : [exportProjectValue];
                const base = `export-${workspace?.slug ?? workspaceSlug}-${new Date().toISOString().slice(0, 10)}`;

                // Excel is generated server-side (real .xlsx); CSV/JSON stay client-side.
                if (exportFormat === 'xlsx') {
                  const blob = await exportService.createXlsx(workspaceSlug, projectIds);
                  downloadBlob(blob, `${base}.xlsx`);
                  setExportProjectOpen(false);
                  return;
                }

                const allIssues: Array<
                  Record<string, unknown> & {
                    project_id?: string;
                    project_name?: string;
                  }
                > = [];
                // The server caps `limit` at 100, so page through in 100s.
                const limit = 100;
                for (const pid of projectIds) {
                  const proj = projects.find((p) => p.id === pid);
                  let offset = 0;
                  while (true) {
                    const issues = await issueService.list(workspaceSlug, pid, { limit, offset });
                    if (!issues.length) break;
                    for (const i of issues) {
                      allIssues.push({
                        ...i,
                        project_id: pid,
                        project_name: proj?.name,
                      });
                    }
                    if (issues.length < limit) break;
                    offset += issues.length;
                  }
                }
                let blob: Blob;
                let filename: string;
                if (exportFormat === 'json') {
                  const str = JSON.stringify(allIssues, null, 2);
                  blob = new Blob([str], { type: 'application/json' });
                  filename = `${base}.json`;
                } else {
                  const headers = [
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
                  const rows = allIssues.map((row) =>
                    headers
                      .map((h) => {
                        const v = row[h];
                        if (v === null || v === undefined) return '';
                        let s: string;
                        if (typeof v === 'object' && h === 'description') {
                          s = (row.description_html as string) ?? JSON.stringify(v);
                        } else {
                          s = String(v);
                        }
                        return s.includes(',') || s.includes('"') || s.includes('\n')
                          ? `"${s.replace(/"/g, '""')}"`
                          : s;
                      })
                      .join(','),
                  );
                  const csv = [headers.join(','), ...rows].join('\r\n');
                  blob = new Blob([csv], { type: 'text/csv' });
                  filename = `${base}.csv`;
                }
                downloadBlob(blob, filename);
                setExportProjectOpen(false);
              } catch {
                setError(t('settings.export.failed', 'Export failed. Please try again.'));
              } finally {
                setExporting(false);
              }
            }}
          >
            {exporting
              ? t('settings.export.exporting', 'Exporting…')
              : t('settings.export.action', 'Export')}
          </Button>
        </>
      }
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-(--txt-secondary)">
          {t('settings.export.projects', 'Projects')}
        </label>
        <div className="relative">
          <select
            value={exportProjectValue}
            onChange={(e) => setExportProjectValue(e.target.value)}
            className="w-full appearance-none rounded-(--radius-md) border border-(--border-subtle) bg-(--bg-surface-1) px-3 py-2 pr-8 text-sm text-(--txt-primary) focus:outline-none focus:border-(--border-strong)"
          >
            <option value="all">{t('settings.export.allProjects', 'All projects')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-(--txt-icon-tertiary)">
            <IconChevronDown />
          </span>
        </div>
        {exportFormat === 'xlsx' && (
          <p className="mt-2 text-sm text-(--txt-tertiary)">
            {t(
              'settings.export.xlsxHint',
              'Exports as a real Excel workbook (.xlsx) generated on the server.',
            )}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-(--txt-danger-primary)">{error}</p>}
      </div>
    </Modal>
  );
}
