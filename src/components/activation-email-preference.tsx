'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function ActivationEmailPreference({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function change() {
    setBusy(true);
    setError(false);
    try {
      const response = await fetch('/api/email-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offersEnabled: !enabled }),
      });
      if (!response.ok) throw new Error('preference unavailable');
      setEnabled(!enabled);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p>E-mails promocionais: <strong>{enabled ? 'ativados' : 'desativados'}</strong>.</p>
      <p className="text-muted-foreground">Avisos sobre sua conta e cobranças continuam normalmente.</p>
      <Button type="button" variant="outline" disabled={busy} onClick={change}>
        {busy ? 'Salvando...' : enabled ? 'Recusar ofertas por e-mail' : 'Reativar ofertas por e-mail'}
      </Button>
      {error && <p role="alert">Não foi possível salvar sua preferência. Tente novamente.</p>}
    </div>
  );
}
