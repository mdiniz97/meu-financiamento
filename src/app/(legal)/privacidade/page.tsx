import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description: 'Como o amortiza.me trata dados pessoais e como exercer seus direitos.',
};

export default function PrivacidadePage() {
  return (
    <>
      <header>
        <h1>Política de Privacidade</h1>
        <p>Última atualização: 25 de setembro de 2026.</p>
      </header>

      <section>
        <h2>Responsável e contato</h2>
        <p>
          SAFE CODE DESENVOLVIMENTO DE SOFTWARES LTDA (CNPJ 54.569.947/0001-47)
          é responsável pelo tratamento de dados no amortiza.me. Para dúvidas ou pedidos
          relacionados a seus dados, escreva para{' '}
          <a className="underline" href="mailto:contato@amortiza.me">contato@amortiza.me</a>.
        </p>
      </section>

      <section>
        <h2>Quais dados usamos e para quê</h2>
        <ul>
          <li>Nome, e-mail e identificador de conta: cadastro, autenticação e comunicação.</li>
          <li>
            Dados de simulações e financiamento que você informa (como saldos, taxas, prazos e
            movimentações): calcular e guardar os cenários solicitados.
          </li>
          <li>
            Histórico de créditos, assinatura, pagamentos e notas fiscais: liberar acesso,
            prestar suporte e cumprir obrigações contratuais, fiscais e legais.
          </li>
          <li>
            Dados técnicos necessários ao funcionamento e segurança do site: manter sessões,
            prevenir abuso e diagnosticar falhas.
          </li>
          <li>
            Para análise de uso: identificador aleatório do visitante por até
            30 dias ou identificador de conta, caminhos de páginas e links internos sem
            parâmetros, domínio do site de origem, campanha válida e eventos de cadastro,
            simulação concluída, checkout iniciado, cliques de compra e compra confirmada.
            Não enviamos valores, dados de financiamento, conteúdo de formulários ou e-mail
            à ferramenta de análise.
          </li>
          <li>
            Para medição de publicidade: uma tag de terceiro pode processar dados técnicos
            de navegação, identificadores do navegador e origem de campanhas para avaliar
            desempenho de anúncios e cadastros concluídos. Não configuramos eventos próprios
            de conversão de compra nessa tag nesta etapa.
          </li>
        </ul>
        <p>
          O cadastro em produção utiliza um provedor externo de autenticação. Quando o
          cadastro por e-mail está disponível, a senha é armazenada como hash, não em texto
          puro. Dados completos de cartão são informados no checkout do prestador de
          pagamentos, não nos formulários do nosso site.
        </p>
      </section>

      <section>
        <h2>Fundamentos e compartilhamento</h2>
        <p>
          Tratamos dados necessários à execução do serviço solicitado, ao cumprimento de
          obrigações legais e, quando cabível, à segurança e melhoria da plataforma,
          observados seus direitos. Prestadores envolvidos na operação podem tratar dados
          para autenticação, processamento de pagamentos e notas fiscais, envio de e-mails,
          hospedagem e banco de dados, entrega e proteção do site, análise de uso e medição
          de publicidade.
          Alguns desses serviços podem processar dados fora do Brasil; a análise de uso
          utiliza infraestrutura nos EUA e descarta o IP antes de armazenar eventos.
          Não vendemos seus dados pessoais. Você pode solicitar informações sobre os
          compartilhamentos aplicáveis pelo contato indicado acima.
        </p>
      </section>

      <section>
        <h2>Conservação e segurança</h2>
        <p>
          Dados de conta e simulações são mantidos enquanto necessários à prestação do serviço
          e ao atendimento das finalidades descritas. Registros de compras, pagamentos e notas
          podem precisar ser conservados por prazos legais e para defesa de direitos, mesmo
          após o encerramento da conta. O fim do acesso a uma simulação salva não significa
          necessariamente sua eliminação imediata do banco de dados. Aplicamos controles de
          acesso e medidas técnicas para proteger as informações, sem prometer segurança absoluta.
        </p>
      </section>

      <section>
        <h2>Seus direitos</h2>
        <p>
          Você pode solicitar confirmação de tratamento, acesso, correção, informações sobre
          compartilhamento, portabilidade quando aplicável, e exclusão ou anonimização dos
          dados nas hipóteses previstas pela LGPD. Envie o pedido para{' '}
          <a className="underline" href="mailto:contato@amortiza.me">contato@amortiza.me</a>.
          Podemos confirmar sua identidade antes de responder. Pedidos de eliminação são
          analisados considerando obrigações legais e contratuais; não há exclusão automática
          de todas as informações apenas pelo envio do pedido.
        </p>
      </section>

      <section>
        <h2>Cookies e mudanças</h2>
        <p>
          Veja a <Link className="underline" href="/cookies">Política de Cookies</Link> para
          conhecer o armazenamento usado pelo site e desativar ou reativar a análise de uso.
          Esse controle não desativa a tag de publicidade. A desativação da análise de uso
          interrompe novos eventos dessa ferramenta, sem eliminar automaticamente os já enviados.
          Alterações relevantes serão comunicadas pelos canais disponíveis.
        </p>
      </section>
    </>
  );
}
