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
