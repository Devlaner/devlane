import { useTranslation } from 'react-i18next';
import { ProjectIconDisplay } from '../../ProjectIconModal';
import type { ProjectApiResponse } from '../../../api/types';
import { IconSearch } from './icons';
import { dispatchOpenCommandPalette } from '../../../lib/commandPaletteEvents';

export function ProjectDetailHeader({
  project,
  title,
}: {
  workspaceSlug: string;
  projectId: string;
  project: ProjectApiResponse;
  title: string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div className="flex items-center gap-2 text-sm font-semibold text-(--txt-primary)">
        <span className="flex size-5 shrink-0 items-center justify-center">
          <ProjectIconDisplay
            emoji={project.emoji}
            icon_prop={project.icon_prop}
            size={16}
            className="leading-none"
          />
        </span>
        {title}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => dispatchOpenCommandPalette()}
          className="flex size-8 items-center justify-center rounded-md text-(--txt-icon-tertiary) hover:bg-(--bg-layer-transparent-hover) hover:text-(--txt-icon-secondary)"
          aria-label={t('common.search', 'Search')}
        >
          <IconSearch />
        </button>
      </div>
    </>
  );
}
