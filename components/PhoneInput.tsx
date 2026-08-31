"use client";

import { useEffect, useState } from "react";
import { COUNTRIES, buildPhone, detectCountry, dialOf, splitE164 } from "@/lib/countries";

/**
 * Telefone com seletor de país.
 *
 * Quem escolhe o DDI, em ordem de prioridade:
 *
 *   1. O número já salvo no perfil. Se existe um +55 gravado, é o
 *      número que funciona — nada o sobrescreve.
 *   2. A escolha manual da pessoa no seletor. Uma vez que ela mexeu,
 *      não mexemos mais.
 *   3. A NACIONALIDADE declarada no cadastro, enquanto o campo do
 *      número estiver vazio. Era o elo que faltava: dava para declarar
 *      Rússia e ficar com +55 do lado, porque o país vinha do fuso do
 *      aparelho — e o aparelho está em Santos.
 *   4. O fuso/idioma do aparelho, como último palpite.
 *
 * A nacionalidade é palpite, não regra: russo embarcado costuma
 * carregar chip brasileiro ou filipino. Por isso ela só age enquanto
 * ninguém digitou nada — nunca apaga número que já existe.
 *
 * O <select> nativo é de propósito: no celular vira a roda do sistema,
 * mais rápida que qualquer combobox custom.
 */
export default function PhoneInput({
  value,
  onChange,
  required,
  label = "WhatsApp",
  hint,
  countryHint,
}: {
  value: string;
  onChange: (fullNumber: string) => void;
  required?: boolean;
  /** A espec chama este campo de "Telephone number"; a operação chama de WhatsApp. */
  label?: string;
  hint?: string;
  /** ISO-3166 alfa-2 da nacionalidade declarada. Só vale enquanto o campo está vazio. */
  countryHint?: string | null;
}) {
  const [country, setCountry] = useState("BR");
  const [local, setLocal] = useState("");
  const [touched, setTouched] = useState(false);
  const [seeded, setSeeded] = useState(false);
  // "Decidido" = existe número salvo, ou a pessoa escolheu o país, ou
  // já digitou. Qualquer um dos três tranca a sugestão automática.
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    // Num formulário de EDIÇÃO o campo precisa nascer com o número
    // salvo — e o número salvo chega DEPOIS da primeira montagem,
    // porque o perfil vem do banco. A primeira versão semeava uma vez
    // só ("if (seeded) return"), então a corrida era sempre perdida: o
    // campo montava vazio, o perfil chegava, e nada acontecia. A tela
    // da conta mostrava um telefone em branco com o número salvo num
    // aviso embaixo — e "salvei e continua vazio" lê como não salvou.
    //
    // A regra agora: enquanto a pessoa não DIGITOU, valor que chega e
    // parseia semeia o campo, cedo ou tarde. Digitou, acabou — nada
    // sobrescreve o que ela está escrevendo.
    if (touched) return;
    const parsed = splitE164(value ?? "");
    if (parsed) {
      setCountry(parsed.code);
      setLocal(parsed.local);
      setSettled(true); // número real: nada o sobrescreve
      setSeeded(true);
      return;
    }
    if (!seeded) {
      setCountry(detectCountry());
      setSeeded(true);
    }
  }, [value, seeded, touched]);

  useEffect(() => {
    // O perfil carrega depois do primeiro render, então a nacionalidade
    // chega atrasada — por isso isto é um efeito próprio e não parte da
    // semeadura. Enquanto ninguém decidiu nada, ela manda.
    if (!seeded || settled || !countryHint) return;
    const hit = COUNTRIES.find((c) => c.code === countryHint.toUpperCase());
    if (hit && hit.code !== country) setCountry(hit.code);
  }, [countryHint, seeded, settled, country]);

  useEffect(() => {
    if (!seeded) return; // não avisa o pai antes de terminar de semear
    onChange(buildPhone(country, local) ?? "");
    // onChange muda a cada render do pai; depender dele reentraria em laço
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, local, seeded]);

  const valid = Boolean(buildPhone(country, local));
  const showError = required && touched && local.length > 0 && !valid;

  return (
    <div className="field">
      <label htmlFor="wa">
        {label} {required ? "" : "(optional)"}
      </label>
      <div className="phone-row">
        <select
          className="phone-country"
          aria-label="Country code"
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setSettled(true);
          }}
        >
          {COUNTRIES.map((c) => (
            <option key={c.code + c.dial} value={c.code}>
              {c.flag} {c.code}
            </option>
          ))}
        </select>
        <div className="phone-number">
          <span className="phone-dial">{dialOf(country)}</span>
          <input
            id="wa"
            inputMode="tel"
            autoComplete="tel-national"
            required={required}
            value={local}
            onBlur={() => setTouched(true)}
            onChange={(e) => {
              const next = e.target.value.replace(/[^\d\s-]/g, "");
              setLocal(next);
              if (next) setSettled(true);
            }}
            placeholder="912 345 678"
          />
        </div>
      </div>
      {showError ? (
        <p className="finehint" style={{ color: "var(--danger)" }}>
          That number looks too short — include the area code, without the leading 0.
        </p>
      ) : (
        <p className="finehint">
          {hint ??
            (required
              ? "How we reach you if you're not at the gangway — the only channel that works from a ship."
              : "Optional, but it's how we reach you at the gangway.")}
        </p>
      )}
      <input type="hidden" name="contact_whatsapp" value={value} />
    </div>
  );
}
