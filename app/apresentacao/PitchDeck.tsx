"use client";

import { Children, isValidElement, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconAnchor } from "@/components/Icon";

/** Progressive enhancement: without JS the complete pitch remains readable. */
export default function PitchDeck({ children }: { children: ReactNode }) {
  const slides = Children.toArray(children);
  const titles = slides.map((slide) => isValidElement<{ "data-title": string }>(slide) ? slide.props["data-title"] : "Capítulo");
  const total = slides.length;
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [canFullscreen, setCanFullscreen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [more, setMore] = useState(false);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const current = useRef(0);
  const touch = useRef<{ x: number; y: number; time: number } | null>(null);
  const wheel = useRef({ delta: 0, last: 0, cooldown: 0 });
  const isDark = isValidElement<{ className: string }>(slides[active]) && slides[active].props.className.includes("ap-dark");

  const go = useCallback((index: number, focus = true) => {
    const next = Math.max(0, Math.min(total - 1, index));
    if (next === current.current) return;
    current.current = next;
    setActive(next);
    setNotice("");
    history.replaceState(history.state, "", next === 0 ? location.pathname + location.search : `#${next + 1}`);
    if (focus) requestAnimationFrame(() => viewport.current?.querySelectorAll<HTMLElement>(".ap-slide")[next]?.focus({ preventScroll: true }));
  }, [total]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
    } catch { setNotice("Tela cheia indisponível neste navegador. A apresentação continua aqui."); }
  }, []);

  useEffect(() => {
    const originalLang = document.documentElement.lang;
    document.documentElement.lang = "pt-BR";
    setReady(true);
    setCanFullscreen(Boolean(document.fullscreenEnabled && root.current?.requestFullscreen));
    const fromHash = () => {
      const n = /^#\d+$/.test(location.hash) ? Number(location.hash.slice(1)) : 1;
      go(n >= 1 && n <= total ? n - 1 : 0, false);
    };
    fromHash();
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const target = event.target as HTMLElement;
      if (target.closest("input,select,textarea,[contenteditable=true]")) return;
      if (target.closest("a,button") && [" ", "Enter"].includes(event.key)) return;
      if (event.key === "ArrowRight") { event.preventDefault(); go(current.current + 1); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); go(current.current - 1); }
      else if (event.key === "Home") { event.preventDefault(); go(0); }
      else if (event.key === "End") { event.preventDefault(); go(total - 1); }
      else if (event.key.toLowerCase() === "f" && document.fullscreenEnabled) { event.preventDefault(); void toggleFullscreen(); }
      else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", " "].includes(event.key)) {
        const slide = viewport.current?.querySelectorAll<HTMLElement>(".ap-slide")[current.current];
        if (!slide) return;
        const dir = ["ArrowUp", "PageUp"].includes(event.key) ? -1 : 1;
        const room = dir > 0 ? slide.scrollHeight - slide.clientHeight - slide.scrollTop : slide.scrollTop;
        event.preventDefault();
        if (room > 2) slide.scrollBy({ top: dir * (event.key.startsWith("Arrow") ? 80 : slide.clientHeight * .75), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
        else go(current.current + dir);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("hashchange", fromHash);
    document.addEventListener("fullscreenchange", onFullscreen);
    return () => {
      document.documentElement.lang = originalLang;
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("hashchange", fromHash);
      document.removeEventListener("fullscreenchange", onFullscreen);
    };
  }, [go, toggleFullscreen, total]);

  useEffect(() => {
    if (!ready) return;
    const elements = viewport.current?.querySelectorAll<HTMLElement>(".ap-slide");
    elements?.forEach((slide, index) => {
      const selected = index === active;
      slide.classList.toggle("ap-active", selected);
      slide.inert = !selected;
      slide.setAttribute("aria-hidden", String(!selected));
      slide.setAttribute("tabindex", "-1");
      slide.setAttribute("aria-label", `${index + 1} de ${total}: ${titles[index]}`);
      if (selected) slide.scrollTop = 0;
    });
    const slide = elements?.[active];
    if (!slide) return;
    const measure = () => setMore(slide.scrollHeight - slide.clientHeight - slide.scrollTop > 12);
    measure();
    slide.addEventListener("scroll", measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(slide);
    const wrap = slide.querySelector(".ap-wrap");
    if (wrap) observer.observe(wrap);
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const room = event.deltaY > 0 ? slide.scrollHeight - slide.clientHeight - slide.scrollTop : slide.scrollTop;
      if (room > 3) { wheel.current.delta = 0; return; }
      const now = Date.now();
      const state = wheel.current;
      if (now - state.last > 200) state.delta = 0;
      state.last = now;
      state.delta += event.deltaY;
      event.preventDefault();
      if (Math.abs(state.delta) > 75 && now > state.cooldown) {
        state.cooldown = now + 850;
        const dir = state.delta > 0 ? 1 : -1;
        state.delta = 0;
        go(current.current + dir);
      }
    };
    slide.addEventListener("wheel", onWheel, { passive: false });
    return () => { observer.disconnect(); slide.removeEventListener("scroll", measure); slide.removeEventListener("wheel", onWheel); };
    // Titles are static server-rendered slide metadata.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ready, total, go]);

  return <div ref={root} className={`ap-pitch ${ready ? "ap-ready" : ""} ${isDark ? "ap-theme-dark" : ""}`} lang="pt-BR">
    <div className="ap-progress" aria-hidden="true"><span style={{ transform: `scaleX(${(active + 1) / total})` }}/></div>
    <header className="ap-top">
      <a href="/" className="ap-brand" aria-label="At Gangway — ir para a loja"><IconAnchor size={34}/><span>At <b>Gangway</b></span></a>
      <span className="ap-top-label">TECNOLOGIA × NEGÓCIO MARÍTIMO</span>
      <a href="#12" className="ap-top-invite" onClick={(e) => { if (ready) { e.preventDefault(); go(total - 1); } }}>O convite <span aria-hidden="true">↗</span></a>
    </header>
    <main ref={viewport} className="ap-viewport" aria-label="Apresentação At Gangway"
      onTouchStart={(event) => { if (event.touches.length !== 1) { touch.current = null; return; } const t = event.touches[0]; touch.current = { x: t.clientX, y: t.clientY, time: Date.now() }; }}
      onTouchEnd={(event) => { const start = touch.current; touch.current = null; if (!start || event.changedTouches.length !== 1) return; const t = event.changedTouches[0]; const dx = t.clientX - start.x, dy = t.clientY - start.y; if (Date.now() - start.time < 800 && Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.5) go(current.current + (dx < 0 ? 1 : -1)); }}>
      {slides}
    </main>
    {ready && <>
      <div className="ap-scroll-cue" hidden={!more}>Role para continuar lendo ↓</div>
      <nav className="ap-controls" aria-label="Controles da apresentação">
        <div className="ap-chapters"><label htmlFor="ap-chapter">CAPÍTULOS</label><select id="ap-chapter" value={active} onChange={(e) => go(Number(e.target.value))}>{titles.map((title, i) => <option value={i} key={title}>{String(i + 1).padStart(2, "0")} · {title}</option>)}</select></div>
        <p className="ap-key-hint">Use ← → ou deslize</p>
        <div className="ap-control-buttons">
          {canFullscreen && <button className="ap-fullscreen" onClick={() => void toggleFullscreen()} aria-label={fullscreen ? "Sair da tela cheia" : "Abrir tela cheia"} aria-pressed={fullscreen} title="Tela cheia (F)">⛶</button>}
          <button onClick={() => go(active - 1)} disabled={active === 0} aria-label="Slide anterior">←</button>
          <span className="ap-count" aria-live="polite" aria-atomic="true">{String(active + 1).padStart(2, "0")} <i>/ {total}</i></span>
          <button className="ap-next" onClick={() => go(active + 1)} disabled={active === total - 1} aria-label="Próximo slide">→</button>
        </div>
      </nav>
      <p className="ap-notice" role="status">{notice}</p>
    </>}
  </div>;
}
