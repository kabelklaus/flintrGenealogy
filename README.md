# flintrGenealogy

Minimalistische Stammbaum-Webseite mit React, TypeScript, Vite, REST-API und SQLite.

## Start

```bash
npm install
npm run dev
```

Danach ist die App unter `http://localhost:5173/` erreichbar. Die REST-API laeuft auf `http://localhost:3001/`.

## Skripte

```bash
npm run dev          # Frontend und API starten
npm run client       # nur Vite starten
npm run server       # nur API im Watch-Modus starten
npm run server:start # API einmalig starten
npm run build        # TypeScript pruefen und Frontend bauen
npm test             # API-Smoke-Tests ausfuehren
```

## Datenbank

Die SQLite-Datei wird beim API-Start automatisch unter `data/genealogy.sqlite` angelegt. Lokale Datenbankdateien werden nicht versioniert.
