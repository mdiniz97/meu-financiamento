import { redirect } from 'next/navigation';

export default async function ArtigoRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/blog/${slug}`);
}
