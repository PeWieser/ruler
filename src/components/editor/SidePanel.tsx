// ── MaßWerk · Seitenpanel: Messungen · Kalibrierung · Bild ──────────────────
"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Eye,
  EyeOff,
  ListChecks,
  Plus,
  RotateCcw,
  ScanSearch,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useEditor, type PanelTab } from "@/lib/measure/store";
import {
  fmtNumber,
  fmtStatFull,
  measurementStats,
  primaryLabel,
  dist,
} from "@/lib/measure/geometry";
import {
  KIND_LABEL,
  PALETTE,
  UNITS,
  UNIT_TO_MM,
  type Measurement,
  type Unit,
} from "@/lib/measure/types";
import { exportCSV, exportXLSX } from "@/lib/measure/export";

// ── kleine Bausteine ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--mw-text-ghost)] first:mt-0">
      {children}
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className="mb-3 block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[12px] text-[var(--mw-text-dim)]">{label}</span>
        <span className="font-tabular text-[11.5px] text-[var(--mw-text)]">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="mw-range w-full"
      />
    </label>
  );
}

function ColorDots({
  value,
  onPick,
}: {
  value: string;
  onPick: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Farbe ${c}`}
          onClick={() => onPick(c)}
          className="flex h-5.5 w-5.5 items-center justify-center rounded-full transition-transform duration-150 hover:scale-110 active:scale-95"
          style={{ backgroundColor: c }}
        >
          {value === c && <Check size={11} strokeWidth={3} className="text-black/70" />}
        </button>
      ))}
    </div>
  );
}

// ── Tab: Messungen ───────────────────────────────────────────────────────────

function MeasurementRow({ m, index }: { m: Measurement; index: number }) {
  const selectedId = useEditor((s) => s.selectedId);
  const calibration = useEditor((s) => s.calibration);
  const select = useEditor((s) => s.select);
  const setVisible = useEditor((s) => s.setVisible);
  const remove = useEditor((s) => s.remove);
  const rename = useEditor((s) => s.rename);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(m.name);
  const [leaving, setLeaving] = useState(false);
  const selected = selectedId === m.id;

  const value = primaryLabel(m, calibration);

  const requestDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setLeaving(true);
    setTimeout(() => remove(m.id), 220);
  };

  return (
    <div
      className={`group flex cursor-pointer items-center gap-2 rounded-lg px-2 py-[7px] transition-colors duration-150 ${
        selected ? "bg-[var(--mw-accent-bg-strong)]" : "hover:bg-[var(--mw-hover)]"
      } ${m.visible ? "" : "opacity-45"} ${leaving ? "mw-row-leaving" : ""}`}
      onClick={() => select(m.id)}
    >
      <span className="w-7 shrink-0 text-center font-tabular text-[11px] text-[var(--mw-text-ghost)]">
        {index + 1}
      </span>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: m.color }}
      />
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            rename(m.id, name.trim() || m.name);
            setEditing(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(false);
          }}
          onClick={(e) => e.stopPropagation()}
          className="min-w-0 flex-1 rounded border border-[var(--mw-accent-border)] bg-[var(--mw-surface-sunken)] px-1.5 py-0.5 text-[12.5px] text-[var(--mw-text)] outline-none"
        />
      ) : (
        <span
          className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--mw-text)]"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setName(m.name);
            setEditing(true);
          }}
        >
          {m.name}
        </span>
      )}
      <span className="shrink-0 font-tabular text-[12px] text-[var(--mw-text-dim)]">{value}</span>
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          aria-label={m.visible ? "Ausblenden" : "Einblenden"}
          onClick={(e) => {
            e.stopPropagation();
            setVisible(m.id, !m.visible);
          }}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover-strong)] hover:text-[var(--mw-text)] active:scale-90"
        >
          {m.visible ? <Eye size={13.5} /> : <EyeOff size={13.5} />}
        </button>
        <button
          type="button"
          aria-label="Löschen"
          onClick={requestDelete}
          className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-danger-bg)] hover:text-[var(--mw-danger-text)] active:scale-90"
        >
          <Trash2 size={13.5} />
        </button>
      </span>
    </div>
  );
}

function SelectedDetail({ m }: { m: Measurement }) {
  const st = useEditor();
  const stats = measurementStats(m);
  return (
    <div className="animate-pop-in mt-2 rounded-xl border border-[var(--mw-border)] bg-[var(--mw-surface-3)] p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--mw-text-faint)]">
          {KIND_LABEL[m.kind]}
        </span>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11.5px] text-[var(--mw-text-dim)]">
          <input
            type="checkbox"
            checked={m.visible}
            onChange={(e) => st.setVisible(m.id, e.target.checked)}
            className="mw-check"
          />
          sichtbar
        </label>
      </div>
      {stats.length > 0 ? (
        <div className="mb-3 space-y-1">
          {stats.map((s, i) => (
            <div key={i} className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-[var(--mw-text-dim)]">{s.label}</span>
              <span className="font-tabular text-[var(--mw-text)]">{fmtStatFull(s, st.calibration)}</span>
            </div>
          ))}
        </div>
      ) : (
        (m.kind === "note" || m.kind === "arrow") && (
          <div className="mb-3 text-[12.5px] text-[var(--mw-text-dim)]">
            {m.text ? `„${m.text}“` : "Kein Text – auf der Leinwand anklicken zum Bearbeiten."}
          </div>
        )
      )}
      <div className="flex items-center justify-between">
        <ColorDots value={m.color} onPick={(c) => st.recolor(m.id, c)} />
        <button
          type="button"
          onClick={() => st.remove(m.id)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-danger-bg)] hover:text-[var(--mw-danger-text)]"
        >
          <Trash2 size={13} /> Löschen
        </button>
      </div>
    </div>
  );
}

function MessTab() {
  const st = useEditor();
  const [confirmClear, setConfirmClear] = useState(false);
  const selected = st.measurements.find((m) => m.id === st.selectedId);

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 2600);
    return () => clearTimeout(t);
  }, [confirmClear]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] text-[var(--mw-text-faint)]">
          {st.measurements.length === 0
            ? "Noch keine Messungen"
            : `${st.measurements.length} ${st.measurements.length === 1 ? "Messung" : "Messungen"}`}
        </span>
        {st.measurements.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (confirmClear) {
                st.removeMany(st.measurements.map((m) => m.id));
                setConfirmClear(false);
              } else setConfirmClear(true);
            }}
            className={`rounded-lg px-2 py-1 text-[11.5px] transition-colors ${
              confirmClear
                ? "bg-[var(--mw-danger-bg)] text-[var(--mw-danger-text)]"
                : "text-[var(--mw-text-faint)] hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text-dim)]"
            }`}
          >
            {confirmClear ? "Wirklich alle löschen?" : "Alle löschen"}
          </button>
        )}
      </div>

      {st.measurements.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--mw-border-strong)] bg-[var(--mw-hover)] p-4 text-[12.5px] leading-relaxed text-[var(--mw-text-dim)]">
          {!st.calibration ? (
            <>
              <p className="mb-2 text-[var(--mw-text)]">Erster Schritt: Maßstab setzen</p>
              <p className="mb-3">
                Mit <b className="text-[var(--mw-text)]">K</b> eine Strecke im Bild ziehen, deren
                Länge bekannt ist (Lineal, Papierkante, Raster), dann den echten Wert eingeben.
              </p>
              <button
                type="button"
                onClick={() => st.setTool("calibrate")}
                data-tip="Maßstab kalibrieren"
                data-key="K"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--mw-accent)] py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--mw-accent-strong)] active:scale-[0.98]"
              >
                Maßstab kalibrieren
              </button>
              <p className="mt-2.5 text-[var(--mw-text-ghost)]">
                Solange kein Maßstab gesetzt ist, wird in Pixeln gemessen.
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 text-[var(--mw-text)]">Maßstab sitzt – los geht’s.</p>
              <ol className="space-y-1.5">
                <li className="flex gap-2"><span className="font-tabular text-[var(--mw-accent-text)]">M</span> Distanz messen (zwei Punkte).</li>
                <li className="flex gap-2"><span className="font-tabular text-[var(--mw-accent-text)]">R</span> Fläche als Rechteck aufziehen.</li>
                <li className="flex gap-2"><span className="font-tabular text-[var(--mw-accent-text)]">C</span> Kreis aus drei Randpunkten.</li>
              </ol>
            </>
          )}
        </div>
      )}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {st.measurements.map((m, i) => (
          <MeasurementRow key={m.id} m={m} index={i} />
        ))}
      </div>

      {selected && <SelectedDetail m={selected} />}

      {st.measurements.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[var(--mw-border)] pt-3">
          <button
            type="button"
            onClick={() => st.image && exportCSV(st.measurements, st.calibration, st.image.name)}
            className="rounded-lg border border-[var(--mw-border-strong)] bg-[var(--mw-hover)] py-1.5 text-[12px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover-strong)]"
          >
            CSV exportieren
          </button>
          <button
            type="button"
            onClick={() => st.image && exportXLSX(st.measurements, st.calibration, st.image.name)}
            className="rounded-lg border border-[var(--mw-border-strong)] bg-[var(--mw-hover)] py-1.5 text-[12px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover-strong)]"
          >
            Excel exportieren
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tab: Kalibrierung ────────────────────────────────────────────────────────

function KalibTab() {
  const st = useEditor();
  const [value, setValue] = useState("10");
  const [unit, setUnit] = useState<Unit>("cm");
  const [profileName, setProfileName] = useState("");
  const pending = st.pendingCalib;
  const px = pending ? dist(pending.a, pending.b) : 0;
  const num = parseFloat(value.replace(",", "."));

  const inputCls =
    "rounded-lg border border-[var(--mw-border-strong)] bg-[var(--mw-surface-sunken)] px-2.5 py-1.5 text-[13px] text-[var(--mw-text)] outline-none transition-colors placeholder:text-[var(--mw-text-ghost)] focus:border-[var(--mw-accent)]";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {pending ? (
        <div className="animate-pop-in rounded-xl border border-[var(--mw-accent-border)] bg-[var(--mw-accent-bg)] p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[12px] font-medium text-[var(--mw-accent-text)]">Referenzlänge</span>
            <span className="font-tabular text-[12px] text-[var(--mw-text-dim)]">{fmtNumber(px)} px</span>
          </div>
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--mw-text-dim)]">
            Welche reale Länge hat die gezogene Strecke?
          </p>
          <div className="mb-2.5 flex gap-2">
            <input
              key={fmtNumber(px, 2)}
              autoFocus
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && num > 0) st.commitCalibration(num, unit);
              }}
              className={`${inputCls} w-0 flex-1 font-tabular`}
              placeholder="z. B. 10"
            />
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value as Unit)}
              className={`${inputCls} w-20 cursor-pointer`}
            >
              {UNITS.filter((u) => u !== "px").map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!(num > 0)}
            onClick={() => st.commitCalibration(num, unit)}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--mw-accent)] py-2 text-[12.5px] font-medium text-white transition-all hover:bg-[var(--mw-accent-strong)] active:scale-[0.99] disabled:opacity-30"
          >
            Maßstab setzen
            <kbd className="mw-kbd !border-white/25 !bg-white/15 !text-white/85">Enter</kbd>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => st.setTool("calibrate")}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--mw-accent-border)] bg-[var(--mw-accent-bg)] p-3 text-[12.5px] text-[var(--mw-accent-text)] transition-colors hover:bg-[var(--mw-accent-bg-strong)] active:scale-[0.99]"
        >
          <Plus size={15} />
          {st.calibration ? "Neu kalibrieren …" : "Referenzstrecke im Bild ziehen …"}
        </button>
      )}

      {st.calibration ? (
        <>
          <SectionTitle>Aktiver Maßstab</SectionTitle>
          <div className="rounded-xl border border-[var(--mw-border)] bg-[var(--mw-surface-3)] p-3">
            <div className="font-tabular text-[15px] text-[var(--mw-text)]">
              1 px = {fmtNumber(1 / st.calibration.pixelsPerUnit, 5)} {st.calibration.unit}
            </div>
            <div className="mt-0.5 font-tabular text-[12px] text-[var(--mw-text-faint)]">
              {fmtNumber(st.calibration.pixelsPerUnit, 3)} px/{st.calibration.unit}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] text-[var(--mw-text-faint)]">Einheit</span>
                <select
                  value={st.calibration.unit}
                  onChange={(e) => st.setCalibUnit(e.target.value as Unit)}
                  className="cursor-pointer rounded-md border border-[var(--mw-border-strong)] bg-[var(--mw-surface-sunken)] px-1.5 py-1 text-[12px] text-[var(--mw-text)] outline-none focus:border-[var(--mw-accent)]"
                >
                  {UNITS.filter((u) => u !== "px").map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={st.clearCalibration}
                className="rounded-md px-2 py-1 text-[11.5px] text-[var(--mw-text-faint)] transition-colors hover:bg-[var(--mw-danger-bg)] hover:text-[var(--mw-danger-text)]"
              >
                Entfernen
              </button>
            </div>
          </div>

          <SectionTitle>Als Profil speichern</SectionTitle>
          <div className="flex gap-2">
            <input
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && profileName.trim()) {
                  st.saveProfile(profileName);
                  setProfileName("");
                }
              }}
              placeholder="z. B. Objektiv 10×"
              className="w-0 flex-1 rounded-lg border border-[var(--mw-border-strong)] bg-[var(--mw-surface-sunken)] px-2.5 py-1.5 text-[12.5px] text-[var(--mw-text)] outline-none placeholder:text-[var(--mw-text-ghost)] focus:border-[var(--mw-accent)]"
            />
            <button
              type="button"
              disabled={!profileName.trim()}
              onClick={() => {
                st.saveProfile(profileName);
                setProfileName("");
              }}
              className="rounded-lg border border-[var(--mw-border-strong)] bg-[var(--mw-hover)] px-3 text-[12px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover-strong)] disabled:opacity-30"
            >
              Sichern
            </button>
          </div>
        </>
      ) : (
        !pending && (
          <p className="mt-3 text-[12px] leading-relaxed text-[var(--mw-text-faint)]">
            Ohne Maßstab zeigt MaßWerk alle Werte in Pixeln an. Eine Strecke mit bekannter
            Länge ziehen (Lineal, Maßstab, Papierkante …) und die reale Länge eingeben.
          </p>
        )
      )}

      <SectionTitle>Profile</SectionTitle>
      {st.profiles.length === 0 ? (
        <p className="text-[12px] text-[var(--mw-text-ghost)]">
          Gespeicherte Maßstäbe für wiederkehrende Setups erscheinen hier.
        </p>
      ) : (
        <div className="space-y-1">
          {st.profiles.map((p) => (
            <div
              key={p.id}
              className="group flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--mw-hover)]"
              onClick={() => st.applyProfile(p.id)}
              data-tip={p.name}
              data-desc="Klicken, um diesen Maßstab anzuwenden"
              data-side="left"
            >
              <span className="truncate text-[12.5px] text-[var(--mw-text-dim)]">{p.name}</span>
              <span className="ml-2 flex shrink-0 items-center gap-2">
                <span className="font-tabular text-[11.5px] text-[var(--mw-text-faint)]">
                  {fmtNumber(p.pixelsPerUnit, 2)} px/{p.unit}
                </span>
                <button
                  type="button"
                  aria-label="Profil löschen"
                  onClick={(e) => {
                    e.stopPropagation();
                    st.deleteProfile(p.id);
                  }}
                  className="flex h-5.5 w-5.5 items-center justify-center rounded-md text-[var(--mw-text-faint)] opacity-0 transition-colors hover:bg-[var(--mw-danger-bg)] hover:text-[var(--mw-danger-text)] group-hover:opacity-100"
                >
                  <Trash2 size={12.5} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 text-[11.5px] leading-relaxed text-[var(--mw-text-ghost)]">
        {UNIT_TO_MM.mm === 1 && "Tipp: Profile eignen sich für feste Kameraabstände, Mikroskop-Objektive oder Drohnen-Flughöhen."}
      </div>
    </div>
  );
}

// ── Tab: Bild ────────────────────────────────────────────────────────────────

function BildTab() {
  const st = useEditor();
  const f = st.filters;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <SectionTitle>Bildoptimierung</SectionTitle>
      <Slider label="Helligkeit" min={0.35} max={1.8} step={0.01} value={f.brightness}
        onChange={(v) => st.setFilter({ brightness: v })}
        format={(v) => `${Math.round(v * 100)} %`} />
      <Slider label="Kontrast" min={0.35} max={1.9} step={0.01} value={f.contrast}
        onChange={(v) => st.setFilter({ contrast: v })}
        format={(v) => `${Math.round(v * 100)} %`} />
      <Slider label="Gamma" min={0.35} max={2.6} step={0.01} value={f.gamma}
        onChange={(v) => st.setFilter({ gamma: v })}
        format={(v) => fmtNumber(v, 2)} />
      <Slider label="Schärfe" min={0} max={1} step={0.01} value={f.sharpen}
        onChange={(v) => st.setFilter({ sharpen: v })}
        format={(v) => `${Math.round(v * 100)} %`} />
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-[var(--mw-text-dim)]">
          <input type="checkbox" checked={f.grayscale}
            onChange={(e) => st.setFilter({ grayscale: e.target.checked })}
            className="mw-check" />
          Graustufen
        </label>
        <button type="button" onClick={st.resetFilters}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] text-[var(--mw-text-faint)] transition-colors hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text-dim)]">
          <RotateCcw size={12.5} /> Zurücksetzen
        </button>
      </div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--mw-text-ghost)]">
        Die Optimierung dient nur der besseren Erkennung – Messungen und das
        Originalbild bleiben unverändert.
      </p>

      <SectionTitle>Objektivkorrektur</SectionTitle>
      <Slider
        label="Tonnen-/Kissenverzeichnung"
        min={-0.35}
        max={0.35}
        step={0.005}
        value={st.lensK}
        onChange={(v) => st.setLensK(v)}
        format={(v) => {
          if (Math.abs(v) < 0.005) return "aus";
          return (v > 0 ? "+" : "") + fmtNumber(v, 2);
        }}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] leading-relaxed text-[var(--mw-text-ghost)]">
          Negativ = Kissen, Positiv = Tonne. Wird vor jeder Messung auf das Bild angewendet.
        </span>
        <button
          type="button"
          onClick={st.resetLens}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--mw-text-faint)] transition-colors hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text-dim)]"
        >
          <RotateCcw size={11} /> Zurück
        </button>
      </div>

      <SectionTitle>Perspektiventzerrung</SectionTitle>
      {st.rectify?.active ? (
        <div className="animate-pop-in rounded-xl border border-[var(--mw-accent-border)] bg-[var(--mw-accent-bg)] p-3">
          <p className="mb-2 text-[12px] leading-relaxed text-[var(--mw-text-dim)]">
            Die <b className="text-[var(--mw-text)]">vier Ecken</b> einer im Bild verzerrten
            Rechtecksfläche anklicken – im Uhrzeigersinn.{" "}
            <span className="font-tabular text-[var(--mw-accent-text)]">{st.rectify.points.length}/4</span>
          </p>
          <button type="button" onClick={st.cancelRectify}
            className="w-full rounded-lg border border-[var(--mw-border-strong)] py-1.5 text-[12px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)]">
            Abbrechen
          </button>
        </div>
      ) : (
        <button type="button" onClick={st.enterRectify}
          className="rounded-xl border border-[var(--mw-border-strong)] bg-[var(--mw-surface-3)] p-3 text-left transition-colors hover:bg-[var(--mw-hover)]">
          <div className="text-[12.5px] font-medium text-[var(--mw-text-dim)]">Perspektive korrigieren</div>
          <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--mw-text-faint)]">
            Vier Ecken markieren, leichte Schrägaufnahmen werden maßhaltig entzerrt.
          </div>
        </button>
      )}
      {st.rectifyUndo && (
        <button type="button" onClick={st.undoRectify}
          className="animate-pop-in mt-2 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--mw-warn-bg)] bg-[var(--mw-warn-bg)] py-1.5 text-[12px] text-[var(--mw-warn-text)] transition-colors hover:opacity-80">
          <RotateCcw size={13} /> Entzerrung rückgängig
        </button>
      )}

      <SectionTitle>Automatische Zählung</SectionTitle>
      {!st.analysis.active ? (
        <button
          type="button"
          onClick={() => {
            st.setTool("select");
            st.setAnalysis({ active: true, roi: null });
          }}
          className="rounded-xl border border-[var(--mw-border-strong)] bg-[var(--mw-surface-3)] p-3 text-left transition-colors hover:bg-[var(--mw-hover)]"
        >
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--mw-text-dim)]">
            <ScanSearch size={14.5} className="text-[var(--mw-accent-text)]" /> Bereich analysieren
          </div>
          <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--mw-text-faint)]">
            Bereich aufziehen – ähnlich helle Objekte werden automatisch erkannt,
            gezählt und ihre Gesamtfläche berechnet.
          </div>
        </button>
      ) : (
        <div className="animate-pop-in rounded-xl border border-[var(--mw-accent-border)] bg-[var(--mw-accent-bg)] p-3">
          {!st.analysis.roi ? (
            <p className="mb-1 text-[12px] font-medium text-[var(--mw-accent-text)]">
              Auswertebereich im Bild aufziehen …
            </p>
          ) : (
            <p className="mb-2.5 text-[11.5px] text-[var(--mw-text-dim)]">
              Blaue Konturen = erkannte Objekte, gelbe Punkte = Zentroiden.
            </p>
          )}

          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-[var(--mw-surface-sunken)] p-0.5">
            {([true, false] as const).map((d) => (
              <button
                key={String(d)}
                type="button"
                onClick={() => st.setAnalysis({ dark: d })}
                className={`rounded-md py-1 text-[11.5px] transition-colors ${
                  st.analysis.dark === d
                    ? "bg-[var(--mw-hover-strong)] text-[var(--mw-text)]"
                    : "text-[var(--mw-text-faint)] hover:text-[var(--mw-text-dim)]"
                }`}
              >
                {d ? "Dunkle Objekte" : "Helle Objekte"}
              </button>
            ))}
          </div>

          <label className="mb-2 flex cursor-pointer items-center justify-between text-[12px] text-[var(--mw-text-dim)]">
            <span>Automatischer Schwellenwert</span>
            <input
              type="checkbox"
              checked={st.analysis.autoThreshold}
              onChange={(e) => st.setAnalysis({ autoThreshold: e.target.checked })}
              className="mw-check"
            />
          </label>

          {!st.analysis.autoThreshold && (
            <Slider
              label="Schwellenwert"
              min={1}
              max={254}
              step={1}
              value={st.analysis.threshold}
              onChange={(v) => st.setAnalysis({ threshold: v, autoThreshold: false })}
              format={(v) => String(Math.round(v))}
            />
          )}

          <div className="mb-2 grid grid-cols-2 gap-2">
            <Slider
              label="Min. Fläche"
              min={1}
              max={4000}
              step={1}
              value={st.analysis.minArea}
              onChange={(v) => st.setAnalysis({ minArea: v })}
              format={(v) => `${Math.round(v)} px²`}
            />
            <Slider
              label="Max. Fläche"
              min={10}
              max={50000}
              step={10}
              value={st.analysis.maxArea}
              onChange={(v) => st.setAnalysis({ maxArea: v })}
              format={(v) => `${Math.round(v)} px²`}
            />
          </div>
          <Slider
            label="Objekte verbinden"
            min={0}
            max={6}
            step={1}
            value={st.analysis.closeRadius}
            onChange={(v) => st.setAnalysis({ closeRadius: v })}
            format={(v) => (v === 0 ? "aus" : String(Math.round(v)))}
          />
          <p className="mb-1 -mt-1.5 text-[11px] leading-snug text-[var(--mw-text-ghost)]">
            Schließt kleine Lücken, damit z. B. ein Lineal mit Zahlenaufdruck
            oder eine glänzende Schraube nicht in mehrere Teile zerfällt.
          </p>

          {st.analysisResult && st.analysis.roi && (
            <div className="mb-3 rounded-lg bg-[var(--mw-surface-sunken)] p-2.5">
              <div className="flex items-baseline justify-between text-[13px]">
                <span className="text-[var(--mw-text-dim)]">Erkannt</span>
                <span className="font-tabular text-[16px] font-medium text-[var(--mw-text)]">
                  {st.analysisResult.count}
                  <span className="ml-1 text-[11px] font-normal text-[var(--mw-text-faint)]">Objekte</span>
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-[12.5px]">
                <span className="text-[var(--mw-text-dim)]">Gesamtfläche</span>
                <span className="font-tabular text-[var(--mw-text)]">
                  {st.calibration && st.calibration.unit !== "px"
                    ? `${fmtNumber(st.analysisResult.totalAreaPx / (st.calibration.pixelsPerUnit ** 2))} ${st.calibration.unit}²`
                    : `${fmtNumber(st.analysisResult.totalAreaPx)} px²`}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!st.analysisResult || st.analysisResult.count === 0}
              onClick={st.adoptAnalysis}
              className="flex-1 rounded-lg bg-[var(--mw-accent)] py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[var(--mw-accent-strong)] active:scale-[0.98] disabled:opacity-30"
            >
              Als Zählung übernehmen
            </button>
            <button
              type="button"
              onClick={() => st.setAnalysis({ roi: null })}
              className="rounded-lg border border-[var(--mw-border-strong)] px-2.5 text-[12px] text-[var(--mw-text-dim)] transition-colors hover:bg-[var(--mw-hover)]"
            >
              Bereich neu
            </button>
          </div>
          <button
            type="button"
            onClick={st.exitAnalysis}
            className="mt-2 w-full rounded-lg py-1.5 text-[12px] text-[var(--mw-text-faint)] transition-colors hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text-dim)]"
          >
            Analyse beenden
          </button>
        </div>
      )}
    </div>
  );
}

// ── Panel-Rahmen mit Tabs ────────────────────────────────────────────────────

const TABS: { id: PanelTab; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: "mess", label: "Messwerte", icon: ListChecks },
  { id: "kalib", label: "Maßstab", icon: SlidersHorizontal },
  { id: "bild", label: "Bild", icon: ScanSearch },
];

export default function SidePanel() {
  const tab = useEditor((s) => s.panelTab);
  const setTab = useEditor((s) => s.setPanelTab);
  const open = useEditor((s) => s.panelOpen);
  const count = useEditor((s) => s.measurements.length);
  if (!open) return null;

  const tabLabels: Record<PanelTab, string> = {
    mess: count > 0 ? `Messwerte (${count})` : "Messwerte",
    kalib: "Maßstab",
    bild: "Bild",
  };

  return (
    <aside className="flex w-[302px] shrink-0 flex-col border-l border-[var(--mw-border)] bg-[var(--mw-surface-2)]">
      <div className="flex gap-1 border-b border-[var(--mw-border)] p-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-[9px] py-1.5 text-[12px] font-medium transition-colors duration-150 ${
              tab === t.id
                ? "bg-[var(--mw-hover-strong)] text-[var(--mw-text)]"
                : "text-[var(--mw-text-faint)] hover:bg-[var(--mw-hover)] hover:text-[var(--mw-text-dim)]"
            }`}
          >
            {tabLabels[t.id]}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 p-3">
        {tab === "mess" && <MessTab />}
        {tab === "kalib" && <KalibTab />}
        {tab === "bild" && <BildTab />}
      </div>
    </aside>
  );
}
