import type { Metadata } from 'next';
import Link from 'next/link';

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
          Nesta versão, não há SDK de análise de comportamento instalado no site. Planejamos
          medir acessos e engajamento para melhorar a experiência, mas qualquer ativação de
          ferramenta como PostHog exige atualização destas informações e configuração da
          coleta antes do início do rastreamento. Não tratamos esta página como autorização
          para gravar formulários ou dados de financiamento em ferramentas de analytics.
        </p>
      </section>

      <section>
        <h2>Como controlar</h2>
        <p>
          Você pode gerenciar ou apagar cookies e dados locais nas configurações do navegador.
          Desativar os itens necessários pode impedir o login ou a conservação de preferências.
          Para pedidos sobre seus dados, consulte nossa{' '}
          <Link className="underline" href="/privacidade">Política de Privacidade</Link> ou
          escreva para <a className="underline" href="mailto:contato@amortiza.me">contato@amortiza.me</a>.
        </p>
      </section>
    </>
  );
}
