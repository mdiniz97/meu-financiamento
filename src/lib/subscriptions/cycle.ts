export function addCycle(date: Date, cycle: string): Date {
  const d = new Date(date.getTime());
  const months = cycle === 'MONTHLY' ? 1 : cycle === 'QUARTERLY' ? 3 : cycle === 'SEMIANNUALLY' ? 6 : 0;
  if (months) {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + months);
    const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, lastDay));
    return d;
  }
  switch (cycle) {
    case 'YEARLY': {
      const year = d.getUTCFullYear();
      const month = d.getUTCMonth();
      const day = d.getUTCDate();
      // 29/02 em ano não bissexto transborda para 01/03; a regra pede 28/02.
      if (month === 1 && day === 29) {
        d.setUTCFullYear(year + 1, 1, 28);
      } else {
        d.setUTCFullYear(year + 1);
      }
      return d;
    }
    default:
      throw new Error(`cycle não suportado: ${cycle}`);
  }
}
