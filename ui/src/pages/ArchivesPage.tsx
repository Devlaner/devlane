import { useParams } from 'react-router-dom';

export function ArchivesPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <h1 className="text-2xl font-semibold text-(--txt-primary)">Archives</h1>
      <p className="text-sm text-(--txt-secondary)">
        Archived projects and items. (Placeholder for {workspaceSlug})
      </p>
    </div>
  );
}
