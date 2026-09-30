'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { activateTrialAction, markTrialOfferSeenAction } from '@/app/(app)/trial/actions';

const VIDEO_SRC = '/videos/trial-manifesto-v2.mp4';

interface TrialOfferContextValue {
  /** Abre a oferta manualmente (usado pelo card do perfil). */
  open: () => void;
}

const TrialOfferContext = createContext<TrialOfferContextValue | null>(null);

export function useTrialOffer(): TrialOfferContextValue | null {
  return useContext(TrialOfferContext);
}

/**
 * Renderiza a oferta do trial uma única vez e expõe `open()` para reabri-la.
 * O vídeo só é buscado quando a conta é elegível; para inelegíveis nada é
 * baixado.
 */
export function TrialOfferProvider({
  canOffer,
  autoOpen,
  children,
}: {
  canOffer: boolean;
  autoOpen: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const revealedRef = useRef(false);
  const video = useRef<HTMLVideoElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  const reveal = useCallback(() => {
    if (revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
    setOpen(true);
    void markTrialOfferSeenAction().catch(() => {
      // Se gravar falhar, a próxima visita autenticada pode oferecer de novo.
    });
  }, []);

  const openManually = useCallback(() => {
    setError('');
    reveal();
  }, [reveal]);

  const value = useMemo(() => ({ open: openManually }), [openManually]);

  useEffect(() => {
    if (!canOffer || !autoOpen || revealedRef.current || ready || fallback) return;
    const timer = window.setTimeout(() => {
      setFallback(true);
      reveal();
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [canOffer, autoOpen, ready, fallback, reveal]);

  function activate() {
    setError('');
    startTransition(async () => {
      try {
        const result = await activateTrialAction();
        if (result.status !== 'activated') {
          setError(result.status === 'offer_expired'
            ? 'Prazo de 48 horas encerrado.'
            : 'Não foi possível ativar esta oferta. Consulte seu perfil.');
          router.refresh();
          return;
        }
        setOpen(false);
        router.refresh();
      } catch {
        setError('Não foi possível ativar. Tente novamente.');
      }
    });
  }

  async function togglePlayback() {
    if (!video.current) return;
    if (video.current.paused) {
      try {
        await video.current.play();
      } catch {
        setError('Seu navegador bloqueou o vídeo. Você ainda pode ativar o trial normalmente.');
      }
    } else {
      video.current.pause();
    }
  }

  return (
    <TrialOfferContext.Provider value={value}>
      {children}
      {canOffer && !revealed && !fallback && (
        <video
          src={VIDEO_SRC}
          preload="auto"
          muted
          playsInline
          aria-hidden="true"
          className="pointer-events-none fixed -left-[9999px] h-px w-px opacity-0"
          onCanPlay={() => { setReady(true); reveal(); }}
          onError={() => { setFallback(true); reveal(); }}
        />
      )}
      <Dialog open={open} onOpenChange={next => { if (!next) setOpen(false); }}>
        <DialogContent
          aria-label="Ative grátis 7 dias do Ilimitado"
          showCloseButton={false}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-3xl"
          overlayClassName="bg-black/50 backdrop-blur-sm"
        >
          <div className="grid sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
            {!fallback && (
              <div className="relative flex max-h-[35dvh] items-center justify-center overflow-hidden bg-black sm:max-h-[70dvh]">
                <video
                  ref={video}
                  src={VIDEO_SRC}
                  autoPlay={!reducedMotion}
                  muted={muted}
                  loop
                  playsInline
                  preload="auto"
                  className="h-full w-full object-contain"
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 left-2"
                  onClick={() => void togglePlayback()}
                >
                  {playing ? 'Pausar vídeo' : 'Reproduzir vídeo'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-2 right-2"
                  onClick={() => setMuted(current => !current)}
                >
                  {muted ? 'Ativar som' : 'Silenciar vídeo'}
                </Button>
              </div>
            )}
            <div className="flex flex-col gap-4 p-5 sm:justify-center sm:p-8">
              <DialogTitle className="font-display text-xl font-bold leading-tight sm:text-2xl">
                Ative grátis 7 dias do Ilimitado
              </DialogTitle>
              <DialogDescription className="text-base font-medium text-foreground">
                Sem cartão. Sem cobrança automática.
              </DialogDescription>
              <p className="text-sm text-muted-foreground">
                Experimente simulações ilimitadas, ferramentas exclusivas e exportação em PDF.
                O trial começa quando você ativar, sem gastar seus créditos.
              </p>
              <p className="text-sm font-semibold text-primary">
                Oferta disponível somente nas primeiras 48 horas após criar sua conta.
              </p>
              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
              <div className="flex flex-col gap-2">
                <Button className="h-10" type="button" disabled={pending} onClick={activate}>Ativar 7 dias grátis</Button>
                <Button className="h-10" type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>Agora não</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TrialOfferContext.Provider>
  );
}
