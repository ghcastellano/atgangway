import type { Metadata, Viewport } from "next";
import { IconAnchor, IconCompass, IconPackage } from "@/components/Icon";
import PitchDeck from "./PitchDeck";
import { CONTACT_EMAIL, whatsappLink } from "@/lib/env";
import "./apresentacao.css";

export const metadata: Metadata = {
  title: "Uma nova conexão entre o porto e a tripulação",
  description: "Conheça a proposta do At Gangway e o convite para construir o negócio ao lado de quem conhece o setor marítimo.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/apresentacao" },
  openGraph: {
    title: "At Gangway — vamos construir essa conexão?",
    description: "Tecnologia e experiência marítima, juntas para levar conveniência à tripulação.",
    url: "/apresentacao", locale: "pt_BR", type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "At Gangway" }],
  },
  twitter: { card: "summary_large_image", title: "At Gangway — vamos construir essa conexão?", description: "Um convite para conectar tecnologia e negócio marítimo.", images: ["/og.png"] },
};
export const viewport: Viewport = { themeColor: "#0B1B30" };

function Heading({ eyebrow, children, lead }: { eyebrow: string; children: React.ReactNode; lead?: string }) {
  return <header className="ap-heading ap-reveal"><p className="ap-eyebrow">{eyebrow}</p><h2>{children}</h2>{lead && <p className="ap-lead">{lead}</p>}</header>;
}
function Card({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return <article className="ap-card ap-reveal"><span className="ap-card-num">{number}</span><h3>{title}</h3><p>{children}</p></article>;
}
function Harbor() {
  return <div className="ap-harbor ap-reveal" aria-label="Ilustração: uma conexão entre a cidade, o porto e a tripulação" role="img">
    <div className="ap-harbor-top"><span>PORTO DE SANTOS</span><span>CONEXÃO EM TERRA</span></div>
    <svg viewBox="0 0 600 390" fill="none" aria-hidden="true">
      <defs><linearGradient id="ap-sea" x1="0" y1="0" x2="600" y2="390"><stop stopColor="#13273F"/><stop offset="1" stopColor="#061222"/></linearGradient></defs>
      <circle cx="315" cy="192" r="165" stroke="currentColor" opacity=".1"/><circle cx="315" cy="192" r="116" stroke="currentColor" opacity=".12" strokeDasharray="4 9"/><path d="M20 310H580M20 340H580M20 370H580" stroke="currentColor" opacity=".1"/>
      <path d="M50 270V100H162V270M66 100V78H118V100M74 128H138M74 149H138M74 170H138M74 191H138" stroke="currentColor" strokeWidth="2" opacity=".4"/>
      <path d="M31 272H192V294H31" fill="#13273F" stroke="currentColor" opacity=".5"/>
      <g className="ap-vessel"><path d="M247 238H557L519 292H296Z" fill="url(#ap-sea)" stroke="#9FB4C8" strokeWidth="2"/><path d="M271 237V183H446V237M456 237V135H505V237M465 135V115H491V135M478 115V89" stroke="#9FB4C8" strokeWidth="2"/><path d="M286 195H323V225H286ZM335 195H372V225H335ZM384 195H430V225H384ZM467 150H478V162H467ZM486 150H497V162H486Z" fill="#9FB4C8" opacity=".25"/><path d="M289 265H514" stroke="#F0A030" strokeWidth="3"/><path d="M295 306Q320 315 345 306T395 306T445 306T495 306" stroke="#9FB4C8" opacity=".4" strokeWidth="2"/></g>
      <path className="ap-route-line" d="M139 226C191 141 203 129 273 136S341 158 362 217" stroke="#F0A030" strokeWidth="3" strokeDasharray="6 8"/>
      <circle cx="140" cy="226" r="7" fill="#F0A030"/><circle cx="362" cy="217" r="7" fill="#F0A030"/>
      <g transform="translate(214 99)"><rect width="54" height="54" rx="14" fill="#F0A030"/><path d="M16 20L27 14L38 20V34L27 40L16 34ZM16 20L27 26L38 20M27 26V40" stroke="#241802" strokeWidth="2"/></g>
    </svg>
    <div className="ap-harbor-bottom"><span><i/> Pedido antes da chegada</span><span>Entrega na prancha ↗</span></div>
  </div>;
}

export default function Apresentacao() {
  return <PitchDeck>
    <section id="1" className="ap-slide ap-dark" data-title="A ideia" aria-labelledby="ap-title-1">
      <div className="ap-orbs" aria-hidden="true"><i/><i/></div>
      <div className="ap-wrap ap-cover">
        <div className="ap-cover-copy">
          <p className="ap-eyebrow ap-reveal">UMA CONEXÃO QUE MERECE EXISTIR</p>
          <h1 id="ap-title-1" className="ap-reveal">O navio chega.<br/>A <em>conveniência</em><br/>também.</h1>
          <p className="ap-lead ap-reveal">Compras para a tripulação, organizadas antes da escala e entregues na prancha de embarque.</p>
          <p className="ap-cover-invite ap-reveal">Um convite para unir tecnologia e experiência marítima — começando pelo Porto de Santos.</p>
          <div className="ap-signature ap-reveal"><span className="ap-avatar">GC</span><span><b>Gustavo Castellano</b><small>Fundador · Tecnologia & produto</small></span></div>
        </div>
        <Harbor/>
        <div className="ap-cover-foot ap-reveal"><span>AT GANGWAY / PROPOSTA DE PARCERIA</span><span>12 capítulos · cerca de 5 minutos</span></div>
      </div>
    </section>

    <section id="2" className="ap-slide" data-title="O problema">
      <div className="ap-wrap">
        <Heading eyebrow="01 / O PROBLEMA" lead="Para quem trabalha embarcado, comprar algo simples pode depender de uma combinação difícil: tempo, acesso e alguém em terra.">A escala é curta.<br/>As necessidades <em>não esperam.</em></Heading>
        <div className="ap-grid3">
          <Card number="TEMPO" title="Nem sempre dá para sair">A rotina a bordo e a janela da escala podem tornar uma ida à cidade inviável.</Card>
          <Card number="ACESSO" title="O porto não é uma rua comum">A entrega precisa respeitar acesso, autorizações e a realidade de cada terminal.</Card>
          <Card number="COORDENAÇÃO" title="Cada compra vira uma negociação">Encontrar produto, combinar pagamento e acertar o recebimento exige esforço de quem já tem pouco tempo.</Card>
        </div>
        <div className="ap-statement ap-reveal"><span>O QUE QUEREMOS MUDAR</span><p>Uma necessidade cotidiana não deveria se transformar em uma operação à parte.</p></div>
      </div>
    </section>

    <section id="3" className="ap-slide ap-dark" data-title="A solução">
      <div className="ap-orbs" aria-hidden="true"><i/><i/></div>
      <div className="ap-wrap">
        <Heading eyebrow="02 / A SOLUÇÃO" lead="O At Gangway conecta a compra à escala do navio: uma experiência digital simples, apoiada por uma operação local bem coordenada.">Uma loja que acompanha<br/><em>o ritmo de quem embarca.</em></Heading>
        <div className="ap-solution">
          <div className="ap-solution-promise ap-reveal"><IconPackage size={42}/><h3>Da escolha<br/>à prancha.</h3><p>Conveniência pessoal para a tripulação, com informação clara sobre o pedido e o recebimento.</p></div>
          <div className="ap-category-grid">
            <div className="ap-reveal"><span>01</span><h3>Essenciais</h3><p>Higiene e cuidado pessoal.</p></div>
            <div className="ap-reveal"><span>02</span><h3>Pequenos confortos</h3><p>Alimentos, bebidas e itens do dia a dia.</p></div>
            <div className="ap-reveal"><span>03</span><h3>Conectividade</h3><p>Acessórios e opções para se manter conectado.</p></div>
            <div className="ap-reveal"><span>04</span><h3>Uma experiência só</h3><p>Escolher, pedir e acompanhar no mesmo lugar.</p></div>
          </div>
        </div>
        <p className="ap-note ap-reveal">O mix e a cobertura de entrega evoluem conforme disponibilidade e validação operacional.</p>
      </div>
    </section>

    <section id="4" className="ap-slide" data-title="A experiência">
      <div className="ap-wrap">
        <Heading eyebrow="03 / A EXPERIÊNCIA" lead="A tripulação resolve a compra. A operação coordena o caminho até o navio.">Menos combinações.<br/><em>Mais clareza em cada etapa.</em></Heading>
        <ol className="ap-journey">
          <li className="ap-reveal"><span>01</span><div className="ap-journey-symbol"><IconCompass size={32}/></div><h3>Conectar à escala</h3><p>Identificar o navio e conferir a possibilidade de atendimento.</p><small>CONTEXTO</small></li>
          <li className="ap-reveal"><span>02</span><div className="ap-journey-symbol"><IconPackage size={32}/></div><h3>Escolher e pedir</h3><p>Reunir os itens e conhecer as condições antes de confirmar.</p><small>CONVENIÊNCIA</small></li>
          <li className="ap-reveal"><span>03</span><div className="ap-journey-symbol">↗</div><h3>Acompanhar</h3><p>Ter visibilidade do andamento e da preparação da entrega.</p><small>CONFIANÇA</small></li>
          <li className="ap-reveal"><span>04</span><div className="ap-journey-symbol"><IconAnchor size={32}/></div><h3>Receber na prancha</h3><p>Concluir a entrega na janela e no local previamente combinados.</p><small>RESOLUÇÃO</small></li>
        </ol>
        <p className="ap-note ap-reveal">Atendimento sujeito à confirmação da escala, do acesso e das condições de entrega.</p>
      </div>
    </section>

    <section id="5" className="ap-slide ap-dark" data-title="O ponto de partida">
      <div className="ap-wrap ap-split">
        <div><Heading eyebrow="04 / FOCO PARA COMEÇAR" lead="Santos é o ponto de partida para aproximar produto, tripulação e operação. Uma base definida permite aprender de perto e corrigir rápido.">Começar perto.<br/>Aprender de verdade.<br/><em>Crescer com método.</em></Heading><p className="ap-note ap-reveal">Outros portos entram na conversa depois de demonstrarmos uma operação que possa ser repetida.</p></div>
        <div className="ap-port-chart ap-reveal">
          <div className="ap-chart-ring" aria-hidden="true"><i/><i/><span><IconAnchor size={48}/></span></div>
          <p className="ap-eyebrow">PRIMEIRO TERRITÓRIO</p><h3>Porto de Santos</h3>
          <div className="ap-chart-legend"><span>Tripulações</span><span>Parceiros locais</span><span>Operação portuária</span></div>
          <p>Um território para testar o ciclo completo.</p>
        </div>
      </div>
    </section>

    <section id="6" className="ap-slide" data-title="O negócio">
      <div className="ap-wrap">
        <Heading eyebrow="05 / A LÓGICA DO NEGÓCIO" lead="A receita parte da venda de produtos. A sustentabilidade depende do que resta depois de comprar, preparar, cobrar e entregar.">Conveniência para a tripulação.<br/><em>Uma operação que precisa fechar a conta.</em></Heading>
        <div className="ap-economics ap-reveal"><div><small>VENDA</small><b>Pedido</b></div><span aria-hidden="true">−</span><div><small>CUSTOS DIRETOS</small><b>Produto + operação</b></div><span aria-hidden="true">=</span><div className="ap-economics-result"><small>O QUE VALIDAR</small><b>Margem por entrega</b></div></div>
        <div className="ap-grid3">
          <Card number="01" title="Mix relevante">Descobrir o que a tripulação realmente quer comprar e a que preço.</Card>
          <Card number="02" title="Pedidos coordenados">Testar a consolidação por escala para aproveitar melhor cada deslocamento.</Card>
          <Card number="03" title="Recompra e indicação">Construir confiança para que a próxima escala gere uma nova escolha pelo At Gangway.</Card>
        </div>
        <p className="ap-note ap-reveal">Hipóteses a medir no piloto. Preços, custos e condições comerciais serão validados com a operação.</p>
      </div>
    </section>

    <section id="7" className="ap-slide ap-dark" data-title="O que já existe">
      <div className="ap-wrap">
        <Heading eyebrow="06 / PONTO DE PARTIDA REAL" lead="A construção já começou. Existe uma plataforma que permite sair da conversa abstrata e testar uma experiência concreta.">A tecnologia já tem forma.<br/><em>Agora, precisa encontrar o mercado.</em></Heading>
        <div className="ap-status-grid">
          <div className="ap-built ap-reveal"><span className="ap-status-label">BASE DESENVOLVIDA</span><ul><li>Loja digital e catálogo de produtos</li><li>Cadastro e vínculo com o navio</li><li>Carrinho, pedidos e acompanhamento</li><li>Painel para coordenar a operação</li></ul><a href="/" target="_blank" rel="noopener noreferrer" className="ap-text-link">Conhecer a plataforma <span aria-hidden="true">↗</span></a></div>
          <div className="ap-validation ap-reveal"><span className="ap-status-label">PRÓXIMA VALIDAÇÃO</span><h3>Produto funcionando<br/>na rotina do porto.</h3><p>Confirmar demanda, acesso, capacidade de entrega e viabilidade econômica em um piloto acompanhado.</p><p className="ap-note">Uma base tecnológica construída é o início. A prova do negócio vem da operação real.</p></div>
        </div>
      </div>
    </section>

    <section id="8" className="ap-slide" data-title="Resultados que buscamos">
      <div className="ap-wrap">
        <Heading eyebrow="07 / RESULTADOS QUE BUSCAMOS" lead="Queremos ser a escolha de conveniência da tripulação a cada nova escala — com um serviço útil e um negócio sustentável.">Sucesso é entregar valor.<br/><em>E conseguir repetir.</em></Heading>
        <div className="ap-scorecard">
          <article className="ap-reveal"><span>PARA A TRIPULAÇÃO</span><h3>Compra resolvida</h3><p>Menos esforço e mais previsibilidade.</p><small>MEDIR · satisfação e recompra</small></article>
          <article className="ap-reveal"><span>PARA A OPERAÇÃO</span><h3>Entrega confiável</h3><p>Pedidos completos na janela combinada.</p><small>MEDIR · prazo e ocorrências</small></article>
          <article className="ap-reveal"><span>PARA O NEGÓCIO</span><h3>Crescimento saudável</h3><p>Receita com margem após os custos diretos.</p><small>MEDIR · conversão e margem</small></article>
        </div>
        <p className="ap-note ap-reveal">Resultados pretendidos, ainda a demonstrar. As metas do piloto serão definidas em conjunto.</p>
      </div>
    </section>

    <section id="9" className="ap-slide ap-dark" data-title="O que falta construir">
      <div className="ap-wrap">
        <Heading eyebrow="08 / ONDE SUA EXPERIÊNCIA FAZ DIFERENÇA" lead="O próximo salto depende de decisões que precisam de vivência no setor marítimo.">O que falta não cabe<br/><em>só no código.</em></Heading>
        <div className="ap-gap-list">
          <article className="ap-reveal"><span>01</span><div><h3>Escutar o cliente certo</h3><p>Acessar tripulações, entender hábitos e validar a proposta com quem vai comprar.</p></div><b>DEMANDA</b></article>
          <article className="ap-reveal"><span>02</span><div><h3>Construir o caminho até o navio</h3><p>Articular parceiros e confirmar acessos, responsabilidades e janelas de atendimento.</p></div><b>OPERAÇÃO</b></article>
          <article className="ap-reveal"><span>03</span><div><h3>Transformar relacionamento em negócio</h3><p>Aproximar fornecedores e canais, negociar condições e desenvolver as primeiras oportunidades.</p></div><b>COMERCIAL</b></article>
          <article className="ap-reveal"><span>04</span><div><h3>Validar a conta completa</h3><p>Medir custos, capacidade e margem para decidir onde vale a pena crescer.</p></div><b>VIABILIDADE</b></article>
        </div>
      </div>
    </section>

    <section id="10" className="ap-slide" data-title="A complementaridade">
      <div className="ap-wrap">
        <Heading eyebrow="09 / A PARCERIA QUE BUSCO" lead="Quero alguém que participe das decisões, questione as hipóteses e ajude a construir o negócio desde esta etapa.">Eu trago a tecnologia.<br/><em>Você traz a leitura do mar.</em></Heading>
        <div className="ap-people">
          <article className="ap-person ap-reveal"><span className="ap-person-icon">GC</span><p className="ap-eyebrow">GUSTAVO CASTELLANO</p><h3>Tecnologia & produto</h3><ul><li>Construir e evoluir a plataforma</li><li>Transformar aprendizados em melhorias</li><li>Automatizar e dar visibilidade à operação</li></ul></article>
          <div className="ap-plus" aria-hidden="true">+</div>
          <article className="ap-person ap-person-partner ap-reveal"><span className="ap-person-icon"><IconCompass size={32}/></span><p className="ap-eyebrow">ESSE ESPAÇO PODE SER SEU</p><h3>Negócio marítimo</h3><ul><li>Trazer conhecimento do setor e do cliente</li><li>Construir relações comerciais e operacionais</li><li>Definir prioridades e validar a execução</li></ul></article>
        </div>
        <div className="ap-shared ap-reveal"><b>Juntos</b><span>Estratégia · decisões · aprendizados · resultados</span></div>
      </div>
    </section>

    <section id="11" className="ap-slide ap-dark" data-title="Como começar">
      <div className="ap-wrap">
        <Heading eyebrow="10 / UM PRIMEIRO PASSO CONCRETO" lead="Podemos começar com um escopo claro e aprender trabalhando juntos antes de definir uma relação de longo prazo.">Vamos testar o negócio.<br/><em>E a nossa forma de construir.</em></Heading>
        <div className="ap-grid3 ap-phases">
          <Card number="01 / ALINHAR" title="Escolher o primeiro recorte">Conversar com clientes e parceiros. Definir público, cobertura, responsabilidades e critérios de sucesso.</Card>
          <Card number="02 / OPERAR" title="Realizar um piloto acompanhado">Atender um grupo delimitado, observar a jornada completa e registrar custos, entregas e feedbacks.</Card>
          <Card number="03 / DECIDIR" title="Avaliar o próximo embarque">Revisar os resultados e a dinâmica de trabalho. Decidir ajustes, expansão e o formato da parceria.</Card>
        </div>
        <div className="ap-statement ap-reveal"><span>A PRIMEIRA CONVERSA</span><p>Onde você enxerga a maior oportunidade — e o que precisamos validar primeiro?</p></div>
      </div>
    </section>

    <section id="12" className="ap-slide ap-dark ap-final" data-title="O convite">
      <div className="ap-orbs" aria-hidden="true"><i/><i/></div>
      <div className="ap-wrap">
        <p className="ap-eyebrow ap-reveal">11 / O CONVITE</p>
        <h2 className="ap-reveal">A próxima conexão<br/>do At Gangway<br/><em>pode ser com você.</em></h2>
        <p className="ap-lead ap-reveal">Busco uma parceira que conheça o negócio marítimo e queira transformar essa base tecnológica em uma operação relevante para quem vive a bordo.</p>
        <div className="ap-invite-options ap-reveal"><div><h3>Começar como parceira</h3><p>Construir um piloto com escopo, contribuição e responsabilidades combinados.</p></div><div><h3>Explorar uma sociedade</h3><p>Se houver alinhamento, desenhar juntos dedicação, papéis e condições.</p></div></div>
        <div className="ap-final-actions ap-reveal"><a className="ap-cta" href={whatsappLink("Gustavo, vi a apresentação do At Gangway e quero conversar sobre uma parceria para construir o projeto.")} target="_blank" rel="noopener noreferrer">Vamos conversar sobre o projeto <span aria-hidden="true">↗</span></a><a className="ap-text-link" href={`mailto:${CONTACT_EMAIL}?subject=Parceria%20At%20Gangway`}>Prefiro conversar por e-mail ↗</a></div>
        <p className="ap-note ap-reveal">Gustavo Castellano · O primeiro passo é uma conversa.</p>
      </div>
    </section>
  </PitchDeck>;
}
