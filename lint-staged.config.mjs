export default {
  'ui/**/*.{ts,tsx}': (files) => {
    const rel = files.map((f) => f.replace(/^ui[/\\]/, ''));
    if (rel.length === 0) return [];
    return [`npm --prefix ui exec -- eslint --max-warnings=0 --fix ${rel.join(' ')}`];
  },
  'ui/**/*.{css,json,md}': (files) => (files.length ? [`npx prettier --write ${files.join(' ')}`] : []),
  'api/**/*.go': (files) => (files.length ? [`gofmt -w ${files.join(' ')}`] : []),
};
