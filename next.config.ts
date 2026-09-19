import type { NextConfig } from "next";

// Origens extras permitidas no dev (ex.: túnel cloudflared), via env — sem
// hardcode. Em produção `allowedDevOrigins` é ignorado pelo Next.
const devOrigins = (process.env.DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Build auto-contido para deploy em container (Railway/Docker): gera
  // `.next/standalone/server.js` com apenas o runtime necessário. Exige copiar
  // `.next/static` e `public/` para o diretório do standalone (ver Dockerfile).
  output: "standalone",
  serverExternalPackages: ["@react-pdf/renderer"],
  ...(devOrigins.length > 0 ? { allowedDevOrigins: devOrigins } : {}),
  headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/assinar",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
