# MaßWerk · Design-Grundsätze (verbindlich)

> Dieses Dokument ist die Verfassung des Produkts. Es hält den Maßstab fest,
> den MaßWerk an sich selbst anlegt – abgeleitet aus der Apple-Schule
> (Steve Jobs, Jony Ive): Pages, Keynote, Fotos.
>
> **Geltung:** Jede Änderung am Produkt wird gegen dieses Dokument geprüft.
> Wo `DESIGN.md` den Befund einzelner Runden festhält (das *Warum* konkreter
> Eingriffe), steht hier das dauerhafte *Gesetz*. Bei Widerspruch gewinnt
> dieses Dokument.
>
> Leitfrage bei jeder Entscheidung:
> *„Would Dave like this?"* – und die schärfere Variante:
> *Würde Jony Ive es so lassen – oder wegwerfen?*

---

## 1 · Kern-Manifest

1. **Fokus heißt Nein sagen.** Ein Produkt, das alles kann, kann nichts gut.
   Jede Funktion, jede Einstellung, jedes Wort auf dem Bildschirm muss sich
   gegen die Frage behaupten: *Fehlt es, wenn es weg ist?* Wenn nicht –
   ist es schon weg.
2. **Einfachheit ist die höchste Form der Raffinesse.** Nicht „weniger Knöpfe",
   sondern weniger *Denkarbeit*. Der Nutzer soll messen, nicht die Software
   verstehen.
3. **Es muss funktionieren.** Schönheit, die hakt, ist keine Schönheit.
   „It just works" ist kein Marketing-Satz, sondern die Abnahmekriterium-Reihenfolge:
   erst korrekt, dann schnell, dann schön – und schön bedeutet: man merkt
   nichts von der Technik.
4. **Detailbesessenheit ist keine Option.** Der Abstand, der 1 px daneben liegt,
   die Animation, die 40 ms zu spät kommt, der Text, der „OK" sagt statt zu
   erklären – all das summiert sich zum Gefühl „billig". Wir bauen kein
   Billigprodukt.
5. **Der Geschmack des Nutzers ist heilig.** Keine Dark Patterns, keine
   Nudges, keine aufmerksamkeit heischenden Effekte. Das Werkzeug dient –
   es führt sich nicht auf.
6. **Ehrlichkeit der Materialien.** Ein Button, der nichts tut, ist eine Lüge.
   Ein Zustand, der sich nicht erklärt, ist eine Falle. Jede Oberfläche sagt
   die Wahrheit über das, was sie kann und was gerade geschieht.

---

## 2 · Visuelle Architektur & Materialien

1. **Ein Materialvokabular.** Oberflächen sind geschichtete Platten
   (surface-1…4) mit einer einzigen Lichtquelle von oben; Kanten sind Haarlinien
   (`--mw-border`), keine schwarzen Balken. Schatten tragen Tiefe, keine Deko.
2. **Eine Typografie, zwei Stimmen.** Geist Sans spricht (UI-Text), Geist Mono
   zählt (alle Messwerte, tabular). Zahlen flackern nie – `font-tabular` ist
   Pflicht an jeder Ziffer, die sich ändern kann.
3. **Eine Akzentfarbe mit Bedeutung.** Blau heißt: *hier bist du, hier kannst
   du handeln.* Akzent erscheint nur für Aktives, Fokus und die eine primäre
   Einladung pro Ansicht. Alles andere ist Grauskala.
4. **Eine Icon-Familie.** lucide, 1.7 px Strich, 15–16 px Größe, optisch
   ausgerichtet. Icons sind Verben, keine Deko – ein Icon ohne Aktion
   existiert nicht.
5. **Dunkel zuerst, Hell mitgedacht.** `light-dark()`-Token statt harter
   Farben. Kein Farbwert gehört in eine Komponente, der nicht als Token
   existiert (Ausnahme: Canvas-Rendering, das dokumentiert ist).
6. **Bühne und Werkzeug trennen.** Das Bild ist der Star, die Chrome ist
   das gedimmte Theater darum. Ohne Bild gehört die Bühne der Einladung –
   Werkzeugreihen, die ins Leere zeigen, sind Bühnenbild ohne Stück.

---

## 3 · Interaktionsdesign & Dynamik

1. **Direkte Manipulation, null Latenz-Gefühl.** Regler bewegen Bilder,
   nicht Ladebalken. Teure Operationen entprellen still und zeigen sofort
   eine ehrliche Zwischenstufe – niemals ein blockierendes Modal für etwas,
   das der Rechner nebenbei kann.
2. **Jeder Modus hat sichtbare Grenzen und einen sichtbaren Ausgang.**
   Wer einen Modus betritt, sieht: was gilt jetzt, wie komme ich heraus.
   Escape funktioniert immer. Kein Werkzeugwechsel hinterlässt einen
   vergessenen Modus (Zero Dead Ends).
3. **Unsichtbare Operationen brauchen sichtbare Geometrie.** Wenn das System
   im Verborgenen schneidet, dreht oder transformiert, muss die Bühne den
   Vorgang erklären: Rahmen, Raster, Hintergrund – der Nutzer muss *sehen*,
   was mit seinem Bild passiert, statt es zu erahnen.
4. **Jeder Klick bekommt eine Antwort.** Innerhalb von ~100 ms muss sichtbar,
   hörbar oder fühlbar sein, dass die Eingabe angekommen ist. Ein Steuerelement
   ohne Antwort ist entweder kaputt oder überflüssig – beides wird entfernt.
5. **Erschaffenes bleibt greifbar.** Jedes Objekt, das der Nutzer erzeugt hat,
   kann später gefunden, ausgewählt, bewegt und gelöscht werden. Hit-Flächen
   sind großzügig; Hover verspricht die Aktion („move"), bevor der Klick sie
   verlangt.
6. **Bewegung hat Physik, kein Theater.** 150–250 ms, kubisch ausklingend,
   kleine Wege. Animation erklärt Zustandsübergänge (Woher, Wohin) – sie
   feiert nichts. Kein Bounce, kein Konfetti, keine Schleifen.
7. **Feedback ist dreistufig.** *Bestätigung* (kurz, warm: Impuls-Ring,
   „Gespeichert"), *Korrektur* (sachlich: Banner, ein Satz), *Fehler*
   (helfend: was geschah, was jetzt geht). Nie eine Textwand, nie ein
   nacktes „Fehler".
8. **Vergebung vor Bestätigung.** Undo denkt in Zuständen, nicht in Aktionen,
   und deckt alles ab. Wo Undo existiert, braucht es keinen
   „Sind Sie sicher?"-Dialog.

---

## 4 · Feature-Regeln

1. **Eine Funktion, ein Ort.** Jede Aktion hat genau eine Heimat im UI
   (plus optional Tastenkürzel, das denselben Weg geht). Zwei Knöpfe für
   dasselbe sind ein ungelöster Informationsarchitektur-Konflikt.
2. **Features verdienen ihren Platz im ersten Kontakt.** Was der Nutzer in
   den ersten 60 Sekunden nicht braucht, liegt im Panel oder hinter einem
   Kürzel – nicht auf der Bühne.
3. **Kalibrierung vor Messwert.** Ohne Maßstab ist jeder Messwert wertlos.
   Das Produkt führt einmal, klar und freundlich zur Kalibrierung – und
   drängt danach nie wieder.
4. **Export ist das Produkt.** Was nicht als PNG/CSV/Excel das Haus
   verlassen kann, existiert für den Nutzer nicht. Exportqualität ist
   Renderingqualität: identische Linien, identische Chips, identische
   Maßstabsbalken.
5. **Kein Feature ohne Rückbau.** Jede neue Fähigkeit kommt mit: Undo-Pfad,
   Tastenkürzel (oder begründetem Verzicht), Tooltip-Erklärung und einem
   Eintrag in `DESIGN.md`.
6. **Ehrliche Beispielinhalte.** Demo-Material muss so gut sein, dass man es
   freiwillig anschaut. Ein hässliches Beispielbild sagt: „So achten wir auf
   Details" – und meint es anders.

---

## 5 · Release-Qualitäts-Checkliste

Vor jedem Merge gegen `main` – ausnahmslos:

- [ ] `tsc --noEmit` fehlerfrei, `next build` (statischer Export) erfolgreich
- [ ] Jeder neue/geänderte Control: Klick, Doppelklick, Rechtsklick, Esc,
      Tastaturfokus – jede Eingabe hat eine sichtbare Antwort
- [ ] Jeder Modus: Eintritt sichtbar, Austritt sichtbar (Escape + UI-Weg),
      kein Werkzeugwechsel hinterlässt Modusleichen
- [ ] Kein toter Pixel: kein Steuerelement ohne Funktion, kein Tooltip ohne
      Wahrheit, keine disabled-Schalter ohne Grund
- [ ] Leere Zustände: Chrome tritt zurück, Einladung ist klar, Drag & Drop
      und Paste funktionieren
- [ ] Zahlen stabil: tabular, keine Flacker-Breiten, Einheiten immer mit
- [ ] Bewegung: ≤ 250 ms, kein Bounce, keine Daueranimation
- [ ] Undo/Redo deckt jede neue Aktion ab (Zustände, nicht Aktionen)
- [ ] Export identisch zur Bühnenansicht
- [ ] Screenreader-Grundlagen: `role="status"` für Banner, `aria-*` für
      Dialoge/Toggles, Fokus sichtbar
- [ ] Kein Konsolenfehler im normalen Durchlauf (Öffnen → Kalibrieren →
      Messen → Exportieren)
- [ ] `DESIGN.md` aktualisiert (Befund/Maßnahme), bei Grundsatzfragen:
      Abgleich mit diesem Dokument

---

## 6 · MaßWerk-Erweiterungen (aus der Praxis abgeleitet)

Diese Regeln wurden aus konkreten Fehlern der Produktgeschichte gewonnen
(Runde „Kritikliste", siehe `DESIGN.md` §1.10). Sie sind so bindend wie
die Abschnitte 1–5:

1. **Modi sind keine Sackgassen.** *(Befund: Analyse-Modus blieb nach
   Werkzeugwahl aktiv; Entzerrung ebenso.)* `setTool` räumt jeden Fremdmodus
   auf. Ein Modus endet durch Commit, Escape oder Werkzeugwechsel – nie
   durch Vergessen.
2. **Unsichtbare Operationen brauchen sichtbare Grenzen.** *(Befund:
   Geraderichten beschnitt das Bild, ohne es zu zeigen – „Rahmen bleibt
   gerade, Inhalt verschwindet".)* Beim Drehen zeigt die Bühne das
   unbeschnittene Bild hinter dem festen Rahmen plus Drittelraster. Der
   Nutzer sieht den Crop, statt ihn zu erleiden.
3. **Der schnellste Weg ist eine gezogene Linie.** *(Befund: 0,1°-Regler
   für einen schiefen Horizont.)* „Automatisch begradigen": eine Linie
   entlang einer Kante genügt; horizontal oder vertikal wird aus der
   Linienlage interpretiert, Edge-Snap hilft beim Treffen.
4. **Jedes Steuerelement muss antworten.** *(Befund: Maßstab-Badge ohne
   sichtbare Reaktion.)* Das Badge öffnet ein Popover mit dem Kalibrierwert
   und echten Aktionen (Neu kalibrieren, Im Panel anpassen, Entfernen).
5. **Ohne Inhalt tritt die Chrome zurück.** *(Befund: Toolbar, Panel und
   Statusleiste sichtbar ohne Bild.)* Leerzustand heißt: schlanke Leiste,
   volle Bühne, eine Einladung.
6. **Erschaffenes bleibt greifbar.** *(Befund: Notizen nach dem Erstellen
   nicht mehr bewegbar, Hit-Fläche des Punkts zu klein.)* Das
   Anmerkungswerkzeug trifft erst Vorhandenes (auswählen, ziehen, erneut
   klicken = Text editieren), bevor es Neues erstellt. Hit-Test umfasst
   Punkt *und* Text-Chip; Hover zeigt „move".
7. **Jede Frage der Produktperson verdient eine Antwort im Produkt.**
   *(Befund: „Wo ist das Favicon?" – es gab keins.)* Identität ist keine
   Deko: `src/app/icon.svg` trägt das App-Tile-Motiv (Lineal-L +
   Akzent-Diagonale) in jedem Tab.
8. **Beispielinhalte halten dem eigenen Maßstab stand.** *(Befund:
   synthetisches Beispielbild wirkte lieblos – „AI slop".)* Das Beispielbild
   muss schön genug sein, dass man es vermisst, wenn es fehlt.

---

*Stand: September 2026 · Dieses Dokument wächst nur durch Erfahrung –
jede neue Regel nennt ihren Befund.*
