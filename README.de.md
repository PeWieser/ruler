# MaßWerk

[English](README.md) · **Deutsch**

**Bilder vermessen wie mit Messschieber und Lineal – direkt im Browser, vollständig lokal.**

Bild öffnen, über eine bekannte Strecke kalibrieren, dann Distanzen, Flächen,
Winkel, Radien und Objektzahlen in echten Einheiten ablesen. MaßWerk läuft
komplett clientseitig: Kein Pixel verlässt das Gerät.

## Funktionen

- **Kalibrierung** über eine Referenzstrecke; Einheiten von µm bis ft;
  gespeicherte Maßstabs-Profile (z. B. je Objektiv oder Flughöhe)
- **Werkzeuge:** Distanz, Polylinie, Lot, Winkel, Schnittwinkel, Rechteck,
  Ellipse, Kreis aus 3 Punkten, Polygonfläche, Zählen, Notiz & Pfeil
- **Bildausrichtung:** 90°-Schritte und Geraderichten ±45° wie in Apple Fotos –
  Messungen und Maßstab drehen exakt mit; automatisch begradigen durch eine
  Linie entlang einer Kante oder des Horizonts, Drittelraster beim Justieren
- **Bildoptimierung** (Helligkeit, Kontrast, Gamma, Schärfe, Graustufen),
  **Objektivkorrektur** (Tonne/Kissen) und **Perspektiventzerrung** über vier Ecken
- **Automatische Zählung** per Schwellenwert-Analyse eines Bereichs:
  Gesamtfläche, Einzelflächen je Objekt, verschieb-/skalierbarer Bereich;
  als Zählung übernehmbar
- **Kantenfang** mit Sub-Pixel-Genauigkeit und Lupe beim Punktsetzen
- **Export:** PNG mit eingebrannten Messungen und Maßstabsbalken,
  Messwerttabelle als CSV oder Excel
- **Dokumente:** komplette Sitzung als `.masswerk`-Datei speichern und wieder
  öffnen (Bild, Messungen, Maßstab, Ausrichtung, Filter)
- **Formate:** JPG, PNG, WebP, BMP, GIF, TIFF (auch sehr hohe Auflösungen)
- Sitzungen werden lokal wiederhergestellt; Undo/Redo über alle Messungen
- **Zweisprachig:** Deutsch und Englisch, umschaltbar in der Kopfleiste
- **Touch-tauglich:** Pinch-Zoom, Zwei-Finger-Pan, größere Trefferflächen
- **Tastatur-getrieben:** `?` zeigt die vollständige Kürzel-Übersicht

## Loslegen

```bash
npm install
npm run dev      # http://localhost:3000
```

Kein Bild zur Hand? **„Beispielbild laden"** im Leerzustand: eine fotografierte
Werkbank-Szene (`public/samples/beispiel.jpg`) mit Stahl-Lineal, Messschieber
und Aluminium-Blöcken – ein natürliches Ziel für Kalibrieren, Begradigen und
Zählen.

## Tastatur

| Taste | Aktion | | Taste | Aktion |
|---|---|---|---|---|
| `V` | Auswählen & Bewegen | | `R` / `E` | Rechteck / Ellipse |
| `K` | Kalibrieren | | `C` | Kreis aus 3 Punkten |
| `M` | Distanz | | `F` | Polygonfläche |
| `P` | Polylinie | | `Z` | Zählen |
| `L` | Lot | | `T` | Notiz & Pfeil |
| `W` / `X` | Winkel / Schnittwinkel | | `Esc` | Abbrechen / abwählen |
| `0` / `1` | Einpassen / 100 % | | `Enter` | Entwurf abschließen |
| `+` / `−` | Zoom | | `Entf` | Auswahl löschen |
| `S` | Kantenfang | | `Strg+Z` / `Strg+Y` | Rückgängig / Wiederholen |
| `Leertaste` (halten) | Bild bewegen | | `Shift` (halten) | Kantenfang umgehen |
| `?` | Kürzel-Übersicht | | | |

## Technik

Next.js (App Router) · React · TypeScript · Zustand · Canvas 2D & WebGL ·
Tailwind CSS. Bildpipeline: Ausrichtung → Objektivkorrektur → Filter →
Analyse-Capture. Ausrichtung, radiale Entzerrung und Filter laufen in einem
einzigen persistenten WebGL-Kontext (zwei Draw-Calls, ein Textur-Upload pro
Bild); ist WebGL nicht verfügbar, greift ehrlich die CPU-Kette. Der
Analyse-Readback entsteht erst, wenn die Analyse aktiv ist. Alle Geometrie
lebt in Bildkoordinaten und wird bei jeder Transformation exakt mitgeführt.
Die Oberfläche ist lokalisiert (deutsche Quelle, englisches Wörterbuch,
Gettext-Prinzip, Schalter in der Kopfleiste); Touch-Geräte erhalten Pinch-Zoom,
Zwei-Finger-Pan und größere Trefferflächen. Schriften (Geist / Geist Mono)
sind selbst gehostet.

- `src/lib/measure/` – Geometrie, Bildverarbeitung, Rendering, Export, Store
- `src/components/editor/` – Bühne, Leisten, Panel, Tooltips, Kürzel-Overlay
- `public/samples/beispiel.jpg` – eingebautes Beispielfoto (Werkbank)

Design-Grundsätze und das vollständige Review-Protokoll: [`DESIGN.md`](DESIGN.md)
sowie die verbindliche Verfassung [`DESIGN_GUIDELINES.md`](DESIGN_GUIDELINES.md)
(deutsch).

## Lizenz

Siehe [`LICENSE`](LICENSE).
