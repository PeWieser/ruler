// ── MaßWerk · Zentraler Store (Zustand) ─────────────────────────────────────
"use client";

import { create } from "zustand";
import {
  DEFAULT_FILTERS,
  KIND_LABEL,
  PALETTE,
  uid,
  type Calibration,
  type CalibrationProfile,
  type Filters,
  type Measurement,
  type MeasurementKind,
  type Pt,
  type Rect,
  type ToolId,
  UNIT_TO_MM,
  filtersActive,
} from "./types";
import { homography } from "./geometry";
import {
  distortPointFwd,
  distortPointInv,
  rectifiedSize,
  transformPoints,
  warpPerspective,
} from "./imagefx";
import {
  IDENTITY_ORIENTATION,
  clampFine,
  fillScale,
  normQuarter,
  orientationActive,
  orientPointFwd,
  orientPointInv,
  orientedSize,
  sameOrientation,
  straightenDelta,
  type Orientation,
} from "./orientation";
import {
  loadFromDataUrl,
  toStorageDataUrl,
  type LoadedImage,
} from "./loadImage";
import { t } from "@/lib/i18n";

// ── Nicht-reaktive Bild-Registry (Canvas-Quellen & Capture) ──────────────────
export interface ImageRegistry {
  original: CanvasImageSource | null;
  /** Nach radialer Objektivkorrektur – identisch mit original bei k=0 */
  lensCorrected: CanvasImageSource | null;
  processed: CanvasImageSource | null;
  /** für Edge-Snap & Analyse: verarbeitetes Bild, begrenzte Auflösung */
  capture: ImageData | null;
  /** Capture-Pixel pro Bild-Pixel */
  captureScale: number;
  /** Aktive Linskorrektur (wird von Stage beim Aufbau gesetzt) */
  lensK: number;
  /** Unbeschnittene gedrehte Ansicht (Geraderichten-Hintergrund), null ohne Feinwinkel */
  orientFull: HTMLCanvasElement | null;
}

export const imgReg: ImageRegistry = {
  original: null,
  lensCorrected: null,
  processed: null,
  capture: null,
  captureScale: 1,
  lensK: 0,
  orientFull: null,
};

export interface AnalysisMask {
  bitmap: ImageBitmap | null;
  roi: Rect;
  count: number;
  totalAreaPx: number;
  centroids: Pt[];
}

export const analysisReg: AnalysisMask = {
  bitmap: null,
  roi: { x: 0, y: 0, w: 0, h: 0 },
  count: 0,
  totalAreaPx: 0,
  centroids: [],
};

interface RectifyBackup {
  original: CanvasImageSource;
  image: ImageMeta;
  imageDataUrl: string | null;
  measurements: Measurement[];
  calibration: Calibration | null;
  lensK: number;
  orientation: Orientation;
}

let rectifyBackup: RectifyBackup | null = null;

// ── Snapshot für Undo/Redo ───────────────────────────────────────────────────
// Bildtransformationen (Ausrichtung, Objektivkorrektur) gehören mit in den
// Snapshot: Sie verschieben Messpunkte, also müssen Punkte und Transformation
// als Einheit rückgängig gemacht werden können – sonst läuft beides auseinander.
interface Snap {
  measurements: Measurement[];
  calibration: Calibration | null;
  orientation: Orientation;
  lensK: number;
}

const HISTORY_LIMIT = 60;

export interface ImageMeta {
  name: string;
  width: number;
  height: number;
}

export type PanelTab = "mess" | "kalib" | "bild";

export interface AnalysisState {
  active: boolean;
  roi: Rect | null;
  threshold: number;
  autoThreshold: boolean;
  dark: boolean; // true = dunkle Objekte suchen
  minArea: number;
  maxArea: number;
  /** Schließt kleine Lücken/Reflexionen, damit z. B. Lineale oder glänzende
   *  Schrauben nicht in mehrere Teilobjekte zerfallen (Capture-Pixel-Radius). */
  closeRadius: number;
}

export interface AnalysisResult {
  count: number;
  /** Gesamtfläche in Bild-Pixeln² */
  totalAreaPx: number;
  /** Schwerpunkte in Bildkoordinaten */
  centroids: Pt[];
  /** Einzelobjekte, absteigend nach Fläche */
  blobs: { areaPx: number; c: Pt }[];
}

interface ViewCmd {
  seq: number;
  cmd: "fit" | "in" | "out" | "100";
}

interface EditorState {
  image: ImageMeta | null;
  imageDataUrl: string | null;
  imgVersion: number;
  tool: ToolId;
  measurements: Measurement[];
  selectedId: string | null;
  draft: Pt[] | null;
  pendingCalib: { a: Pt; b: Pt } | null;
  calibration: Calibration | null;
  profiles: CalibrationProfile[];
  filters: Filters;
  orientation: Orientation;
  lensK: number;
  scaleBar: boolean;
  snap: boolean;
  panelTab: PanelTab;
  panelOpen: boolean;
  analysis: AnalysisState;
  analysisResult: AnalysisResult | null;
  rectify: { active: boolean; points: Pt[] } | null;
  rectifyUndo: boolean;
  /** Entwurf der Automatischen Begradigung (Linie entlang Horizont/Kante). */
  horizon: Pt[] | null;
  /** Geraderichten-Regler wird gerade bedient (Gitter sichtbar). */
  straightenHold: boolean;
  /** Gitter leuchtet nach der letzten Änderung kurz nach (Epoch-ms). */
  straightenGlowUntil: number;
  noteEditingId: string | null;
  activeCountId: string | null;
  helpOpen: boolean;
  /** Erscheinungsbild: System folgt, Hell/Dunkel setzen sich durch (D4). */
  theme: "system" | "light" | "dark";
  setTheme: (t: "system" | "light" | "dark") => void;
  past: Snap[];
  future: Snap[];
  viewCmd: ViewCmd;
  banner: string | null;
  exportBusy: boolean;

  // ─ Bild ─
  setLoaded: (img: LoadedImage) => void;
  /** Ganzes Dokument als JSON (.masswerk) – oder null ohne Bild. */
  serializeDocument: () => string | null;
  /** Dokument wieder hereinladen; wirft bei ungültigem Inhalt. */
  loadDocumentText: (text: string) => Promise<void>;
  clearSession: () => void;
  bumpImg: () => void;
  // ─ Werkzeuge ─
  setTool: (t: ToolId) => void;
  // ─ Messungen ─
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  addDraftPoint: (p: Pt) => void;
  setDraftLast: (p: Pt) => void;
  cancelDraft: () => void;
  commitDraft: () => void;
  addCountPoint: (p: Pt) => void;
  addNote: (p: Pt) => void;
  addArrow: (a: Pt, b: Pt) => void;
  updatePoints: (id: string, pts: Pt[]) => void;
  updateText: (id: string, text: string) => void;
  rename: (id: string, name: string) => void;
  recolor: (id: string, color: string) => void;
  setVisible: (id: string, v: boolean) => void;
  remove: (id: string) => void;
  removeMany: (ids: string[]) => void;
  select: (id: string | null) => void;
  // ─ Kalibrierung ─
  setPendingCalib: (v: { a: Pt; b: Pt } | null) => void;
  commitCalibration: (realValue: number, unit: Calibration["unit"]) => void;
  clearCalibration: () => void;
  setCalibUnit: (unit: Calibration["unit"]) => void;
  saveProfile: (name: string) => void;
  applyProfile: (id: string) => void;
  deleteProfile: (id: string) => void;
  // ─ Bild & Analyse ─
  setFilter: (f: Partial<Filters>) => void;
  resetFilters: () => void;
  setOrientation: (o: Partial<Orientation>) => void;
  rotate90: (dir: 1 | -1) => void;
  resetOrientation: () => void;
  setLensK: (k: number) => void;
  resetLens: () => void;
  setAnalysis: (a: Partial<AnalysisState>) => void;
  setAnalysisResult: (r: AnalysisResult | null) => void;
  adoptAnalysis: () => void;
  exitAnalysis: () => void;
  enterRectify: () => void;
  addRectifyPoint: (p: Pt) => void;
  enterHorizon: () => void;
  addHorizonPoint: (p: Pt) => void;
  cancelHorizon: () => void;
  setStraightenHold: (v: boolean) => void;
  applyRectify: () => void;
  undoRectify: () => void;
  cancelRectify: () => void;
  // ─ UI ─
  setPanelTab: (t: PanelTab) => void;
  setPanelOpen: (v: boolean) => void;
  setScaleBar: (v: boolean) => void;
  setSnap: (v: boolean) => void;
  setNoteEditing: (id: string | null) => void;
  setHelpOpen: (v: boolean) => void;
  fireViewCmd: (cmd: ViewCmd["cmd"]) => void;
  setBanner: (b: string | null) => void;
  setExportBusy: (v: boolean) => void;
}

// ── Persistenz (LocalStorage) ────────────────────────────────────────────────
const SESSION_KEY = "mw.session.v1";
const PROFILES_KEY = "mw.profiles.v1";

interface PersistedSession {
  image: ImageMeta | null;
  imageDataUrl: string | null;
  measurements: Measurement[];
  calibration: Calibration | null;
  filters: Filters;
  orientation?: Orientation;
  scaleBar: boolean;
  snap: boolean;
}

function loadPersisted(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function loadProfiles(): CalibrationProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PROFILES_KEY);
    return raw ? (JSON.parse(raw) as CalibrationProfile[]) : [];
  } catch {
    return [];
  }
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function queuePersist(get: () => EditorState) {
  if (typeof window === "undefined") return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const s = get();
    const data: PersistedSession = {
      image: s.image,
      imageDataUrl: s.imageDataUrl,
      measurements: s.measurements,
      calibration: s.calibration,
      filters: s.filters,
      orientation: s.orientation,
      scaleBar: s.scaleBar,
      snap: s.snap,
    };
    try {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch {
      /* Speicher voll – ignorieren */
    }
    try {
      window.localStorage.setItem(PROFILES_KEY, JSON.stringify(s.profiles));
    } catch {
      /* ignore */
    }
  }, 400);
}

const persisted = typeof window !== "undefined" ? loadPersisted() : null;

function newMeasurement(
  kind: MeasurementKind,
  points: Pt[],
  existing: Measurement[],
  text?: string,
): Measurement {
  const n = existing.filter((m) => m.kind === kind).length + 1;
  return {
    id: uid(),
    kind,
    name: `${KIND_LABEL[kind]} ${n}`,
    points,
    color: PALETTE[existing.length % PALETTE.length],
    visible: true,
    text,
    createdAt: Date.now(),
  };
}

/** Wie viele Klicks braucht ein Werkzeug, bis es fertig ist? (Poly = manuell) */
export const TOOL_CLICKS: Partial<Record<ToolId, number>> = {
  line: 2,
  lot: 3,
  angle: 3,
  crossangle: 4,
  circle3: 3,
  rect: 2,
  ellipse: 2,
  calibrate: 2,
};

const TOOL_OF_DRAFT: Partial<Record<ToolId, MeasurementKind>> = {
  line: "line",
  polyline: "polyline",
  lot: "lot",
  angle: "angle",
  crossangle: "crossangle",
  rect: "rect",
  ellipse: "ellipse",
  circle3: "circle3",
  polygon: "polygon",
};

const DEFAULT_ANALYSIS: AnalysisState = {
  active: false,
  roi: null,
  threshold: 128,
  autoThreshold: true,
  dark: true,
  minArea: 10,
  maxArea: 999999,
  closeRadius: 2,
};

export const useEditor = create<EditorState>()((set, get) => {
  const persist = () => queuePersist(get);

  const snapshot = (): Snap => ({
    measurements: get().measurements,
    calibration: get().calibration,
    orientation: get().orientation,
    lensK: get().lensK,
  });

  /**
   * Passt die sichtbaren Bildmaße an, wenn sich die 90°-Stufe zwischen
   * zwei Orientierungen unterscheidet (sonst null – nichts zu tun).
   */
  const dimsForUndo = (
    image: ImageMeta | null,
    from: Orientation,
    to: Orientation,
  ): ImageMeta | null => {
    if (!image) return null;
    if (normQuarter(from.quarter) % 2 === normQuarter(to.quarter) % 2) return null;
    // Rohmaße aus den aktuellen sichtbaren Maßen zurückgewinnen
    const raw =
      normQuarter(from.quarter) % 2 === 1
        ? { w: image.height, h: image.width }
        : { w: image.width, h: image.height };
    const next = orientedSize(raw.w, raw.h, to.quarter);
    return { ...image, width: next.w, height: next.h };
  };

  return {
    image: persisted?.image ?? null,
    imageDataUrl: persisted?.imageDataUrl ?? null,
    imgVersion: 0,
    tool: "select",
    measurements: persisted?.measurements ?? [],
    selectedId: null,
    draft: null,
    pendingCalib: null,
    calibration: persisted?.calibration ?? null,
    profiles: loadProfiles(),
    filters: persisted?.filters ?? { ...DEFAULT_FILTERS },
    orientation: persisted?.orientation ?? { ...IDENTITY_ORIENTATION },
    lensK: 0,
    scaleBar: persisted?.scaleBar ?? true,
    snap: persisted?.snap ?? true,
    panelTab: "mess",
    panelOpen: true,
    analysis: { ...DEFAULT_ANALYSIS },
    analysisResult: null,
    rectify: null,
    rectifyUndo: false,
    horizon: null,
    straightenHold: false,
    straightenGlowUntil: 0,
    noteEditingId: null,
    activeCountId: null,
    helpOpen: false,
    theme:
      typeof localStorage !== "undefined" &&
      (localStorage.getItem("mw-theme") === "light" ||
        localStorage.getItem("mw-theme") === "dark")
        ? (localStorage.getItem("mw-theme") as "light" | "dark")
        : "system",
    past: [],
    future: [],
    viewCmd: { seq: 0, cmd: "fit" },
    banner: null,
    exportBusy: false,

    // ─────────────────────────── Bild ───────────────────────────
    setLoaded: (img) => {
      const prev = get();
      const sameDims =
        prev.image &&
        prev.image.width === img.width &&
        prev.image.height === img.height &&
        !orientationActive(prev.orientation);
      imgReg.original = img.source;
      imgReg.processed = null;
      imgReg.capture = null;
      const reset = !sameDims && (prev.measurements.length > 0 || prev.calibration);
      set({
        image: { name: img.name, width: img.width, height: img.height },
        imageDataUrl: img.storageDataUrl,
        imgVersion: prev.imgVersion + 1,
        measurements: sameDims ? prev.measurements : [],
        calibration: sameDims ? prev.calibration : null,
        selectedId: sameDims ? prev.selectedId : null,
        draft: null,
        pendingCalib: null,
        orientation: { ...IDENTITY_ORIENTATION },
        analysis: { ...DEFAULT_ANALYSIS },
        analysisResult: null,
        rectify: null,
        rectifyUndo: false,
        past: [],
        future: [],
        panelTab: sameDims ? prev.panelTab : reset ? "kalib" : prev.calibration ? "mess" : "kalib",
        banner: reset
          ? "Neues Bild – Messungen wurden zurückgesetzt. Bitte Maßstab prüfen oder neu setzen."
          : null,
      });
      rectifyBackup = null;
      persist();
    },

    serializeDocument: () => {
      const s = get();
      if (!s.image || !s.imageDataUrl) return null;
      return JSON.stringify({
        format: "masswerk",
        version: 1,
        savedAt: new Date().toISOString(),
        image: { name: s.image.name, dataUrl: s.imageDataUrl },
        measurements: s.measurements,
        calibration: s.calibration,
        orientation: s.orientation,
        lensK: s.lensK,
        filters: s.filters,
        scaleBar: s.scaleBar,
        snap: s.snap,
      });
    },

    loadDocumentText: async (text) => {
      const doc = JSON.parse(text) as {
        format?: string;
        version?: number;
        image?: { name?: string; dataUrl?: string };
        measurements?: Measurement[];
        calibration?: Calibration | null;
        orientation?: Orientation;
        lensK?: number;
        filters?: Filters;
        scaleBar?: boolean;
        snap?: boolean;
      };
      if (
        doc?.format !== "masswerk" ||
        doc.version !== 1 ||
        !doc.image?.dataUrl ||
        !Array.isArray(doc.measurements)
      ) {
        throw new Error("invalid document");
      }
      const source = await loadFromDataUrl(doc.image.dataUrl);
      const w = source.naturalWidth || (source.width as number);
      const h = source.naturalHeight || (source.height as number);
      const s = get();
      imgReg.original = source;
      imgReg.processed = null;
      imgReg.capture = null;
      imgReg.orientFull = null;
      analysisReg.bitmap = null;
      analysisReg.count = 0;
      set({
        image: {
          name: doc.image.name || "dokument.masswerk",
          width: w,
          height: h,
        },
        imageDataUrl: doc.image.dataUrl,
        imgVersion: s.imgVersion + 1,
        measurements: doc.measurements,
        calibration: doc.calibration ?? null,
        orientation: doc.orientation ?? { ...IDENTITY_ORIENTATION },
        lensK: doc.lensK ?? 0,
        filters: doc.filters ?? { ...DEFAULT_FILTERS },
        scaleBar: doc.scaleBar ?? true,
        snap: doc.snap ?? true,
        past: [],
        future: [],
        selectedId: null,
        draft: null,
        pendingCalib: null,
        analysis: { ...s.analysis, active: false, roi: null },
        analysisResult: null,
        rectify: null,
        horizon: null,
        tool: "select",
        banner: t("Dokument geladen – Sitzung wiederhergestellt."),
      });
      persist();
    },

    clearSession: () => {
      imgReg.original = null;
      imgReg.processed = null;
      imgReg.capture = null;
      analysisReg.bitmap = null;
      set({
        image: null,
        imageDataUrl: null,
        measurements: [],
        selectedId: null,
        draft: null,
        pendingCalib: null,
        calibration: null,
        filters: { ...DEFAULT_FILTERS },
        orientation: { ...IDENTITY_ORIENTATION },
        lensK: 0,
        analysis: { ...DEFAULT_ANALYSIS },
        analysisResult: null,
        rectify: null,
        rectifyUndo: false,
        past: [],
        future: [],
        banner: null,
      });
      persist();
    },

    bumpImg: () => set((s) => ({ imgVersion: s.imgVersion + 1 })),

    // ─────────────────────────── Werkzeuge ───────────────────────────
    setTool: (t) =>
      set((s) => {
        // Modus-Falle vermeiden: Wer ein Werkzeug wählt, verlässt Analyse,
        // Entzerrung und Horizont-Modus – sonst bleibt die Bühne in einem
        // Zustand, den der Nutzer nicht mehr versteht (Zero Dead Ends).
        const leavingAnalysis = s.analysis.active;
        if (leavingAnalysis) {
          analysisReg.bitmap = null;
          analysisReg.count = 0;
        }
        return {
          tool: t,
          draft: null,
          noteEditingId: null,
          pendingCalib: t === "calibrate" ? s.pendingCalib : null,
          activeCountId: t === "count" ? null : s.activeCountId,
          panelOpen: t === "calibrate" ? true : s.panelOpen,
          panelTab: t === "calibrate" ? "kalib" : s.panelTab,
          analysis: leavingAnalysis
            ? { ...s.analysis, active: false, roi: null }
            : s.analysis,
          analysisResult: leavingAnalysis ? null : s.analysisResult,
          rectify: s.rectify ? null : s.rectify,
          horizon: s.horizon ? null : s.horizon,
        };
      }),

    // ─────────────────────────── Verlauf ───────────────────────────
    pushHistory: () =>
      set((s) => ({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
      })),

    undo: () => {
      const s = get();
      if (s.past.length === 0) return;
      const prevState = s.past[s.past.length - 1];
      const dims = dimsForUndo(s.image, s.orientation, prevState.orientation);
      set({
        past: s.past.slice(0, -1),
        future: [...s.future, snapshot()],
        measurements: prevState.measurements,
        calibration: prevState.calibration,
        orientation: prevState.orientation,
        lensK: prevState.lensK,
        ...(dims ? { image: dims, imgVersion: s.imgVersion + 1 } : {}),
        selectedId:
          s.selectedId && prevState.measurements.some((m) => m.id === s.selectedId)
            ? s.selectedId
            : null,
        pendingCalib: null,
        draft: null,
      });
      persist();
    },

    redo: () => {
      const s = get();
      if (s.future.length === 0) return;
      const next = s.future[s.future.length - 1];
      const dims = dimsForUndo(s.image, s.orientation, next.orientation);
      set({
        future: s.future.slice(0, -1),
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        measurements: next.measurements,
        calibration: next.calibration,
        orientation: next.orientation,
        lensK: next.lensK,
        ...(dims ? { image: dims, imgVersion: s.imgVersion + 1 } : {}),
        selectedId:
          s.selectedId && next.measurements.some((m) => m.id === s.selectedId)
            ? s.selectedId
            : null,
      });
      persist();
    },

    // ─────────────────────────── Messungen ───────────────────────────
    addDraftPoint: (p) =>
      set((s) => {
        const pts = [...(s.draft ?? []), p];
        // Auto-Commit bei Werkzeugen mit fester Punktzahl
        if (s.tool === "calibrate" && pts.length === 2) {
          return { draft: null, pendingCalib: { a: pts[0], b: pts[1] } };
        }
        const need = TOOL_CLICKS[s.tool];
        const kind = TOOL_OF_DRAFT[s.tool];
        if (need && kind && pts.length >= need) {
          const m = newMeasurement(kind, pts, s.measurements);
          return {
            past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
            future: [],
            measurements: [...s.measurements, m],
            selectedId: m.id,
            draft: null,
          };
        }
        return { draft: pts };
      }),

    setDraftLast: (p) =>
      set((s) => {
        if (!s.draft || s.draft.length === 0) return { draft: [p] };
        return { draft: [...s.draft.slice(0, -1), p] };
      }),

    cancelDraft: () => set({ draft: null, pendingCalib: null }),

    commitDraft: () => {
      const s = get();
      if (!s.draft) return;
      const kind = TOOL_OF_DRAFT[s.tool];
      if (!kind) return;
      if (kind === "polygon" && s.draft.length < 3) return;
      if ((kind === "polyline" || kind === "line") && s.draft.length < 2) return;
      const m = newMeasurement(kind, s.draft, s.measurements);
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        measurements: [...s.measurements, m],
        selectedId: m.id,
        draft: null,
      });
      persist();
    },

    addCountPoint: (p) => {
      const s = get();
      const active = s.activeCountId
        ? s.measurements.find((m) => m.id === s.activeCountId && m.kind === "count")
        : null;
      if (active) {
        set({
          measurements: s.measurements.map((m) =>
            m.id === active.id ? { ...m, points: [...m.points, p] } : m,
          ),
        });
        persist();
        return;
      }
      const m = newMeasurement("count", [p], s.measurements);
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        measurements: [...s.measurements, m],
        selectedId: m.id,
        activeCountId: m.id,
      });
      persist();
    },

    addNote: (p) => {
      const s = get();
      const m = newMeasurement("note", [p], s.measurements, "");
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        measurements: [...s.measurements, m],
        selectedId: m.id,
        noteEditingId: m.id,
      });
      persist();
    },

    addArrow: (a, b) => {
      const s = get();
      const m = newMeasurement("arrow", [a, b], s.measurements, "");
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        measurements: [...s.measurements, m],
        selectedId: m.id,
        noteEditingId: m.id,
      });
      persist();
    },

    updatePoints: (id, pts) => {
      set((s) => ({
        measurements: s.measurements.map((m) =>
          m.id === id ? { ...m, points: pts } : m,
        ),
      }));
      persist();
    },

    updateText: (id, text) => {
      set((s) => ({
        measurements: s.measurements.map((m) => (m.id === id ? { ...m, text } : m)),
        noteEditingId: null,
      }));
      persist();
    },

    rename: (id, name) => {
      set((s) => ({
        measurements: s.measurements.map((m) => (m.id === id ? { ...m, name } : m)),
      }));
      persist();
    },

    recolor: (id, color) => {
      set((s) => ({
        measurements: s.measurements.map((m) => (m.id === id ? { ...m, color } : m)),
      }));
      persist();
    },

    setVisible: (id, v) => {
      set((s) => ({
        measurements: s.measurements.map((m) => (m.id === id ? { ...m, visible: v } : m)),
      }));
      persist();
    },

    remove: (id) => {
      const s = get();
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        measurements: s.measurements.filter((m) => m.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        activeCountId: s.activeCountId === id ? null : s.activeCountId,
        noteEditingId: s.noteEditingId === id ? null : s.noteEditingId,
      });
      persist();
    },

    removeMany: (ids) => {
      const s = get();
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        measurements: s.measurements.filter((m) => !ids.includes(m.id)),
        selectedId: s.selectedId && ids.includes(s.selectedId) ? null : s.selectedId,
      });
      persist();
    },

    select: (id) => set({ selectedId: id, noteEditingId: null }),

    // ─────────────────────────── Kalibrierung ───────────────────────────
    setPendingCalib: (v) => set({ pendingCalib: v }),

    commitCalibration: (realValue, unit) => {
      const s = get();
      const p = s.pendingCalib;
      if (!p || realValue <= 0) return;
      const px = Math.hypot(p.b.x - p.a.x, p.b.y - p.a.y);
      if (px < 2) return;
      const firstCalibration = !s.calibration;
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        calibration: { pixelsPerUnit: px / realValue, unit },
        pendingCalib: null,
        tool: firstCalibration ? "line" : s.tool,
        banner: firstCalibration
          ? t("Maßstab gesetzt – Sie können jetzt messen.")
          : null,
      });
      persist();
    },

    clearCalibration: () => {
      const s = get();
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        calibration: null,
      });
      persist();
    },

    setCalibUnit: (unit) => {
      const s = get();
      if (!s.calibration) return;
      const old = s.calibration.unit;
      if (old === unit) return;
      const ppu =
        (s.calibration.pixelsPerUnit * UNIT_TO_MM[unit]) / UNIT_TO_MM[old];
      set({ calibration: { pixelsPerUnit: ppu, unit } });
      persist();
    },

    saveProfile: (name) => {
      const s = get();
      if (!s.calibration || !name.trim()) return;
      const profile: CalibrationProfile = {
        id: uid(),
        name: name.trim(),
        pixelsPerUnit: s.calibration.pixelsPerUnit,
        unit: s.calibration.unit,
      };
      set({ profiles: [...s.profiles, profile] });
      persist();
    },

    applyProfile: (id) => {
      const s = get();
      const p = s.profiles.find((x) => x.id === id);
      if (!p) return;
      set({
        calibration: { pixelsPerUnit: p.pixelsPerUnit, unit: p.unit },
        banner: `Profil „${p.name}“ angewendet.`,
      });
      persist();
    },

    deleteProfile: (id) => {
      set((s) => ({ profiles: s.profiles.filter((p) => p.id !== id) }));
      persist();
    },

    // ─────────────────────────── Bild & Analyse ───────────────────────────
    setFilter: (f) => {
      set((s) => ({ filters: { ...s.filters, ...f } }));
      persist();
    },

    resetFilters: () => {
      set({ filters: { ...DEFAULT_FILTERS } });
      persist();
    },

    // ── Ausrichtung (90°-Schritte + Geraderichten, wie Apple Fotos) ──
    // Rotation ist eine Ähnlichkeitsabbildung: Alle sichtbaren Punkte
    // (Messungen, Entwurf, Kalibrierstrecke, Entzerr-Ecken) werden exakt
    // mitgedreht, der Maßstab wird um den Crop-Zoom-Faktor nachgeführt.
    setOrientation: (patch) => {
      const s = get();
      if (!s.image) return;
      const old = s.orientation;
      const next: Orientation = {
        quarter: normQuarter(patch.quarter ?? old.quarter),
        fine: clampFine(patch.fine ?? old.fine),
      };
      if (sameOrientation(next, old)) return;

      // Rohmaße des Originals aus den sichtbaren Maßen zurückgewinnen
      const rawW = normQuarter(old.quarter) % 2 === 1 ? s.image.height : s.image.width;
      const rawH = normQuarter(old.quarter) % 2 === 1 ? s.image.width : s.image.height;
      const remap = (p: Pt): Pt =>
        orientPointFwd(orientPointInv(p, rawW, rawH, old), rawW, rawH, next);
      const remapAll = (pts: Pt[]): Pt[] => pts.map(remap);

      // Maßstab exakt nachführen: Verhältnis der Crop-Zoomfaktoren
      const dimsOld = orientedSize(rawW, rawH, old.quarter);
      const dimsNew = orientedSize(rawW, rawH, next.quarter);
      const k =
        fillScale(next.fine, dimsNew.w, dimsNew.h) /
        fillScale(old.fine, dimsOld.w, dimsOld.h);
      const calibration =
        s.calibration && Math.abs(k - 1) > 1e-12
          ? { ...s.calibration, pixelsPerUnit: s.calibration.pixelsPerUnit * k }
          : s.calibration;

      const quarterChanged = normQuarter(next.quarter) !== normQuarter(old.quarter);
      const fineChanged = Math.abs(next.fine - old.fine) > 1e-9;
      const roiDropped = s.analysis.active && s.analysis.roi !== null;
      set({
        orientation: next,
        straightenGlowUntil: fineChanged ? Date.now() + 1600 : s.straightenGlowUntil,
        measurements: s.measurements.map((m) => ({ ...m, points: remapAll(m.points) })),
        draft: s.draft ? remapAll(s.draft) : null,
        pendingCalib: s.pendingCalib
          ? { a: remap(s.pendingCalib.a), b: remap(s.pendingCalib.b) }
          : null,
        rectify: s.rectify ? { ...s.rectify, points: remapAll(s.rectify.points) } : null,
        analysis: roiDropped ? { ...s.analysis, roi: null } : s.analysis,
        analysisResult: roiDropped ? null : s.analysisResult,
        calibration,
        image: quarterChanged
          ? { ...s.image, width: dimsNew.w, height: dimsNew.h }
          : s.image,
        imgVersion: quarterChanged ? s.imgVersion + 1 : s.imgVersion,
      });
      persist();
    },

    rotate90: (dir) => {
      const s = get();
      if (!s.image) return;
      s.pushHistory();
      get().setOrientation({ quarter: normQuarter(s.orientation.quarter) + dir });
    },

    resetOrientation: () => {
      const s = get();
      if (!orientationActive(s.orientation)) return;
      s.pushHistory();
      get().setOrientation({ quarter: 0, fine: 0 });
    },

    setLensK: (k) => {
      const s = get();
      const img = s.image;
      const oldK = s.lensK;
      if (img && Math.abs(k - oldK) > 1e-9 && s.measurements.length > 0) {
        const w = img.width;
        const h = img.height;
        // Messpunkte bleiben am selben Bildinhalt "kleben": zuerst zurück in
        // den unveränderlichen Rohkoordinaten-Raum, dann mit dem neuen
        // Korrekturwert wieder in den sichtbaren (korrigierten) Raum.
        const measurements = s.measurements.map((m) => ({
          ...m,
          points: m.points.map((p) => {
            const raw = distortPointInv(p, w, h, oldK);
            return distortPointFwd(raw, w, h, k);
          }),
        }));
        const warnCalib =
          !!s.calibration && Math.abs(oldK) < 1e-5 && Math.abs(k) >= 1e-5;
        set({
          lensK: k,
          measurements,
          banner: warnCalib
            ? "Maßstab nach Objektivkorrektur prüfen – Pixelabstände haben sich verändert."
            : s.banner,
        });
      } else {
        set({ lensK: k });
      }
      persist();
    },
    resetLens: () => {
      get().setLensK(0);
    },

    setAnalysis: (a) =>
      set((s) => ({ analysis: { ...s.analysis, ...a } })),

    setAnalysisResult: (r) => set({ analysisResult: r }),

    adoptAnalysis: () => {
      const s = get();
      const res = s.analysisResult;
      if (!res || res.centroids.length === 0) return;
      const m = newMeasurement("count", res.centroids, s.measurements);
      m.name = `Zählung (Analyse) ${s.measurements.filter((x) => x.kind === "count").length}`;
      set({
        past: [...s.past.slice(-HISTORY_LIMIT + 1), snapshot()],
        future: [],
        measurements: [...s.measurements, m],
        selectedId: m.id,
        panelTab: "mess",
        banner: `${res.count} Objekte als Zählung übernommen.`,
      });
      get().exitAnalysis();
      persist();
    },

    exitAnalysis: () => {
      analysisReg.bitmap = null;
      analysisReg.count = 0;
      set((s) => ({
        analysis: { ...s.analysis, active: false, roi: null },
        analysisResult: null,
      }));
    },

    enterRectify: () =>
      set({
        rectify: { active: true, points: [] },
        tool: "select",
        draft: null,
        analysis: { ...DEFAULT_ANALYSIS },
      }),

    addRectifyPoint: (p) => {
      const s = get();
      if (!s.rectify) return;
      const points = [...s.rectify.points, p].slice(0, 4);
      set({ rectify: { active: true, points } });
      if (points.length === 4) get().applyRectify();
    },

    applyRectify: () => {
      const s = get();
      const lensSource = imgReg.lensCorrected ?? imgReg.original;
      if (!s.rectify || s.rectify.points.length !== 4 || !s.image || !lensSource)
        return;
      const quad = s.rectify.points;
      const { w, h } = rectifiedSize(quad);
      const dst: Pt[] = [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h },
        { x: 0, y: h },
      ];
      const H = homography(quad, dst);
      // Objektivkorrektur zuerst anwenden (falls aktiv), dann perspektivisch entzerren
      const warped = warpPerspective(lensSource, H, w, h);
      if (!warped) {
        set({ rectify: null, banner: t("Entzerrung fehlgeschlagen (WebGL nicht verfügbar).") });
        return;
      }
      rectifyBackup = {
        original: imgReg.original!,
        image: s.image,
        imageDataUrl: s.imageDataUrl,
        measurements: s.measurements,
        calibration: s.calibration,
        lensK: s.lensK,
        orientation: s.orientation,
      };
      // Ausrichtung & Objektivkorrektur sind nun im Bild eingebrannt –
      // Regler zurücksetzen, Sitzungsbild für den Reload neu sichern.
      imgReg.original = warped;
      imgReg.lensCorrected = null;
      imgReg.processed = null;
      imgReg.capture = null;
      const measured = s.measurements.map((m) => ({
        ...m,
        points: transformPoints(m.points, H),
      }));
      set({
        image: { ...s.image, width: w, height: h },
        imageDataUrl: toStorageDataUrl(warped, w, h),
        measurements: measured,
        lensK: 0,
        orientation: { ...IDENTITY_ORIENTATION },
        rectify: null,
        rectifyUndo: true,
        imgVersion: s.imgVersion + 1,
        past: [],
        future: [],
        banner: t("Entzerrt – bitte Maßstab prüfen."),
      });
      persist();
    },

    undoRectify: () => {
      if (!rectifyBackup) return;
      imgReg.original = rectifyBackup.original;
      imgReg.lensCorrected = null;
      imgReg.processed = null;
      imgReg.capture = null;
      set((s) => ({
        image: rectifyBackup!.image,
        imageDataUrl: rectifyBackup!.imageDataUrl,
        measurements: rectifyBackup!.measurements,
        calibration: rectifyBackup!.calibration,
        lensK: rectifyBackup!.lensK,
        orientation: rectifyBackup!.orientation,
        rectifyUndo: false,
        imgVersion: s.imgVersion + 1,
        past: [],
        future: [],
        banner: null,
      }));
      rectifyBackup = null;
      persist();
    },

    cancelRectify: () => set({ rectify: null }),

    enterHorizon: () =>
      set((s) => ({
        horizon: [],
        draft: null,
        analysis: s.analysis.active
          ? { ...s.analysis, active: false, roi: null }
          : s.analysis,
        analysisResult: s.analysis.active ? null : s.analysisResult,
      })),

    addHorizonPoint: (p) => {
      const s = get();
      if (!s.horizon) return;
      const pts = [...s.horizon, p].slice(0, 2);
      if (pts.length < 2) {
        set({ horizon: pts });
        return;
      }
      const fine = straightenDelta(s.orientation.fine, pts[0], pts[1]);
      set({ horizon: null });
      s.pushHistory();
      get().setOrientation({ fine });
    },

    cancelHorizon: () => set({ horizon: null }),

    setStraightenHold: (v) =>
      set((s) => ({
        straightenHold: v,
        straightenGlowUntil: v ? s.straightenGlowUntil : Date.now() + 900,
      })),

    // ─────────────────────────── UI ───────────────────────────
    setPanelTab: (t) => set({ panelTab: t, panelOpen: true }),
    setPanelOpen: (v) => set({ panelOpen: v }),
    setScaleBar: (v) => {
      set({ scaleBar: v });
      persist();
    },
    setSnap: (v) => {
      set({ snap: v });
      persist();
    },
    setNoteEditing: (id) => set({ noteEditingId: id }),
    setHelpOpen: (v) => set({ helpOpen: v }),
    setTheme: (t) => {
      try {
        localStorage.setItem("mw-theme", t);
      } catch {
        // ohne Persistenz bleibt der Wunsch trotzdem gesetzt
      }
      if (typeof document !== "undefined") {
        document.documentElement.style.colorScheme = t === "system" ? "" : t;
      }
      set({ theme: t });
    },
    fireViewCmd: (cmd) => set((s) => ({ viewCmd: { seq: s.viewCmd.seq + 1, cmd } })),
    setBanner: (b) => set({ banner: b }),
    setExportBusy: (v) => set({ exportBusy: v }),
  };
});

/** Wird nach Filterwechsel neu aufgebaut (verarbeitetes Bild + Capture). */
export function currentFiltersAreDefault(f: Filters): boolean {
  return !filtersActive(f);
}
