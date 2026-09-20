# MaßWerk

**English** · [Deutsch](README.de.md)

**Measure images like using a caliper and a ruler — directly in the browser, entirely locally.**

Open an image, calibrate against a known distance, then read distances, areas,
angles, radii and object counts in real-world units. MaßWerk runs completely
client-side: no pixel ever leaves the device.

## Features

- **Calibration** via a reference distance; units from µm to ft; saved scale
  profiles (e.g. per lens or flight altitude)
- **Tools:** distance, polyline, perpendicular (lot), angle, intersection
  angle, rectangle, ellipse, circle from 3 points, polygon area, counting,
  note & arrow
- **Image orientation:** 90° steps and straighten ±45° like Apple Photos —
  measurements and scale rotate along exactly; auto-straighten by drawing one
  line along an edge or horizon, with a thirds grid while adjusting
- **Image enhancement** (brightness, contrast, gamma, sharpen, grayscale),
  **lens correction** (barrel/pincushion) and **perspective rectification**
  via four corners
- **Automatic counting** through threshold analysis of a region: total area,
  per-object areas, movable/resizable region; adoptable as a count measurement
- **Documents:** save and reopen complete sessions as `.masswerk` file
  (image, measurements, scale, orientation, filters)
- **Edge snapping** with sub-pixel accuracy and a loupe while placing points
- **Export:** PNG with burned-in measurements and scale bar,
  measurement table as CSV or Excel
- **Formats:** JPG, PNG, WebP, BMP, GIF, TIFF (including very high resolution)
- Sessions are restored locally; undo/redo across all measurements
- **Localized:** German and English, switchable in the top bar
- **Touch-ready:** pinch-zoom, two-finger pan, larger hit targets
- **Keyboard-driven:** press `?` for the full shortcut overview

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

No image at hand? Use **“Load sample image”** in the empty state: a
photographic workbench scene (`public/samples/beispiel.jpg`) with a steel
ruler, caliper and machined blocks – a natural target for calibration,
straightening and object counting.

## Keyboard

| Key | Action | | Key | Action |
|---|---|---|---|---|
| `V` | Select & move | | `R` / `E` | Rectangle / ellipse |
| `K` | Calibrate | | `C` | Circle from 3 points |
| `M` | Distance | | `F` | Polygon area |
| `P` | Polyline | | `Z` | Count |
| `L` | Perpendicular | | `T` | Note & arrow |
| `W` / `X` | Angle / intersection angle | | `Esc` | Cancel / deselect |
| `0` / `1` | Fit / 100 % | | `Enter` | Commit draft |
| `+` / `−` | Zoom | | `Del` | Delete selection |
| `S` | Edge snapping | | `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Space` (hold) | Pan image | | `Shift` (hold) | Bypass snapping |
| `?` | Shortcut overview | | | |

## Tech stack

Next.js (App Router) · React · TypeScript · Zustand · Canvas 2D & WebGL ·
Tailwind CSS. Image pipeline: orientation → lens correction → filters →
analysis capture. Orientation, radial lens correction and filters run in a
single persistent WebGL context (two draw calls, one texture upload per
image); a CPU chain remains as honest fallback where WebGL is unavailable.
The analysis readback buffer is built lazily, only while analysis is active.
All geometry lives in image coordinates and is transformed exactly whenever
the image is. The UI is localized (German source, English dictionary,
gettext-style keys, switcher in the top bar); touch devices get pinch-zoom,
two-finger pan and larger hit targets. Fonts (Geist / Geist Mono) are
self-hosted.

- `src/lib/measure/` – geometry, image processing, rendering, export, store
- `src/components/editor/` – stage, bars, panel, tooltips, shortcut overlay
- `public/samples/beispiel.jpg` – built-in demo photograph (workbench)

Design principles and the full review backlog: [`DESIGN.md`](DESIGN.md)
(written in German).

## License

See [`LICENSE`](LICENSE).
