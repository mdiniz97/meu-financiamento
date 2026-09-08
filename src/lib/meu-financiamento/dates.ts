const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Soma meses a uma data ISO 'YYYY-MM-DD' preservando o dia (clamp no mês-alvo). */
export function addMonthsISO(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const daysInTarget = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, daysInTarget));
  return target.toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
export function formatDataBr(iso: string): string {
  if (!DATA_ISO_RE.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** 'YYYY-MM-DD' → 'jul/2036' */
export function formatMesAno(iso: string): string {
  if (!DATA_ISO_RE.test(iso)) return '';
  const [y, mes] = iso.split('-');
  return `${MESES_CURTOS[Number(mes) - 1]}/${y}`;
}

/** Data local atual em 'YYYY-MM-DD' (input type=date). */
export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
