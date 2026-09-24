import type { Metadata } from 'next';
import Link from 'next/link';
import { AnalyticsPreferencesButton } from '@/components/analytics-consent';

export const metadata: Metadata = {
  title: 'Política de Cookies',
  description: 'Cookies e armazenamento local utilizados pelo amortiza.me.',
};

export default function CookiesPage() {
  return (
    <>
      <header>
        <h1>Política de Cookies</h1>
        <p>Última atualização: 24 de setembro de 2026.</p>
      </header>

      <section>
        <h2>Armazenamento necessário</h2>
        <p>
          O site utiliza cookies de sessão e autenticação para permitir login, manter sua
          sessão e proteger o acesso à conta. A preferência de tema (claro, escuro ou do
          sistema) é guardada no armazenamento local do navegador. Serviços envolvidos na
          entrega, segurança e login, como Cloudflare e Google, também podem utilizar
          tecnologias necessárias às suas respectivas funções.
        </p>
      </section>

      <section>
        <h2>Análise de uso</h2>
        <p>
          Com sua autorização, enviamos ao PostHog páginas visitadas (caminho sem parâmetros
          de URL), origem de campanha válida e etapas concluídas de simulação, início de
          checkout, cliques nos botões de compra e compra confirmada. A escolha é opcional:
          recusar não impede usar o site.
          Não gravamos sessões, cliques automáticos, respostas de formulários, valores ou detalhes
          de financiamento. Visitantes autorizados recebem um identificador temporário da sessão;
          contas autorizadas usam identificador de conta. O PostHog pode processar endereço IP
          no recebimento dos eventos; usamos a região de hospedagem dos EUA.
        </p>
      </section>

      <section>
        <h2>Como controlar</h2>
        <p>
          Você pode gerenciar ou apagar cookies e dados locais nas configurações do navegador.
          Desativar os itens necessários pode impedir o login ou a conservação de preferências.
          A preferência de análise fica no armazenamento local; para visitantes autorizados,
          o identificador temporário fica no armazenamento da sessão. Para contas, a escolha
          também fica salva no servidor. Você pode <AnalyticsPreferencesButton /> a qualquer
          momento; a recusa interrompe novos eventos, sem apagar automaticamente dados já enviados.
          Para pedidos sobre seus dados, consulte nossa{' '}
          <Link className="underline" href="/privacidade">Política de Privacidade</Link> ou
          escreva para <a className="underline" href="mailto:contato@amortiza.me">contato@amortiza.me</a>.
        </p>
      </section>
    </>
  );
}
