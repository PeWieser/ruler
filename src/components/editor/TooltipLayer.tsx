// ── MaßWerk · Tooltip-Ebene (Photoshop-Stil: Titel, Beschreibung, Kürzel) ────
"use client";

import { useEffect, useRef, useState } from "react";

interface TipState {
  title: string;
  desc: string;
  keys: string[];
  x: number;
  y: number;
  transform: string;
}

const SHOW_DELAY = 420;

export default function TooltipLayer() {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | null>(null);
  const current = useRef<HTMLElement | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    shownRef.current = tip !== null;
  }, [tip]);

  useEffect(() => {
    const clearTimer = () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    // Wurde der aktuelle Tooltip durch Halten (Touch/Stift) gezeigt?
    let byPress = false;

    const hide = () => {
      clearTimer();
      byPress = false;
      current.current = null;
      setTip(null);
    };

    const show = (el: HTMLElement) => {
      const title = el.dataset.tip ?? "";
      if (!title) return;
      const desc = el.dataset.desc ?? "";
      const keys = (el.dataset.key ?? "")
        .split("+")
        .map((k) => k.trim())
        .filter(Boolean);
      const side =
        el.dataset.side === "right" || el.dataset.side === "left"
          ? el.dataset.side
          : "bottom";
      const r = el.getBoundingClientRect();
      const iw = window.innerWidth;
      const ih = window.innerHeight;

      let x: number;
      let y: number;
      let transform: string;
      if (side === "right") {
        x = r.right + 10;
        y = Math.min(Math.max(46, r.top + r.height / 2), ih - 70);
        transform = "translate(0, -50%)";
      } else if (side === "left") {
        x = r.left - 10;
        y = Math.min(Math.max(46, r.top + r.height / 2), ih - 70);
        transform = "translate(-100%, -50%)";
      } else {
        x = Math.min(Math.max(140, r.left + r.width / 2), iw - 140);
        const below = r.bottom + 30 < ih - 96;
        y = below ? r.bottom + 9 : r.top - 9;
        transform = below ? "translate(-50%, 0)" : "translate(-50%, -100%)";
      }
      setTip({ title, desc, keys, x, y, transform });
    };

    const onOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest?.(
        "[data-tip]",
      ) as HTMLElement | null;
      if (target === current.current) return;
      clearTimer();
      current.current = target;
      if (!target) {
        setTip(null);
        return;
      }
      // Ist bereits ein Tooltip offen, ohne Verzögerung wechseln (Toolbar-Slide)
      if (shownRef.current) show(target);
      else timer.current = window.setTimeout(() => show(target), SHOW_DELAY);
    };

    // Touch & Stift: kein Hover, also Long-Press – die Plattform-Konvention.
    // Halten zeigt die Erklärung, Loslassen lässt sie kurz zum Lesen stehen.
    let grace: number | null = null;
    const onDown = (e: PointerEvent) => {
      if (grace !== null) {
        window.clearTimeout(grace);
        grace = null;
      }
      if (e.pointerType === "mouse") {
        hide();
        return;
      }
      const target = (e.target as HTMLElement).closest?.(
        "[data-tip]",
      ) as HTMLElement | null;
      if (!target) {
        hide();
        return;
      }
      clearTimer();
      current.current = target;
      timer.current = window.setTimeout(() => {
        byPress = true;
        show(target);
      }, 400);
    };
    const onUp = () => {
      clearTimer();
      if (shownRef.current) {
        grace = window.setTimeout(hide, 1100);
        // Wer die Erklärung gelesen hat, wollte nicht auslösen:
        // den folgenden Klick einmalig verschlucken (D3)
        if (byPress && current.current) {
          const el = current.current;
          const suppress = (ev: Event) => {
            ev.preventDefault();
            ev.stopPropagation();
            el.removeEventListener("click", suppress, true);
          };
          el.addEventListener("click", suppress, true);
          window.setTimeout(
            () => el.removeEventListener("click", suppress, true),
            800,
          );
        }
        byPress = false;
      }
    };

    window.addEventListener("mouseover", onOver);
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("pointerup", onUp, true);
    window.addEventListener("pointercancel", onUp, true);
    window.addEventListener("keydown", hide, true);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("pointerup", onUp, true);
      window.removeEventListener("pointercancel", onUp, true);
      window.removeEventListener("keydown", hide, true);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, []);

  if (!tip) return null;

  return (
    <div
      className="pointer-events-none fixed z-[90] max-w-64 animate-[tip-in_.2s_cubic-bezier(0.16,1,0.3,1)] rounded-[10px] border border-[var(--mw-border-strong)] bg-[var(--mw-surface-4)] px-3 py-2.5 shadow-xl"
      style={{ left: tip.x, top: tip.y, transform: tip.transform, boxShadow: "0 12px 32px var(--mw-shadow)" }}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-[12px] font-medium tracking-[-0.01em] text-[var(--mw-text)]">
          {tip.title}
        </span>
        {tip.keys.length > 0 && (
          <span className="flex shrink-0 items-center gap-1">
            {tip.keys.map((k, i) => (
              <kbd key={i} className="mw-kbd">
                {k}
              </kbd>
            ))}
          </span>
        )}
      </div>
      {tip.desc && (
        <div className="mt-1 text-[11px] leading-snug text-[var(--mw-text-faint)]">{tip.desc}</div>
      )}
    </div>
  );
}
