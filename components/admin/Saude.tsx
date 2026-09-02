/**
 * A faixa de saúde do painel: o que está vivo e o que passou do prazo.
 *
 * Nasceu de um caso real: quatro navios ativos, todos com janela
 * vencida, e o painel mudo — cada linha certa, o conjunto sem dizer
 * "a loja está parada". O mesmo vale para o line-up que parou de
 * sincronizar e para o PTAX que ficou preso na cotação de ontem: cada
 * um deixa um número velho na tela, e número velho parece número.
 *
 * Régua de alerta (em vermelho):
 *   line-up  > 2h sem sync   (o cron é de hora em hora)
 *   PTAX     > 3 dias        (dias úteis; fim de semana não é alarme)
 *   cron     qualquer falha nas últimas 24h
 *   e-mail   nunca enviado, ou nenhum nos últimos 7 dias com pedidos abertos
 *
 * Servidor puro: recebe o JSON da RPC ops_health e desenha. Sem estado.
 */
import { santosTime } from "@/lib/format";

export type Saude = {
  agora: string;
  lineup: { ultimo_sync: string | null; escalas_futuras: number; janelas_abertas: number };
  ptax: { data_cotacao: string | null; buscada_em: string | null; venda: number | null };
  crons: { job: string; agenda: string; ativo: boolean; ultima: string | null; status: string | null; falhas_24h: number }[];
  pedidos: { abertos: number; aguardando_deposito_24h: number };
  emails: { ultimo_enviado: string | null };
};

const horas = (iso: string | null, agora: string) =>
  iso ? (new Date(agora).getTime() - new Date(iso).getTime()) / 36e5 : Infinity;

const idade = (h: number) =>
  !isFinite(h) ? "never" : h < 1 ? `${Math.round(h * 60)} min ago` : h < 48 ? `${Math.round(h)}h ago` : `${Math.round(h / 24)}d ago`;

export default function SaudeStrip({ s }: { s: Saude }) {
  const hSync = horas(s.lineup.ultimo_sync, s.agora);
  const dPtax = s.ptax.data_cotacao
    ? (new Date(s.agora).getTime() - new Date(s.ptax.data_cotacao + "T12:00:00Z").getTime()) / 864e5
    : Infinity;
  const cronRuim = s.crons.filter((c) => c.falhas_24h > 0 || !c.ativo || c.status === "failed");
  const hMail = horas(s.emails.ultimo_enviado, s.agora);

  const linhas: { alerta: boolean; rotulo: string; texto: string; quando: string }[] = [
    {
      alerta: hSync > 2,
      rotulo: "Line-up",
      texto: `${s.lineup.escalas_futuras} calls ahead · ${s.lineup.janelas_abertas} taking orders`,
      quando: `synced ${idade(hSync)}`,
    },
    {
      alerta: dPtax > 3,
      rotulo: "PTAX",
      texto: s.ptax.venda ? `R$ ${Number(s.ptax.venda).toFixed(4)} / USD` : "no rate on file",
      quando: s.ptax.data_cotacao ? `quote ${s.ptax.data_cotacao}` : "never",
    },
    {
      alerta: cronRuim.length > 0,
      rotulo: "Crons",
      texto: cronRuim.length
        ? cronRuim.map((c) => `${c.job}: ${c.falhas_24h} failure${c.falhas_24h === 1 ? "" : "s"} in 24h`).join(" · ")
        : s.crons.map((c) => c.job.replace("vessel-", "")).join(" · ") + " — all green",
      quando: s.crons.length ? `last run ${santosTime(s.crons.map((c) => c.ultima).filter(Boolean).sort().at(-1) as string)}` : "none",
    },
    {
      alerta: !isFinite(hMail) || (hMail > 24 * 7 && s.pedidos.abertos > 0),
      rotulo: "E-mail",
      texto: s.pedidos.aguardando_deposito_24h > 0
        ? `${s.pedidos.aguardando_deposito_24h} order${s.pedidos.aguardando_deposito_24h === 1 ? "" : "s"} awaiting deposit for over 24h`
        : `${s.pedidos.abertos} open order${s.pedidos.abertos === 1 ? "" : "s"}`,
      quando: `last sent ${idade(hMail)}`,
    },
  ];

  return (
    <ul className="saude" aria-label="Operations health">
      {linhas.map((l) => (
        <li key={l.rotulo} className={l.alerta ? "alerta" : ""}>
          <i aria-hidden />
          <span>
            <b>{l.rotulo}</b> · {l.texto}
          </span>
          <span className="quando">{l.quando}</span>
        </li>
      ))}
    </ul>
  );
}
