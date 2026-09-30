'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { referralInvitationMessage } from '@/lib/referrals/invitation-message';

export function CopyLink({ code, origin, disabled }: { code: string; origin: string; disabled: boolean }) {
  const link = `${origin}/indicar/c/${code}`;
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(referralInvitationMessage(link));
    setCopied(true);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Input aria-label="Seu link" readOnly value={link} className="h-10 flex-1 bg-background" />
      <Button type="button" className="h-10" onClick={copy} disabled={disabled}>{copied ? 'Convite copiado' : 'Copiar convite'}</Button>
    </div>
  );
}
