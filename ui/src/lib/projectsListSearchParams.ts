export type ProjectsSortField = 'manual' | 'name' | 'created_date' | 'member_count';
export type ProjectsSortDir = 'asc' | 'desc';
export type ProjectsCreatedDateFilter = '' | 'today' | 'last7' | 'last30' | 'custom';

export interface ProjectsListSearchParamsState {
  searchQuery: string;
  sortField: ProjectsSortField;
  sortDir: ProjectsSortDir;
  accessFilters: Array<'private' | 'public'>;
  leadFilters: string[];
  memberFilters: string[];
  myProjectsOnly: boolean;
  createdDateFilter: ProjectsCreatedDateFilter;
  createdAfter: string | null;
  createdBefore: string | null;
  favoritesOnly: boolean;
}

function parseCsvParam(searchParams: URLSearchParams, key: string): string[] {
  return (searchParams.get(key) ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function parseProjectsListSearchParams(
  searchParams: URLSearchParams,
): ProjectsListSearchParamsState {
  const sortFieldParam = searchParams.get('sortField');
  const sortDirParam = searchParams.get('sortDir');
  const legacySortParam = searchParams.get('sort');
  const createdDateParam = searchParams.get('createdDate');

  const sortField: ProjectsSortField =
    sortFieldParam === 'manual' ||
    sortFieldParam === 'name' ||
    sortFieldParam === 'created_date' ||
    sortFieldParam === 'member_count'
      ? sortFieldParam
      : legacySortParam === 'name_asc' || legacySortParam === 'name_desc'
        ? 'name'
        : 'created_date';

  const sortDir: ProjectsSortDir =
    sortDirParam === 'asc' || sortDirParam === 'desc'
      ? sortDirParam
      : legacySortParam === 'created_asc' || legacySortParam === 'name_asc'
        ? 'asc'
        : 'asc';

  const createdDateFilter: ProjectsCreatedDateFilter =
    createdDateParam === 'today' ||
    createdDateParam === 'last7' ||
    createdDateParam === 'last30' ||
    createdDateParam === 'custom'
      ? createdDateParam
      : '';

  return {
    searchQuery: (searchParams.get('q') ?? '').toLowerCase().trim(),
    sortField,
    sortDir,
    accessFilters: parseCsvParam(searchParams, 'access').filter(
      (value): value is 'private' | 'public' => value === 'private' || value === 'public',
    ),
    leadFilters: parseCsvParam(searchParams, 'lead'),
    memberFilters: parseCsvParam(searchParams, 'members'),
    myProjectsOnly: searchParams.get('myProjects') === '1',
    createdDateFilter,
    createdAfter: searchParams.get('createdAfter'),
    createdBefore: searchParams.get('createdBefore'),
    favoritesOnly: searchParams.get('filter') === 'favorites',
  };
}
