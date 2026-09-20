# MaßWerk

**Bilder vermessen wie mit Messschieber und Lineal – direkt im Browser, vollständig lokal.**

Ein Bild öffnen, eine bekannte Strecke kalibrieren, danach Distanzen, Flächen,
Winkel, Radien und Objektzahlen in echten Einheiten ablesen. MaßWerk läuft
komplett clientseitig: Kein Pixel verlässt das Gerät.

## Funktionen

- **Kalibrierung** über eine Referenzstrecke, Einheiten von µm bis ft,
  speicherbare Maßstabs-Profile (z. B. je Objektiv oder Flughöhe)
- **Werkzeuge:** Distanz, Polylinie, Lot, Winkel, Schnittwinkel, Rechteck,
  Ellipse, Kreis aus 3 Punkten, Polygonfläche, Zählen, Notiz & Pfeil
- **Bildausrichtung:** 90°-Schritte und Geraderichten ±45° wie in Apple Fotos –
  Messungen und Maßstab werden exakt mitgedreht
- **Bildoptimierung** (Helligkeit, Kontrast, Gamma, Schärfe, Graustufen),
  **Objektivkorrektur** (Tonnen-/Kissenverzeichnung) und
  **Perspektiventzerrung** über vier Ecken
- **Automatische Zählung** per Schwellenwert-Analyse eines Bereichs
  (inkl. Gesamtfläche und Übernahme als Zählung)
- **Kantenfang** mit Subpixel-Genauigkeit und Lupe beim Setzen von Punkten
- **Export:** PNG mit eingebrannten Messungen und Maßstabsbalken,
  Messwerttabelle als CSV oder Excel
- **Formate:** JPG, PNG, WebP, BMP, GIF, TIFF (auch sehr hochauflösend)
- Sitzung wird lokal wiederhergestellt; Undo/Redo über alle Messungen

## Start

```bash
npm install
npm run dev      # http://localhost:3000
```

Zum Ausprobieren ohne eigenes Bild: im Leerzustand **„Beispielbild laden"** –
ein messtechnisch exaktes Zielbild (Lineal 10 px/mm, Scheiben, 45°-Winkel).

## Tastatur

| Kürzel | Aktion | | Kürzel | Aktion |
|---|---|---|---|---|
| `V` | Auswählen | | `R` / `E` | Rechteck / Ellipse |
| `K` | Kalibrieren | | `C` | Kreis aus 3 Punkten |
| `M` | Distanz | | `F` | Polygonfläche |
| `P` | Polylinie | | `Z` | Zählen |
| `L` | Lot | | `T` | Notiz & Pfeil |
| `W` / `X` | Winkel / Schnittwinkel | | `Esc` | Abbrechen / abwählen |
| `0` / `1` | Einpassen / 100 % | | `Enter` | Entwurf abschließen |
| `+` / `−` | Zoom | | `Entf` | Auswahl löschen |
| `S` | Kantenfang | | `Strg+Z` / `Strg+Y` | Undo / Redo |
| `Leertaste` (halten) | Bild bewegen | | `Shift` (halten) | Kantenfang umgehen |

## Technik

Next.js (App Router) · React · TypeScript · Zustand · Canvas 2D & WebGL ·
Tailwind CSS. Bildpipeline: Ausrichtung → Objektivkorrektur → Filter →
Analyse-Capture; alle Geometrien leben in Bildkoordinaten und werden bei
Transformationen exakt mitgeführt.

- `src/lib/measure/` – Geometrie, Bildverarbeitung, Render, Export, Store
- `src/components/editor/` – Bühne, Leisten, Panel, Tooltips
- `scripts/generate-sample.mjs` – erzeugt `public/samples/beispiel.png`

Gestaltungsgrundsätze und Review-Stand: [`DESIGN.md`](DESIGN.md)

## Lizenz

Siehe [`LICENSE`](LICENSE).
