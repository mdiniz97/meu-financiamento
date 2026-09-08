import Image from 'next/image';
import { SITE_NAME } from '@/lib/site';
import { cn } from '@/lib/utils';

export function Logo({
  size = 32,
  variant = 'symbol',
  className,
}: {
  size?: number;
  variant?: 'symbol' | 'full';
  className?: string;
}) {
  const full = variant === 'full';
  return (
    <Image
      src={full ? '/brand/logo.png' : '/brand/symbol.png'}
      width={full ? Math.round(size * 1000 / 211) : size}
      height={size}
      alt={`Logo ${SITE_NAME}`}
      className={cn('h-auto shrink-0 object-contain', full && 'dark:brightness-0 dark:invert', className)}
      loading="eager"
    />
  );
}
