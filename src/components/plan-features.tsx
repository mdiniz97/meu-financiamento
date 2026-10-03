import { CheckIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Matriz única de recursos dos planos. O card de créditos marca ✓ no que tem e
 * ✗ (cinza, riscado) no que é exclusivo do Ilimitado; os cards pagos marcam ✓.
 */
export interface PlanFeature {
  label: string;
  credits: boolean;
  creditsNote?: string;
  paidNote?: string;
}

export const planFeatures: PlanFeature[] = [
  { label: 'Simulações completas', credits: true, creditsNote: '1 crédito cada', paidNote: 'ilimitadas, sem consumir créditos' },
  { label: 'Simulador nos sistemas PRICE e SAC', credits: true },
  { label: 'Amortizações extras e FGTS', credits: true },
  { label: 'Simulações salvas', credits: true, creditsNote: 'por 6 horas', paidNote: 'enquanto assinante' },
  { label: 'Análise do financiamento', credits: false },
  { label: 'Amortizador inteligente: menos juros e prazo mais curto', credits: false },
  { label: 'Comparação SAC × PRICE ao vivo', credits: false },
  { label: 'Exportação da análise em PDF', credits: false },
  { label: 'Portabilidade de financiamento', credits: false },
  { label: 'Comparar propostas de bancos', credits: false },
  { label: 'Ferramentas de decisão: qual imóvel cabe, comprar na planta, investir ou amortizar, meta de quitação, alugar ou comprar e consórcio', credits: false },
];

export function FeatureList({ variant }: { variant: 'credits' | 'paid' }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {planFeatures.map((feature) => {
        const has = variant === 'paid' || feature.credits;
        const note = variant === 'paid' ? feature.paidNote : feature.creditsNote;
        return (
          <li key={feature.label} className={cn('flex items-start gap-2.5 text-sm', !has && 'opacity-50')}>
            {has ? (
              <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : (
              <XIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span className={cn(!has && 'text-muted-foreground line-through')}>
              {feature.label}
              {note ? ` · ${note}` : ''}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
