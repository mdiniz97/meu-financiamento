import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBRL(v: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

export function parseBRLToNumber(s: string): number {
  const cleaned = s.replace(/[R$\s.]/g, '').replace(',', '.');
  return Number(cleaned) || 0;
}
