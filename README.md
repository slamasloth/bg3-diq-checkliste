# BG3 DIQ Checkliste

Gemeinsame Missables-Checkliste für einen modifizierten Baldur's-Gate-3-Koop-Durchlauf (DIQ Collection Revision 150): Fortschritt abhaken, Gegenstände Charakteren zuweisen, nach Akt, Gebiet, Mod und Verifizierungsstatus filtern. Läuft als installierbare Web-App (PWA), auch offline.

Quellenstatus ist keine Ingame-Verifikation. «Kandidat» heisst: Fundort oder Version nicht bestätigt.

## Entwicklung
```
npm install
npm run dev      # http://127.0.0.1:5173
npm run check    # svelte-check + tsc
npm run lint
npm test
npm run build
```
Node.js LTS wird benötigt.

## Aufbau
- `public/data/checklist.json` – Datenpaket (wird ausserhalb dieses Repositories erzeugt).
- `src/lib/schema.ts` – Zod-Schema für Datenpaket und gespeicherten Zustand.
- `src/lib/logic.ts` – Filter, Zähler, Zusammenführen nach Zeitstempel (getestet).
- `src/lib/sync/` – Sync-Engine (Outbox, Wiederholung, Konfliktregel «neuerer Zeitstempel gewinnt») hinter einer `SyncTransport`-Schnittstelle.
- `.github/workflows/pages.yml` – Veröffentlichung auf GitHub Pages.

## Konfiguration
Für den Cloud-Sync (in Vorbereitung): `.env.local` mit `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`. Nie den Service-Role-Schlüssel verwenden oder einchecken.

## Guides als PDF (Stand 04.11.2026)
- Kopfzeile «Guides»: Dialog mit den 12 Guides (Dark Urge und Tala vorgewählt). «Save selected» speichert die Auswahl als ein PDF, «Save all 12» alle.
- Die PDF wird auf dem Gerät erzeugt (pdfmake, erst beim ersten Klick nachgeladen, offlinefähig). Inhalt je Guide: Übersicht, Attribute, Levelverlauf 1–20, Feat-Plan, Klassenmechaniken, Ausrüstung je Akt mit Haken-Kästchen (Option 1 = Empfehlung), Endgame-Sets, Kampf, Verpassbares, offene Punkte, Quellen. Bei mehreren Guides mit anklickbarem Inhaltsverzeichnis.
- Datenquelle ist das korrigierte Paket `public/data/builds.pack.json` (siehe `plattform/builds/README_BUILD_DATEN.md`).
- Code: `src/lib/guidePdf.ts` (Dokumentdefinition, testbar), `src/lib/GuidesDialog.svelte`. Tests: `src/lib/guidePdf.test.ts` erzeugt echte PDFs; mit `GUIDE_PDF_OUT=<Ordner>` werden sie zur Prüfung gespeichert.
- Hinweis zur Pflege: pdfmake schreibt Layoutdaten in die übergebenen Knoten. Knoten dürfen deshalb nie zwischen Zellen oder Dokumenten geteilt werden (sonst hunderte leere Seiten); ein Test sichert das ab.
- **Look (Stand 04.11.2026):** Der Dialog hat die Auswahl «Look». *Screen* (Standard) übernimmt das Design des vollständigen Guides: dunkles Papier, Orange #ffa03c, Titelkarte, Reiterleiste mit funktionierenden Links zwischen den drei Blättern, Seitenformat 482 x 857 pt (9:16, für Handy, Tablet und TV). *Print* ist hell auf A4.
- Schriften: Alegreya (Titel) und Alegreya Sans (Text), beide SIL OFL (`src/assets/fonts`, Lizenztexte liegen dabei). Das Spiel selbst nutzt Quadraat (kommerziell, typeby.com); es darf ohne Lizenz nicht eingebettet werden, Alegreya ist die dokumentierte Zweitschrift. Attributtabellen (Basiswerte, Verlauf pro Level) kommen aus `builds/store/tabellen.json`. Sie werden erst beim Erzeugen geladen und vom Service Worker für Offlinebetrieb mitgespeichert.
- Kontrast: Alle Textfarben erreichen auf ihren Hintergründen WCAG AA (4.5:1); ein Test sichert das ab.

