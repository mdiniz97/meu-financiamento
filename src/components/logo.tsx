/**
 * Logo da aplicação: casa + finanças (gráfico ascendente dentro do telhado),
 * em quadrado roxo arredondado.
 */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Logo Raio X do Financiamento"
      role="img"
    >
      <rect width="40" height="40" rx="11" fill="#820AD1" />
      {/* telhado */}
      <path
        d="M9 19.5 L20 9.5 L31 19.5"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* corpo da casa */}
      <path
        d="M13 20.5 V30 H27 V20.5"
        stroke="white"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* gráfico ascendente (finanças) dentro da casa */}
      <path
        d="M15.5 27 L18.5 23.5 L21 25.5 L24.5 21"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21.8 21 H24.5 V23.7"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
