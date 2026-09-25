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
        <p>Última atualização: 25 de setembro de 2026.</p>
      </header>

      <section>
        <h2>Armazenamento necessário</h2>
        <p>
          O site utiliza cookies de sessão e autenticação para permitir login, manter sua
          sessão e proteger o acesso à conta. A preferência de tema (claro, escuro ou do
          sistema) é guardada no armazenamento local do navegador. Serviços envolvidos na
          entrega, segurança e login também podem utilizar tecnologias necessárias às suas
          respectivas funções.
        </p>
      </section>

      <section>
        <h2>Medição de publicidade</h2>
        <p>
          Uma tag de publicidade carregada nas páginas pode usar cookies e identificadores
          do navegador para medir campanhas e visitas. O controle de análise de uso abaixo
          não desativa essa tag; você pode restringir cookies e rastreadores nas configurações
          do navegador.
        </p>
      </section>

      <section>
        <h2>Análise de uso</h2>
        <p>
          Medimos uso do site com ferramenta de análise sem exigir aceite prévio. Registramos páginas
          visitadas e destinos de links internos (caminhos sem parâmetros de URL), origem
          de campanha válida, domínio do site de origem, cliques em botões de compra e etapas
          concluídas de cadastro, simulação, checkout e compra confirmada. Não gravamos replay
          de sessões, respostas de formulários, valores ou detalhes de financiamento. Para visitantes não logados,
          o identificador aleatório dura até 30 dias no armazenamento local; para contas,
          usamos o identificador da conta. O prestador de análise processa IP no recebimento dos eventos,
          mas está configurado para descartá-lo antes de armazená-los. Dados ficam na região
          de hospedagem dos EUA.
        </p>
      </section>

      <section>
        <h2>Como controlar</h2>
        <p>
          Você pode gerenciar ou apagar cookies e dados locais nas configurações do navegador.
          Desativar os itens necessários pode impedir o login ou a conservação de preferências.
          A análise começa habilitada. Você pode <AnalyticsPreferencesButton /> a qualquer
          momento. A desativação interrompe novos eventos neste navegador e, ao entrar na
          conta, fica salva também no servidor. Preferências de recusa anteriores continuam
          respeitadas. A desativação não apaga automaticamente dados já enviados.
          Para pedidos sobre seus dados, consulte nossa{' '}
          <Link className="underline" href="/privacidade">Política de Privacidade</Link> ou
          escreva para <a className="underline" href="mailto:contato@amortiza.me">contato@amortiza.me</a>.
        </p>
      </section>
    </>
  );
}
