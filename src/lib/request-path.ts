/**
 * Cabeçalho onde o middleware grava o caminho pedido, para que o layout do
 * grupo `(app)` consiga mandá-lo como `next` no redirect de login.
 *
 * O layout de um grupo de rotas **não recebe** o pathname do Next — sem esse
 * cabeçalho ele não tem como saber qual página a pessoa queria abrir.
 *
 * Fica num módulo próprio (e sem dependências) porque o middleware roda no
 * runtime de edge.
 */
export const PATHNAME_HEADER = 'x-pathname';

export function pathnameHeaderValue(pathname: string, search: string): string {
  return `${pathname}${search}`;
}
