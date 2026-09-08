export type ArticleBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'note'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'table'; caption: string; headers: string[]; rows: string[][] }
  | { type: 'links'; items: { label: string; href: string }[] };

export interface Article {
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  cta: { label: string; href: string };
  blocks: ArticleBlock[];
  sources: { label: string; href: string }[];
}
