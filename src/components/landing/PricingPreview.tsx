import Link from "next/link";
import { CheckIcon, Coins, XIcon, ZapIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { UnlimitedPrice } from '@/components/unlimited-price';
import { startSubscription } from '@/app/assinar/actions';

// Lista única de recursos: o card de créditos marca ✓ no que tem e ✗ no que é
// exclusivo do Ilimitado; os cards pagos marcam tudo ✓.
interface PlanFeature {
  label: string;
  credits: boolean;
  creditsNote?: string;
  paidNote?: string;
}

const planFeatures: PlanFeature[] = [
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

function FeatureList({ variant }: { variant: 'credits' | 'paid' }) {
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

export function PricingPreview({ signedIn = false }: { signedIn?: boolean }) {
  return (
    <section className="border-b border-border">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Planos simples, preços honestos
          </h2>
          <p className="mt-3 text-lg text-muted-foreground">
            Comece grátis com 10 créditos de boas-vindas e evolua quando precisar.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-6xl grid-cols-1 border border-border md:grid-cols-3">
          <div className="flex flex-col gap-5 p-7 transition-all duration-200 hover:-translate-y-1 hover:border-primary/30">
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-4xl font-bold tracking-tight">R$ 10</span>
              <span className="text-sm font-medium text-muted-foreground">
                por 5 créditos
              </span>
            </div>
            <p className="text-sm font-semibold">Para tirar dúvidas pontuais</p>
            <FeatureList variant="credits" />
            <Link
              href={signedIn ? "/perfil" : "/cadastro"}
              className={cn(buttonVariants({ variant: "outline" }), "mt-auto h-11 text-base")}
            >
              <Coins className="size-4" />
              Comprar créditos
            </Link>
          </div>

          <div className="flex flex-col gap-5 border-t p-7 transition-all duration-200 hover:-translate-y-1 hover:border-primary/30 md:border-l md:border-t-0">
            <UnlimitedPrice priceCents={1890} cycle="MONTHLY" />
            <p className="text-sm font-semibold">Ilimitado mensal · mesmos recursos</p>
            <FeatureList variant="paid" />
            {signedIn ? (
              <form action={startSubscription.bind(null, 'MONTHLY')} className="mt-auto w-full">
                <Button type="submit" variant="outline" className="h-11 w-full text-base">
                  <ZapIcon className="size-4" /> Assinar mensal
                </Button>
              </form>
            ) : (
              <Link href="/cadastro?callbackUrl=%2Fassinar%3Fcycle%3DMONTHLY" className={cn(buttonVariants({ variant: 'outline' }), 'mt-auto h-11 text-base')}>
                <ZapIcon className="size-4" /> Assinar mensal
              </Link>
            )}
          </div>
          <div className="flex flex-col gap-5 border-2 border-primary p-7 transition-all duration-200 hover:-translate-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <UnlimitedPrice />
              <span className="bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                Melhor para quem vai financiar
              </span>
            </div>
            <p className="text-sm font-semibold">Ilimitado anual · melhor preço</p>
            <p className="text-xs text-muted-foreground">Equivale a R$ 9,99/mês, cobrado de uma vez por ano.</p>
            <FeatureList variant="paid" />
            {signedIn ? (
              <form action={startSubscription.bind(null, 'YEARLY')} className="mt-auto w-full">
                <Button type="submit" className="h-11 w-full gap-2 text-base">
                  <ZapIcon className="size-4" />
                  Assinar plano Ilimitado anual
                </Button>
              </form>
            ) : (
              <Link
                href="/cadastro?callbackUrl=%2Fassinar%3Fcycle%3DYEARLY"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "mt-auto h-11 items-center gap-2 text-base"
                )}
              >
                <ZapIcon className="size-4" />
                Assinar plano Ilimitado anual
              </Link>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Cancele quando quiser, sem multa. Créditos nunca expiram. Preços em reais (BRL).
        </p>
      </div>
    </section>
  );
}
