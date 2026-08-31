import { hoursToCutoff, promiseLabel, type DeliveryPromise } from "@/lib/delivery";

/**
 * A tira da promessa de entrega — só a apresentação.
 *
 * Separada de quem busca no banco porque duas telas mostram a mesma
 * frase: o topo da loja e a página de portos. Duas implementações da
 * mesma promessa foi exatamente o que a revisão pegou — o limiar de
 * urgência e o formato da data teriam que ser mantidos em dois lugares,
 * e já tinham divergido no texto.
 */
export default function DeliveryStrip({
  promise,
  portName,
  compact = false,
}: {
  promise: DeliveryPromise | null;
  portName: string;
  compact?: boolean;
}) {
  // Sem janela aberta agora não se inventa data: a próxima abre e a
  // pessoa é avisada, em vez de receber uma promessa que não vale.
  if (!promise) {
    return (
      <div className={`deadline ${compact ? "compact" : ""}`}>
        ⏱ <span>{promiseLabel(null)} at {portName}</span>
      </div>
    );
  }

  const left = hoursToCutoff(promise, new Date());
  // Meio-dia UTC: a data já está na data local do porto, e ancorar no
  // meio do dia impede que o fuso do servidor a jogue para a véspera.
  const day = new Date(`${promise.deliveryDate}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  // Abaixo de 6h a janela vira alarme. Um limiar só, aqui.
  const urgent = left <= 6;

  return (
    <div className={`deadline ${urgent ? "urgent" : ""} ${compact ? "compact" : ""}`}>
      ⏱{" "}
      <span>
        {urgent ? "⚡ LAST CALL — " : ""}
        Order in the next <b>{left}h</b> · {promiseLabel(promise).toLowerCase()},{" "}
        <b>{day}</b> at {portName}
        {promise.minStayHours ? ` · vessel must stay ${promise.minStayHours}h` : ""}
      </span>
    </div>
  );
}
