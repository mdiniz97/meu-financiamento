import custosCompra from './blog/custos-compra';
import sacPrice from './blog/sac-price';
import quitarAntes from './blog/quitar-antes';
import compararBancos from './blog/comparar-bancos';
import investirAmortizar from './blog/investir-amortizar';
import portabilidade from './blog/portabilidade';
import juros from './blog/juros';
import type { Article } from './blog/types';

export type { Article, ArticleBlock } from './blog/types';

export const ARTIGOS: Article[] = [
  custosCompra, sacPrice, quitarAntes, compararBancos, investirAmortizar, portabilidade, juros,
];

export function getArtigo(slug: string): Article | undefined {
  return ARTIGOS.find((artigo) => artigo.slug === slug);
}

export function getArticleReadMinutes(artigo: Pick<Article, 'blocks'>): number {
  const text = artigo.blocks.map((block) => {
    switch (block.type) {
      case 'ul':
      case 'ol':
        return block.items.join(' ');
      case 'table':
        return [block.caption, ...block.headers, ...block.rows.flat()].join(' ');
      case 'links':
        return block.items.map((item) => item.label).join(' ');
      default:
        return block.text;
    }
  }).join(' ');
  const words = text.match(/\S+/g)?.length ?? 0;
  return Math.max(1, Math.ceil(words / 200));
}
