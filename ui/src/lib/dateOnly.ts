function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Parse YYYY-MM-DD as a *local* date (avoids UTC off-by-one). */
export function parseISODateLocal(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return new Date(iso); // fallback for non-date-only strings
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d);
}

/** Format a Date (local) as YYYY-MM-DD (date-only). */
export function toISODateLocal(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function formatISODateDisplay(iso: string): string {
  const d = parseISODateLocal(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
