const q = (f) => (/\s/.test(f) ? `"${f}"` : f);

export default {
  'ui/**/*.{ts,tsx}': (files) => {
    if (files.length === 0) return [];
    const args = files.map(q).join(' ');
    return [
      `npm --prefix ui exec -- eslint --max-warnings=0 --fix --config ui/eslint.config.js ${args}`,
      `npx prettier --write ${args}`,
    ];
  },
  'ui/**/*.{css,json,md}': (files) => (files.length ? [`npx prettier --write ${files.join(' ')}`] : []),
  'api/**/*.go': (files) => (files.length ? [`gofmt -w ${files.join(' ')}`] : []),
};
