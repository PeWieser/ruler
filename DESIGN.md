# MaßWerk · Design-Review & Gestaltungsplan

> Review-Perspektive: Apple-Produktdesign (Pages / Keynote / Fotos).
> Leitfrage bei jeder Entscheidung: *Würde Jony Ive das so lassen – oder wegwerfen?*
>
> **Verbindliche Grundsätze stehen in [`DESIGN_GUIDELINES.md`](DESIGN_GUIDELINES.md).**
> Dieses Dokument hier hält den Befund & die Maßnahmen der einzelnen Runden fest
> (das *Warum* konkreter Eingriffe); bei Widerspruch gewinnt die Grundsatz-Datei.
>
> Status: **Phase 1 (Ausrichtung) und Phase 2 (Design-Pass) sind umgesetzt,**
> dazu P1 (Kürzel-Übersicht, 1.9), die Kritikrunde (1.10), P2 GPU-Pipeline
> (1.11) sowie P4 Touch (1.12), P5 i18n (1.13) und P6 Barrierefreiheit (1.14).
> Phase 3 ist damit vollständig abgetragen; neuer Rückstand wird bewusst
> aufgenommen und hier begründet – aktuell: keiner.

---

## 0 · Prinzipien, an denen diese App gemessen wird

1. **Reduktion.** Jedes Wort, jede Linie, jedes Icon muss sich seinen Platz verdienen.
   Was nichts erklärt, nichts steuert und nichts bestätigt, fliegt.
2. **Konsistenz.** Eine Strichstärke, eine Icon-Familie, eine Zahlen-Typografie,
   eine Sprache für Zustände. Stilbrüche sind Bugs.
3. **Direkte Manipulation.** Das Werkzeug reagiert sofort, sichtbar und exakt.
   Regler bewegen Bilder – nicht Ladebalken.
4. **Feedback als Freude am Detail.** Einrasten fühlt man (Impuls-Ring),
   Erfolge sieht man kurz („Gespeichert"), Fehler nie als Wand aus Text.
5. **Vergebung.** Alles Wichtige ist umkehrbar – Undo denkt in Zuständen,
   nicht in Aktionen.
6. **Ruhe.** Keine Bounce-Animationen, keine Doppeldeutigkeiten, keine
   zwei Orte für dieselbe Aktion.

---

## 1 · Befund & Maßnahmen je Bereich

### 1.1 Bildausrichtung (neues Feature, Phase 1)

**Vorher:** fehlte vollständig. Ein Foto quer vom Handy = unbrauchbar.

**Jetzt:** Abschnitt „Ausrichtung" im Bild-Panel, Verhalten wie Apple Fotos:

- Zwei Dreh-Buttons (±90°, im/gegen den Uhrzeigersinn), beliebig oft.
- Regler „Geraderichten" ±45° in 0,1°-Schritten, Wertanzeige in Grad,
  Doppelklick setzt auf 0° (Apple-Interaktion).
- Feinrotation zoomt exakt so weit herein, dass der Rahmen gefüllt bleibt
  (Crop-to-Fill) – keine schwarzen Ecken, nie.
- **Messungen, Entwürfe, Kalibrierstrecke und Entzerr-Ecken werden exakt
  mitgedreht**; der Maßstab wird um den Crop-Zoom-Faktor *exakt* nachgeführt
  (Rotation ist eine Ähnlichkeitsabbildung – hier darf nichts „ungefähr" sein).
- 90°-Drehungen sind Undo-fähig: Der Verlauf-Snapshot enthält jetzt Messpunkte
  **und** Bildtransformation (Ausrichtung, Objektivkorrektur) als Einheit.
  *Grund: Punkte und Transformation getrennt rückgängig zu machen, liefe
  auseinander – ein klassischer Stillbruch.*
- Weggedrehte Bildbereiche werden am Bildrand beschnitten statt frei auf der
  dunklen Bühne zu schweben (Clip im Overlay-Canvas).
- Perspektiventzerrung brennt Ausrichtung + Objektivkorrektur mit ein und
  setzt beide Regler zurück; „Entzerrung rückgängig" stellt beides wieder her.
- Sitzungspersistenz: Ausrichtung wird mitgespeichert und beim Reload exakt
  wiederhergestellt.

Technik: `src/lib/measure/orientation.ts` (Transformation, Crop-Faktor,
GPU-Render), Pipeline-Stufe 1 in `CanvasStage` (`original → Ausrichtung →
Objektiv → Filter → Capture`), synchroner Schnellpfad beim Drehen (kein
Zwischenframe mit falschem Seitenverhältnis).

### 1.2 Sprache & Textmenge

**Vorher:** Erklär-Bänder statt Interface. Beispiele:
„Negativ = Kissen, Positiv = Tonne. Wird vor jeder Messung auf das Bild
angewendet." · „Welche reale Länge hat die gezogene Strecke?" ·
„Tipp: Profile eignen sich für feste Kameraabstände …" hinter einer
Bedingung, die immer wahr ist (`UNIT_TO_MM.mm === 1 &&`).

**Jetzt:**

- Statusleiste zeigt *einen* Gedanken pro Zustand („Scheitelpunkt"),
  nicht vier mit Punkten verkettete Sätze.
- Panel-Erklärungen auf je einen Satz gekürzt oder in Tooltips verlagert
  (Regler „Objekte verbinden", „Tonnen-/Kissenverzeichnung").
- Tooltips: Titel + maximal ein kurzer Satz + Kürzel-Badge.
- Banner-Meldungen: „Maßstab gesetzt." statt „Maßstab gesetzt – Sie können
  jetzt messen." Das Interface gratuliert nicht, es informiert.
- Doppelte Aktionen entfernt: CSV/Excel-Export lebte zweimal
  (TopBar-Menü *und* Panel-Fuß). Jetzt nur im Export-Menü.

### 1.3 Icons

**Vorher:** Lucide-Mix mit Strichstärke 2 neben eigenen Glyphen mit 1.6 –
`Slash` als „Distanz", `Pentagon` als Fläche, `Hash` als Zählen.
Der Werkzeugkasten sah zusammengewürfelt aus.

**Jetzt:** Eine gezeichnete Familie (`ToolIcons.tsx`): 24er-Raster, Strich 1.6,
runde Enden, gefüllte Akzentpunkte. Jede Ikone erzählt ihr Werkzeug:
Maßlinie mit Pfeilspitzen und Endstrichen (Distanz), Kreis mit drei
Randpunkten (Kreis aus 3 Punkten), Strichliste (Zählen), Sprechblase mit
Pfeil (Notiz & Pfeil). Aktiver Zustand: ruhiger Akzentbalken links statt
Farbfläche + Skalen-Sprung.

### 1.4 Leerzustand

**Vorher:** Gestrichelte Bastel-Box, fünf Textblöcke, Format-Liste,
Privacy-Satz, Sample-Link – und ein Sample, das es nie gab
(`/samples/beispiel.jpg` fehlte im Repo; der Button lief immer in den Fehler).

**Jetzt:** App-Icon-Kachel im macOS-Stil mit sanftem Glow, ein Titel, ein Satz,
eine primäre Aktion, eine Zeile Hinweis, ein Sample-Link, ein Trust-Satz.
Das Sample ist eine echte Fotografie-Szene (`public/samples/beispiel.jpg`):
Werkbank mit diagonalem Stahl-Lineal, Messschieber, Aluminium-Blöcken –
natürliche Ziele für Kalibrierung (Lineal), Auto-Begradigen (Kanten) und
Zähl-Analyse (Schrauben). Ehrlich statt synthetisch-exakt: ein Beispielbild
muss schön genug sein, dass man es freiwillig ansieht
(`DESIGN_GUIDELINES.md` §4.6, §6.8).

### 1.5 TopBar

- Maßstab-Badge: kompakt und lesbar (`427 px/cm`) statt Ingenieurs-Bruch
  („1 px = 0,00234 mm"); die Langform bleibt im Panel, wo Platz ist.
- Icon-Größen vereinheitlicht (16 px), Press-Feedback von Bounce
  (`active:scale-90`) auf ruhige Hintergrundverdunkelung.
- Kalibrier-Impuls und Akzentbalken nutzen Farb-Tokens statt hartkodiertem
  Blau – Hell wie Dunkel korrekt.
- Tooltip-Beschreibungen halbiert.

### 1.6 Seitenpanel

- Tabs ohne tote Icon-Definitionen; Messwert-Zeile: Sichtbarkeit als
  Augen-Button (wie in der Liste) statt Checkbox mit Wort.
- Kalibrier-Card ohne Frage-Satz; Profil-Tipp ersatzlos gestrichen.
- Bild-Panel beginnt mit Ausrichtung (dem häufigsten ersten Handgriff),
  danach Optimierung, Objektiv, Entzerrung, Analyse – in Reihenfolge der
  Bearbeitung.

### 1.7 Bewegung & Material (globals.css)

- Slider wie in den macOS-Einstellungen: 3-px-Track, weißer schwebender Kopf
  mit Hauch-Rand und Schatten statt farbigem Knopf.
- Scrollbars schmaler, Firefox-Parität (`scrollbar-width: thin`).
- `prefers-reduced-motion` respektiert: Bewegung ist Dekoration, nie Information.

### 1.8 Status- & Hinweisebene

- Statusleiste rechts: nur Koordinate + Bildmaße. Der Kantenfang-Textblock
  („Kantenfang (S) · Shift = frei") ist gestrichen – der Zustand lebt im
  TopBar-Toggle und im grünen Einrast-Impuls auf der Bühne. Dreifach gemoppelt
  ist nicht dreifach klar.

### 1.9 Kürzel-Überlagerung & Screenreader (P1 vorgezogen)

- **„?" öffnet die vollständige Kürzel-Übersicht** – gruppiert in Werkzeuge,
  Ansicht, Zeichnen, Bearbeiten; als Dialog mit `aria-modal`, schließt über
  Esc, Hintergrund-Klick oder X. Solange sie offen ist, besitzt sie die
  Tastatur allein (kein versehentliches Werkzeug-Umschalten dahinter).
- Einstiegspunkte: Taste `?` und ein ruhiger Hilfe-Button in der Kopfleiste.
  Eine Pro-App erklärt sich auf Zuruf – ohne Handbuch, ohne Tooltipsuche.
- Banner werden per `role="status"` höflich angekündigt (erster Baustein
  der Barrierefreiheits-Vertiefung, Rest siehe P6).

### 1.11 GPU-Bildpipeline (P2)

**Befund:** Filter und Objektivkorrektur liefen CPU-seitig über
`getImageData`-Schleifen; zusätzlich baute jeder Pipeline-Tick ein
Analyse-Capture (GPU→CPU-Readback, 1800 px) auf – auch wenn keine Analyse
lief. Geraderichten *mit* aktiven Filtern fühlte sich dadurch getrieben an
(130 ms Entprellen + sichtbare Stufen).

**Maßnahme:** `src/lib/measure/glpipe.ts` – ein persistenter WebGL-Kontext,
zwei Pässe, null Readback-Schleifen pro Tick:

- **Pass A (Geometrie):** 90°-Schritte + Feinrotation + radiale
  Objektivkorrektur, invers abgebildet im Fragment-Shader (Newton für
  Brown-Conrady Ordnung 2, dieselbe Formel wie `radialDistort`), Rendern in
  eine FBO-Textur – kein Readback.
- **Kopie:** FBO → Framebuffer → 2D-Canvas. Diese Kopie ist `lensCorrected`
  und bleibt **ungefiltert**, weil Export und Kantenfang davon lesen und
  keine Filter sehen dürfen.
- **Pass B (Filter):** 4er-Laplacian-Schärfe + Helligkeit/Kontrast/Gamma/
  Graustufen – Formeln identisch zur CPU-LUT, ohne 8-Bit-Zwischenrundung.
- **Quelltextur:** ein Upload pro Bildwechsel, nicht pro Tick.
- **Capture-Laziness:** `refreshCapture` baut den Analyse-Puffer nur bei
  aktiver Analyse; sonst wird er freigegeben und beim Aktivieren nachgezogen
  (Effekt hängt an `captureTick`). Der Readback ist der teuerste Schritt
  eines Ticks – jetzt kostet er nichts, solange niemand analysiert.
- **Rückfall:** jeder Fehlschlag (kein WebGL, Shader-Fehler, Kontextverlust)
  liefert `null`; die CPU-Kette in CanvasStage bleibt unverändert erhalten,
  das 130-ms-Entprellen gilt nur noch ohne GPU.

**Warum ein Kontext statt WebGPU:** WebGL 1 läuft überall, wo MaßWerk läuft
(auch auf älteren Tablets und in eingebetteten Browsern); die Pipeline ist
zwei Draw-Calls groß – WebGPU brächte hier nichts außer Risiko.

### 1.10 Kritikrunde: Modus-Fallen, transparente Ausrichtung, greifbare Objekte

Aus einer konkreten Nutzer-Kritikliste entstanden; jede Zeile nennt Befund →
Maßnahme. Die daraus abgeleiteten **dauerhaften Regeln** stehen in
`DESIGN_GUIDELINES.md` §6 (verbindlich für alle künftigen Änderungen).

- **Befund: Analyse-/Entzerrungs-Modus bleibt nach Werkzeugwahl aktiv** (Modus-Falle).
  → `setTool` räumt jetzt jeden Fremdmodus auf (`analysis`, `rectify`, `horizon`)
  und leert das Analyse-Bitmap. Werkzeugwechsel ist immer auch Moduswechsel.
- **Befund: Geraderichten beschneidet das Bild, ohne es zu erklären** („Rahmen
  bleibt gerade, Inhalt verschwindet"). → Beim Drehen (Regler gehalten,
  Horizont-Modus oder kurzer Glow danach) zeichnet die Bühne das
  **unbeschnittene, gedrehte Bild hinter dem festen Rahmen** (`renderOrientedFull`)
  plus **Drittelraster** und akzentuierte Rahmenkante. Der Crop wird sichtbar
  erklärt statt heimlich vollzogen – das Apple-Fotos-Prinzip.
- **Befund: 0,1°-Regler ist für einen schiefen Horizont zu fummelig.** →
  **„Automatisch begradigen"** (ScanLine-Button): eine Linie entlang einer
  Kante ziehen; `straightenDelta` interpretiert flach → horizontal, steil →
  vertikal, Edge-Snap hilft beim Treffen. Rechtsklick/Esc brechen ab.
- **Befund: Maßstab-Badge ohne sichtbare Reaktion.** → Badge öffnet ein
  **Popover** mit echtem Inhalt: kalibriert → großer px/Einheit-Wert +
  „Neu kalibrieren", „Im Panel anpassen", „Entfernen"; unkalibriert →
  Erklärung + „Jetzt kalibrieren". Jeder Klick antwortet.
- **Befund: Toolbar/Panel/Statusleiste sichtbar ohne Bild.** → Diese Chrome
  rendert nur bei geöffnetem Bild (`{image && …}`); die Kopfleiste fällt ohne
  Bild auf eine schlanke Variante zurück (Marke, Hilfe, „Bild öffnen"). Der
  Leerzustand gehört der Einladung.
- **Befund: Notizen nach dem Erstellen nicht mehr bewegbar, Punkt zu klein.** →
  Das Anmerkungswerkzeug **trifft erst Vorhandenes** (auswählen, ziehen;
  erneuter Klick auf Auswahl = Text editieren), bevor es Neues anlegt. Der
  Hit-Test umfasst Punkt *und* Text-Chip mit größerem Radius; Hover zeigt „move".
- **Befund: kein Favicon.** → `src/app/icon.svg` trägt das App-Tile-Motiv
  (Lineal-L + Akzent-Diagonale) – Identität in jedem Tab.

---

## 2 · Gestrichen (und warum)

| Entfernt | Grund |
|---|---|
| CSV/Excel-Duplikat im Messwert-Panel | Eine Aktion, ein Ort |
| „Tipp:"-Absatz mit `UNIT_TO_MM.mm === 1 &&` | Toter Code, Belehrungston |
| Format-Liste im Leerzustand | Gehört in Drop-Overlay & Dateidialog |
| Kantenfang-Daueranzeige in der Statusleiste | Zustand lebt im Toggle + Canvas |
| Bounce-Skalierung auf Icon-Buttons | Unruhe; Apple drückt Hintergründe, keine Gummibälle |
| Frage-Sätze im Kalibrier-Panel | Das Eingabefeld *ist* die Frage |
| Gestrichelte Drop-Box | Wirkt wie Formular-Bastelsatz; jetzt ruhige Fläche |
| `<ol>`-Anleitung im leeren Messwert-Panel | Tooltips & Statusleiste lehren bereits |

---

## 3 · Rückstand (Phase 3) – priorisiert

**P2 · GPU-Bildpipeline – ERLEDIGT** (siehe 1.11). Regler mit Filtern und/oder
Objektivkorrektur laufen jetzt latenzfrei über einen einzigen WebGL-Kontext;
die CPU-Kette bleibt ehrlicher Rückfall für Systeme ohne WebGL.

### 1.15 Analyse-Feinschliff (P7)

- **ROI bleibt greifbar:** steht ein Auswertebereich, zeigen vier Eckgriffe
  seine Skalierbarkeit; der Körper verschiebt, ein Klick außerhalb beginnt
  einen neuen Bereich. Griffe bekommen eigene Cursor (nwse/nesw-resize, move) –
  die Bühne verspricht die Aktion, bevor der Finger sie prüft.
- **Undo-Ehrlichkeit:** der erste echte Move/Pull eines Griffs pusht einen
  History-Zustand; ROI-Änderungen sind damit so umkehrbar wie jede Messung.
- **Einzelobjekt-Flächen:** die Ergebnisliste im Panel zeigt jedes Objekt
  (absteigend nach Fläche) mit eigener Fläche in der aktiven Einheit –
  statt nur einer Summe, die nichts beweist.

### 1.16 Dokument-Modell (P3)

- **`.masswerk`-Datei:** ein JSON (Format+Version, Bild-Data-URL, Messungen,
  Kalibrierung, Ausrichtung, Lens-k, Filter, Maßstabsbalken, Snap) – gespeichert
  über das Export-Menü, geöffnet über Dateidialog *und* Drag & Drop
  (`.masswerk` ist jetzt ein akzeptierter Typ im Transfer).
- `loadDocumentText` validiert Format/Version/Payload und wirft sonst –
  der Fänger meldet einen eigenen, passenden Banner-Text.
- Beim Laden wird die Register-Kette sauber zurückgesetzt (original, processed,
  capture, orientFull, Analyse-Bitmap), History leer, Werkzeug Select –
  ein Dokument ist eine Sitzung, keine Schichtung.
- Mehrere Bilder in Tabs bleibt möglich, weil jeder Tab seine eigene lokale
  Sitzung hält; das Dokument ist die Brücke zwischen den Sitzungen.

### 1.12 Touch & Stift (P4)

- **Pinch-Zoom + Zwei-Finger-Pan** in CanvasStage: Zeiger-Map, inkrementelle
  Geste pro Move (ruhig unabhängig von der absoluten Spreizung); die zweite
  Fingerkuppe bricht eine laufende Einzelaktion ab und annulliert einen frisch
  gesetzten Punkt binnen 700 ms (kein Streupunkt beim Reinzoomen).
- **Größere Trefferflächen:** Hit-Toleranz 16 statt 9 Bildpx bei grobem Zeiger;
  `@media (pointer: coarse)` hebt Schaltflächen auf 40 px Minimum und
  verdoppelt Greifhöhe/Thumb der Regler – Maus- und Stift-Layout bleiben
  unangetastet.

### 1.13 Lokalisierung (P5)

- **Gettext-Prinzip:** deutscher Quelltext ist der Schlüssel (`t("Distanz")`),
  Übersetzungen leben in `src/lib/i18n/en.ts`; fehlt ein Eintrag, fällt er
  höflich auf Deutsch zurück – nie nackte Keys im UI.
- `useT()` für Komponenten (re-rendert bei Sprachwechsel), `t()` für Code
  außerhalb von React (Store-Banner, Export) – beide lesen die Locale zur
  Aufrufzeit. Locale persistiert in `localStorage`, `<html lang>` folgt.
- **Sprachschalter** in der Kopfleiste (beide Varianten); migriert sind alle
  Oberflächen: Leisten, Panel, Überlagerungen, Bühne, Banner, Status-Hints,
  Live-Region sowie CSV/XLSX-Köpfe und Messgrößen-Labels.

### 1.14 Barrierefreiheit vertiefen (P6)

- **Fokus:** die Mess-Bühne ist eigener Tab-Stopp (`role="application"`,
  benannt); globaler `:focus-visible`-Ring existiert bereits und gilt jetzt
  auch dort (früher `outline-none`).
- **ARIA-Live-Region** in der Statusleiste meldet Auswahl und Zählergebnis
  (`polite`, nur bei echtem Wechsel – kein Spam beim Punkteziehen).
- **Kontrast:** `--mw-text-dim/-faint/-ghost` neu abgemischt gegen die
  Surface-Töne – Light wie Dark jetzt ≥ 4,5:1 für Normaltext
  (ghost light zuvor ≈ 2,0:1, faint dark ≈ 3,8:1). Rechnung:
  Light ghost rgba(0,0,0,0.55) → 4,76:1; faint 0.60 → 5,74:1; dim 0.72 → 9,2:1;
  Dark ghost 0.46 → 4,65:1; faint 0.50 → 5,19:1; dim 0.62 → 7,5:1.

---

## 3 · Rückstand (Phase 3) – priorisiert

**P3 · Dokument-Modell – ERLEDIGT** (siehe 1.16). `.masswerk` speichern/öffnen
inkl. Drag & Drop; mehrere Tabs bleiben unabhängig, das Dokument verbindet sie.

**P4 · Touch & Stift – ERLEDIGT** (siehe 1.12). Pinch-Zoom, Zwei-Finger-Pan,
größere Trefferflächen; Geste annulliert frisch gesetzte Streupunkte.

**P5 · Lokalisierung – ERLEDIGT** (siehe 1.13). Gettext-Prinzip, DE/EN
vollständig migriert, Sprachschalter in der Kopfleiste.

**P6 · Barrierefreiheit – ERLEDIGT** (siehe 1.14). Canvas-Fokus, Live-Region
für Messwerte, Kontrast-Token in Light und Dark auf AA.

**P7 · Analyse-Feinschliff – ERLEDIGT** (siehe 1.15). ROI verschieb-/skalierbar
mit Griffen und Cursor-Versprechen; Einzelobjekt-Flächenliste im Panel.

---

## 3b · Rückstand aus dem Jobs-Deep-Dive (Audit-Runde 2)

Befunde mit Mikroskop-Perspektive (Hover, Touch, Einmal-Momente); priorisiert:

- **D1 · Mobile Chrome-Geometrie.** Seitenpanel ist fest 302 px breit, die
  Kopfleiste trägt ~15 Schalter ohne Umbruch – auf 390 px Telefonen bleibt der
  Bühne kaum Raum, die Leiste läuft aus dem Viewport. *Maßnahme:* Panel unter
  900 px als Overlay (Sheet) mit eigener Chrome, Kopfleiste in Gruppen
  kollabieren (Export-Menü schluckt Zoom/Ansicht).
- **D2 · Icon-Namen für Nicht-Hover-Welten.** TopBar-Icon-Buttons haben
  `data-tip`, aber kein `aria-label` – Screenreader *und* Touch-Nutzer ohne
  Tooltip sehen stumme Symbole. *Maßnahme:* aria-label = tr(tip) überall.
- **D3 · Tooltips sind Hover-Monologe.** Auf Touch erscheint nie eine
  Erklärung; Long-Press sollte den Tooltip zeigen (Plattform-Konvention).
- **D4 · Thema folgt nur dem System.** Light/Dark via `light-dark()` ohne
  manuellen Override – wer im dunklen Büro ein helles UI will, muss das OS
  umstellen. *Maßnahme:* dritter Zustand „System/Hell/Dunkel" im Popover.
- **D5 · Einmal-Momente ohne Abspann.** Erstkalibrierung, erster Export,
  erstes Dokument: jeweils Banner/Check – aber kein einziges Mal ein kurzer,
  warmer „Geschafft"-Moment, der hängen bleibt (z. B. Tile-Glow-Impuls im
  Leerzustand nach erstem erfolgreichen Export).
- **D6 · .masswerk ohne Gesicht.** Die Datei bekommt kein Icon/Thumbnail im
  Dialog und keine Vorschau beim Drop – dabei ist sie unser Dokument.
  *Maßnahme:* Drop-Overlay unterscheidet Bild/Dokument textlich + ikonisch.

---

## 4 · Messlatte für jede künftende Änderung

- Erklärt sie sich selbst? (Sonst: Tooltip mit einem Satz, nie Absatz.)
- Gibt es dieselbe Aktion schon woanders? (Sonst: streichen oder verweisen.)
- Reagiert sie in einem Frame? (Sonst: Pipeline prüfen, nicht Text schreiben.)
- Übersteht sie Undo? (Sonst: Snapshot erweitern.)
- Sieht sie in Hell *und* Dunkel richtig aus? (Tokens, keine Hex-Werte.)
