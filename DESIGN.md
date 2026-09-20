# MaßWerk · Design-Review & Gestaltungsplan

> Review-Perspektive: Apple-Produktdesign (Pages / Keynote / Fotos).
> Leitfrage bei jeder Entscheidung: *Würde Jony Ive das so lassen – oder wegwerfen?*
>
> **Verbindliche Grundsätze stehen in [`DESIGN_GUIDELINES.md`](DESIGN_GUIDELINES.md).**
> Dieses Dokument hier hält den Befund & die Maßnahmen der einzelnen Runden fest
> (das *Warum* konkreter Eingriffe); bei Widerspruch gewinnt die Grundsatz-Datei.
>
> Status: **Phase 1 (Ausrichtung) und Phase 2 (Design-Pass) sind umgesetzt,**
> dazu P1 aus Phase 3 vorgezogen (Kürzel-Überlagerung, siehe 1.9) und die
> Kritikrunde mit Modus-Fallen-Behebung, transparenter Ausrichtung und
> greifbaren Anmerkungen (siehe 1.10).
> Der Rest von Phase 3 ist bewusster Rückstand – begründet, priorisiert, nicht vergessen.

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

**P3 · Dokument-Modell.** „Dokument öffnen/speichern" (.masswerk-Datei) statt
nur LocalStorage-Sitzung; mehrere Bilder in Tabs. Ausrichtung/Entzerrung sind
dafür bereits als reproduzierbare Transformationskette modelliert.

**P4 · Touch & Stift.** Zeiger-Events sind vorbereitet; Gesten (Pinch-Zoom,
Zwei-Finger-Pan) und größere Trefferflächen für Tablets fehlen.

**P5 · Lokalisierung.** Deutsch ist gesetzt, Struktur für i18n fehlt.
Alle Kopftexte sind bereits kurz genug, um sie sauber zu übersetzen.

**P6 · Barrierefreiheit vertiefen.** Fokus-Reihenfolge im Canvas,
ARIA-Live-Region für Messwerte, Kontrast-Check der Ghost-Töne im Light-Mode.
(Banner-Live-Region und Dialog-Semantik der Kürzel-Übersicht sind gesetzt,
siehe 1.9.)

**P7 · Analyse-Feinschliff.** ROI nach dem Aufziehen verschiebbar/
skalierbar machen; Ergebnisliste mit Einzelobjekt-Flächen statt nur Summe.

---

## 4 · Messlatte für jede künftende Änderung

- Erklärt sie sich selbst? (Sonst: Tooltip mit einem Satz, nie Absatz.)
- Gibt es dieselbe Aktion schon woanders? (Sonst: streichen oder verweisen.)
- Reagiert sie in einem Frame? (Sonst: Pipeline prüfen, nicht Text schreiben.)
- Übersteht sie Undo? (Sonst: Snapshot erweitern.)
- Sieht sie in Hell *und* Dunkel richtig aus? (Tokens, keine Hex-Werte.)
