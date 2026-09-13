export function addCycle(date: Date, cycle: string): Date {
  const d = new Date(date.getTime());
  switch (cycle) {
    case 'MONTHLY':
      d.setUTCMonth(d.getUTCMonth() + 1);
      return d;
    case 'QUARTERLY':
      d.setUTCMonth(d.getUTCMonth() + 3);
      return d;
    case 'SEMIANNUALLY':
      d.setUTCMonth(d.getUTCMonth() + 6);
      return d;
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
