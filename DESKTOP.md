# MaßWerk als Desktop-App — der Plan

> Status: **Plan. Nichts davon ist gebaut.** Auftrag: MaßWerk soll wie
> iTunes für Windows wirken — ein Produkt mit eigener Fenstergestalt, nicht
> ein Browser-Tab und nicht der native Windows-Fensterlook. Die Web-App
> (Next.js, statischer Export in `out/`) wird **wiederverwendet, nicht
> neu erfunden**: Alles Messen, Analysieren, Exportieren bleibt exakt der
> Code, der heute auf Cloudflare Pages läuft.

---

## 1 · Grundsatzentscheidung: Hülle, nicht Neubau

Drei Wege, ein Web-Produkt auf den Desktop zu bringen:

| Weg | Fenster-Chrome | Größe | Web-Engine | Urteil |
|---|---|---|---|---|
| **PWA (installiert)** | Browser-Rahmen, nicht frei gestaltbar | – | Browser | ✗ erfüllt den Auftrag nicht — kein eigener Look |
| **Tauri v2** | frei: `decorations: false`, Titelleiste in HTML/CSS | ~8 MB Installer | WebView2 (ab Win 10 vorinstalliert) | ✓ **Empfehlung** |
| **Electron** | frei (frameless `BrowserWindow`) | ~180 MB Installer | gebündeltes Chromium | ✓ machbar, Fallback falls WebView2-Inkompatibilitäten auftauchen |

**Empfehlung: Tauri v2.** Begründung in einem Satz: Die Web-App ist bereits
ein statischer Export (`frontendDist: "../out"`), Canvas 2D, Tailwind,
self-hosted Geist — nichts davon braucht gebündeltes Chromium; 8 MB statt
180 MB sind die iTunes-Lektion („die Software selbst ist der Content, nicht
der Ballast drumherum").

Risiko-Rückfallplan: Sollte WebView2 auf Zielmaschinen abweichen (Fonts,
`light-dark()`, Filter-Performance), ist der Wechsel zu Electron eine
Konfigurationsfrage — Phase 1–3 bleiben identisch, weil beide dieselbe
`out/`-Basis laden und beide frameless + Custom-Titlebar können.

---

## 2 · Das Fenster: eigener Look statt Windows-Look

iTunes für Windows hat Titelzeile, Rahmen und Bedienelemente selbst
gezeichnet — das Fenster wirkt wie aus derselben Werkstatt wie die Inhalte.
Für MaßWerk heißt das:

- **`decorations: false`** — kein OS-Rahmen, kein OS-Titel, keine OS-Buttons.
- **Eigene Titelleiste** (neue Komponente `src/components/desktop/TitleBar.tsx`,
  ~34 px hoch, nur im Desktop-Build gerendert):
  - links: Wortmarke „MaßWerk" in derselben Geist-Stimme wie das UI;
  - Mitte: **Dateiname** („grundriss.jpg — 70 %" · `font-tabular`), bei
    ungesicherten Änderungen ein Punkt statt des Sterns — die Sprache, die
    das Produkt schon spricht;
  - rechts: Minimieren / Maximieren / Schließen **selbst gezeichnet** —
    46×34-Trefferflächen, Ink-Hover (`--mw-hover`), nur Schließen bekommt
    beim Hover das Plattform-Rot (#E81123). Windows-Nutzer erkennen ihre
    Gesten wieder, ohne dass Windows aussieht.
- **Ziehen** über `data-tauri-drag-region` auf der Leiste; Doppelklick
  maximiert (Windows-Konvention, von Tauri mitgeliefert).
- **Rahmen & Ecken**: 1 px `--mw-border-strong`, Radius 10 px via CSS +
  `transparent: true` — unter Windows 11 nutzt die App die gerundeten
  Fensterecken des OS, unter Windows 10 zeichnet sie eigene.
- **Mindestgröße 960×600** (die kleine Bühne der Web-App greift darunter —
  genau wie heute im Browser).
- **Farbe folgt dem Thema** (D4): `color-scheme` wirkt im WebView, Titel-
  leiste erbt die Variablen — Hell/Dunkel/System gelten für das ganze
  Fenster, nicht nur den Inhalt.

**Desktop-Erkennung im Web-Code:** `"__TAURI_INTERNALS__" in window` —
ein einziges Feature-Flag. Die Pages-Version bleibt byte-identisch; der
TitleBar wird nur gerendert, wenn das Flag steht.

---

## 3 · Dateisystem: die Stelle, an der eine Desktop-App echt wird

Heute (Browser): `<input type="file">`, Drag & Drop mit `DataTransfer`,
Download-Links. In der Hülle ersetzen native Dialoge diese Wege — die
Pipeline dahinter (`openFile(File)`, `loadDocument(Uint8Array)`,
`serializeDocument()`) bleibt unverändert:

1. **Öffnen/Speichern/Exportieren** — `@tauri-apps/plugin-dialog` +
   `plugin-fs`:
   - `Strg+O` → nativer Öffnen-Dialog (Filter: Bilder + `.masswerk`);
     gelesen wird mit `readFile(path)` → `ArrayBuffer` → dieselben Pfade
     wie heute. Für `.masswerk` gibt es schon `loadDocument`; ein
     Bild-Adapter baut aus dem `ArrayBuffer` ein `File`.
   - `Strg+S` → nativer Speicher-Dialog für `.masswerk`; danach merkt sich
     ein `lastDocPath` im Fensterzustand: **erneutes Strg+S speichert
     lautlos auf denselben Pfad** — die wichtigste Desktop-Geste überhaupt.
   - PNG/CSV/XLSX-Export → Dialog mit vorgeschlagenem Dateinamen
     (`grundriss_1-50.png`-Schema existiert bereits in `runPng`).
2. **Doppelklick auf `.masswerk` im Explorer** — `fileAssociations` in
   `tauri.conf.json` registriert die Endung (Installer schreibt die
   Registry-Keys). Start mit Datei übergeben → Single-Instance-Plugin
   (`tauri-plugin-single-instance`) reicht den Pfad an das bereits offene
   Fenster weiter; zweites Fenster wird nie aufgemacht.
3. **Drag & Drop aus dem Explorer** — Tauri liefert `onDragDropEvent` mit
   **absoluten Pfaden** (keine `File`-Objekte). Adapter: Pfad → `readFile`
   → bestehende Pipeline. Die Gesichter des Drop-Overlays (D6: Bild vs.
   Dokument, am Suffix erkannt) funktionieren unverändert.
4. **Zuletzt verwendet** — Menüpunkt „Zuletzt geöffnet" (5 Einträge, Pfade
   in einem kleinen JSON im App-Datenordner via `plugin-store` oder eigene
   Datei). Klick öffnet direkt.

**Bewusste Auslassung:** Kein natives Menüband mit Dutzenden Einträgen.
Ein schmales App-Menü (Datei · Bearbeiten · Ansicht · Hilfe) existiert
für Tastatur-Nutzer und „Über MaßWerk"; alle Funktionen bleiben im
In-App-UI — iTunes-Prinzip: die Oberfläche ist das Menü.

---

## 4 · Lebenszyklus & Feinschliff

- **Fensterzustand** (`tauri-plugin-window-state`): Position, Größe,
  Maximalisierung überleben Neustarts. Nicht der Inhalt — MaßWerk ist
  bewusst sitzungsbasiert (Dokument öffnen = Sitzung wiederherstellen).
- **Startzeit**: statische Assets aus dem Bundle, WebView2 warm — Ziel
  **< 1,5 s** zum ersten Pinselstrich; Splash-Screen entfällt (ein
  Produkt, das schneller lädt als ein Splash steht, braucht keinen).
- **Updates** (`tauri-plugin-updater`, optional in Phase 5): statisches
  `update.json` + Signatur, gehostet neben der Pages-Version (z. B. im
  selben Cloudflare-Account). Update-Hinweis in der Titelleiste als Punkt,
  kein Modal — „leise, aber sichtbar".
- **About/Über**: die vorhandene Hilfe-Taste (`?`) öffnet dasselbe
  Tastatur-Panel wie im Web; kein separater About-Dialog.
- **Crash-/Fehlerfall**: WebView2 fehlt auf altem Win 10 → NSIS-Installer
  bootstrapt den Evergreen-Runtime-Downloader (Tauri-Standard, nur
  Konfiguration).

---

## 5 · Build & Auslieferung

- **`tauri.conf.json`**: `productName: "MaßWerk"`, `identifier:
  "com.masswerk.desktop"`, `frontendDist: "../out"`, `devUrl:
  http://localhost:3000`, Window wie oben, `bundle.targets: ["nsis", "msi"]`.
- **Ikonen**: aus `src/app/icon.svg` erzeugt `tauri icon` den ganzen Satz
  (.ico, Größen, Installer-Artwork) — eine Quelle, alle Formate.
- **CI**: GitHub-Action `tauri-apps/tauri-action` auf `windows-latest`,
  Artefakte = Installer; Release-Entwurf automatisch. (Die Pages-Pipeline
  bleibt unberührt — ein Commit bedient weiter Web **und** Desktop.)
- **Code-Signatur**: ohne Signatur zeigt SmartScreen „unbekannter
  Herausgeber". Plan: zuerst unsigniert für Betatest; OV-Zertifikat
  (~200–400 €/Jahr) oder Vertrauensaufbau per SmartScreen-Reputation als
  Phase-6-Entscheidung — bewusst **nicht** Teil des Kernplans.
- **Lizenz/Herkunft**: GPLv3 bleibt; der Desktop-Build ändert nichts an den
  Rechten (UTIF MIT, SheetJS Apache-2.0, Geist OFL/CC).

---

## 6 · Phasen & Aufwand

| Phase | Inhalt | Aufwand |
|---|---|---|
| 0 · Spike | Tauri-Projekt, lädt `out/`, frameless, Titelzeilen-Prototyp klickbar | 0,5–1 Tag |
| 1 · Fenster | TitleBar.tsx (Name, Thema, Fensterknöpfe), Drag-Region, Mindestgröße, Zustand-Plugin | 1–2 Tage |
| 2 · Dateien | Native Dialoge, Strg+S-Pfadgedächtnis, `.masswerk`-Assoziation + Single Instance, Drop-Adapter | 2 Tage |
| 3 · Menü | Schmales App-Menü, „Zuletzt verwendet", Über-Eintrag | 0,5 Tag |
| 4 · Build | Icons, NSIS/MSI, GitHub-Action, Installer-Texte DE/EN | 1 Tag |
| 5 · Optional | Updater, Signatur-Recherche, Beta-Verteilung | 1 Tag |

**Gesamt: ~1–1,5 Wochen** bis zum installierbaren MaßWerk, das aussieht wie
aus einem Guss mit der Web-Version.

---

## 7 · Was ausdrücklich NICHT passiert

- **Kein Rewrite** — kein „Desktop-UI", kein zweiter Codezweig der Logik.
  Die Hülle ist dünn; jede Messzeile bleibt dieselbe.
- **Kein natives Windows-Aussehen** — keine Aero-/WinUI-Imitate, keine
  OS-Standardbuttons. Eigenes Gesicht, Plattform-Gesten respektiert.
- **Keine Cloud-/Konto-Funktionen** — MaßWerk bleibt lokal, offline,
  ohne Login. Der Desktop verstärkt dieses Versprechen (echte Dateipfade
  statt Downloads-Ordner-Chaos).
- **Kein Mac/Linux-Fokus jetzt** — Tauri könnte beides, aber der Auftrag
  lautet Windows; Konfiguration wird so geschrieben, dass Targets später
  ergänzt werden können, ohne Phase 1–3 anzufassen.

## 8 · Messlatte für das fertige Produkt

1. Doppelklick auf die Verknüpfung → MaßWerk-Fenster in unter 1,5 s, kein
   Browser blitzt auf, kein Windows-Chrome sichtbar.
2. Fenster an Titelleiste ziehen, maximieren, schließen — alles fühlt sich
   nach MaßWerk an (Ink-Hover, tabulare Zahlen, Thema folgt D4).
3. `.masswerk` im Explorer doppelklicken → Sitzung öffnet sich im
   bereits laufenden Fenster.
4. Strg+S zweimal → erster Dialog, zweites Mal Stille.
5. Installer < 15 MB, deinstalliert sauber inklusive Endungs-Registrierung.
