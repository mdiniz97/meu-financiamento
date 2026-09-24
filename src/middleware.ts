import { NextResponse, type NextRequest } from 'next/server';
import { PATHNAME_HEADER, pathnameHeaderValue } from '@/lib/request-path';

/**
 * Publica o caminho pedido num cabeçalho de requisição. O layout de `(app)` não
 * recebe o pathname, então sem isso o redirect de login não consegue preservar
 * para onde a pessoa ia.
 *
 * O valor é controlado por nós (sobrescrevemos o cabeçalho), e ainda assim o
 * consumo passa por `sanitizeNext` — defesa em profundidade, já que um
 * cabeçalho é entrada de fora.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const headers = new Headers(request.headers);
  headers.set(PATHNAME_HEADER, pathnameHeaderValue(pathname, search));

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Só páginas: APIs e arquivos estáticos não precisam do cabeçalho.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
