import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Termos de Uso',
  description: 'Condições de uso das ferramentas e dos planos do amortiza.me.',
};

export default function TermosPage() {
  return (
    <>
      <header>
        <h1>Termos de Uso</h1>
        <p>Última atualização: 24 de setembro de 2026.</p>
      </header>

      <section>
        <h2>Quem oferece o serviço</h2>
        <p>
          O amortiza.me é oferecido por SAFE CODE DESENVOLVIMENTO DE SOFTWARES LTDA,
          CNPJ 54.569.947/0001-47. Para dúvidas, suporte ou solicitações, escreva para{' '}
          <a className="underline" href="mailto:contato@amortiza.me">contato@amortiza.me</a>.
        </p>
      </section>

      <section>
        <h2>O que a plataforma faz</h2>
        <p>
          Oferecemos simuladores e conteúdos de educação financeira sobre financiamento
          imobiliário. Os resultados são estimativas baseadas nos dados fornecidos e nas
          premissas exibidas. Não constituem proposta de crédito, garantia de economia,
          consultoria financeira individual ou substituto das condições oficiais do banco.
          Confira números e decisões com sua instituição financeira e profissionais habilitados.
        </p>
      </section>

      <section>
        <h2>Conta e uso das ferramentas</h2>
        <p>
          Você é responsável pelos dados que informa, por manter acesso à conta protegido e
          por usar a plataforma de forma lícita. Algumas ferramentas exigem cadastro, créditos
          ou assinatura. Recursos e preços aplicáveis são mostrados antes de cada contratação.
          Simulações salvas podem ter prazo de acesso diferente conforme o plano; consulte a
          informação exibida no momento da contratação.
        </p>
      </section>

      <section>
        <h2>Créditos avulsos</h2>
        <p>
          Créditos adquiridos não expiram enquanto a conta permanecer ativa. Uma simulação que
          use créditos consome a quantidade informada antes de sua execução. Pagamento e
          liberação dos créditos são confirmados pelo provedor de pagamentos; retornar do
          checkout, por si só, não confirma a compra.
        </p>
      </section>

      <section>
        <h2>Assinatura e cancelamento</h2>
        <p>
          O plano Ilimitado é cobrado anualmente e renova automaticamente, pelo preço e pelas
          condições apresentados no momento da contratação. Você pode cancelar a renovação
          pela área <Link className="underline" href="/assinatura">Minha assinatura</Link>.
          Após cancelar, o acesso contratado permanece até o fim do período já pago;
          novas renovações deixam de ocorrer. O cancelamento da renovação não implica,
          por si só, reembolso do período em curso.
        </p>
      </section>

      <section>
        <h2>Arrependimento, problemas e reembolsos</h2>
        <p>
          Compras realizadas pela internet estão sujeitas ao direito de arrependimento
          previsto no art. 49 do Código de Defesa do Consumidor, quando aplicável. Direitos
          relativos a cobrança indevida, falhas no serviço e demais hipóteses previstas em lei
          também são preservados. Fora dessas situações, não oferecemos reembolso por simples
          cancelamento da renovação ou por período de assinatura já utilizado. Solicite análise
          pelo e-mail <a className="underline" href="mailto:contato@amortiza.me">contato@amortiza.me</a>.
        </p>
      </section>

      <section>
        <h2>Dados pessoais e alterações</h2>
        <p>
          Consulte nossa <Link className="underline" href="/privacidade">Política de Privacidade</Link>{' '}
          e <Link className="underline" href="/cookies">Política de Cookies</Link> para saber
          como tratamos dados. Podemos atualizar estes termos para refletir mudanças no serviço
          ou na legislação. A versão publicada indica sua data de atualização; alterações
          relevantes serão comunicadas pelos canais disponíveis.
        </p>
      </section>
    </>
  );
}
