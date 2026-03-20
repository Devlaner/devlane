/**
 * Workspace-related constants (e.g. form options).
 */

export const ORGANIZATION_SIZE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: '', label: 'Select a range' },
  { value: '1-5', label: '1-5' },
  { value: '6-10', label: '6-10' },
  { value: '11-50', label: '11-50' },
  { value: '51-200', label: '51-200' },
  { value: '201+', label: '201+' },
];
