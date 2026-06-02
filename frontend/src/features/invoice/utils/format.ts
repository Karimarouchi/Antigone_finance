export const MONTHS = [
  'JANVIER', 'FEVRIER', 'MARS', 'AVRIL', 'MAI', 'JUIN',
  'JUILLET', 'AOUT', 'SEPTEMBRE', 'OCTOBRE', 'NOVEMBRE', 'DECEMBRE',
];

export function fmt(n: number): string {
  const parts = n.toFixed(3).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${parts[0]},${parts[1]} DT`;
}

export function fmtDate(v: string): string {
  if (!v) return '';
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function nextNumber(type: string, lastNumbers: Record<string, string>): string {
  const year = new Date().getFullYear();
  const key  = `${type}-${year}`;
  const last = lastNumbers[key];
  if (!last) return `${year}-1`;
  const parts = last.split('-');
  const n = parseInt(parts[parts.length - 1], 10) || 0;
  return `${year}-${n + 1}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function parsePrice(raw: any): number {
  if (raw === '' || raw === null || raw === undefined) return NaN;
  const s = String(raw).replace(/\s/g, '').replace(',', '.');
  return parseFloat(s);
}

export function calcServiceSum(cats: any[]): number {
  return cats.flatMap((c: any) => c.selected || []).reduce((sum: number, svc: any) => {
    const v = parsePrice(svc.price);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
}
