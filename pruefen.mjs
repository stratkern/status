#!/usr/bin/env node
// Statusseite status.stratkern.com: misst von GitHub Actions aus, also außerhalb unserer Server.
//
//   node pruefen.mjs          misst einmal, schreibt daten/aktuell.json und daten/verlauf.json
//
// Nur öffentliche Adressen per GET, keine Geheimnisse im Repo. Adressen von Kundeninstanzen stehen nicht hier, sondern
// im Actions-Secret KUNDEN_ZIELE (kommagetrennt). Sie erscheinen auf der Seite nur zusammengefasst als
// „Kundeninstanzen“, nie mit Namen. Der öffentliche Supabase-Schlüssel kommt aus dem Secret SUPABASE_PUBLISHABLE.
//
// Eine Komponente gilt als gestört, wenn sie in drei Versuchen im Abstand von 15 s nicht richtig antwortet.
import fs from 'node:fs';

const kunden = (process.env.KUNDEN_ZIELE || '').split(',').map((s) => s.trim()).filter(Boolean);
const SB = 'https://vpprdjbjincbthnpmceg.supabase.co';
const KOMPONENTEN = [
  { id: 'website', name: 'Website stratkern.com', ziele: [{ url: 'https://stratkern.com/', enthaelt: 'Stratkern' }] },
  { id: 'oase', name: 'Oase: Anmeldung und Oberfläche', ziele: [{ url: 'https://oase.stratkern.com/login', enthaelt: '<html' }] },
  { id: 'kunden', name: 'Kundeninstanzen', ziele: kunden.map((url) => ({ url, enthaelt: '<html' })) },
  { id: 'automation', name: 'Wissens- und Automationsdienste', ziele: [{ url: 'https://n8n.stratkern.com/healthz', enthaelt: 'ok' }] },
  { id: 'datenbank', name: 'Datenbank und Anmeldedienst (Frankfurt)', ziele: process.env.SUPABASE_PUBLISHABLE
    ? [{ url: `${SB}/auth/v1/health`, enthaelt: 'GoTrue', kopf: { apikey: process.env.SUPABASE_PUBLISHABLE } }] : [] },
];

async function einmal(z) {
  let grund = '';
  for (let v = 1; v <= 3; v++) {
    const t0 = Date.now();
    try {
      const r = await fetch(z.url, { redirect: 'follow', headers: z.kopf ?? {}, signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      if (r.ok && text.includes(z.enthaelt)) return { ok: true, ms: Date.now() - t0 };
      grund = `HTTP ${r.status}`;
    } catch (e) { grund = e.name === 'TimeoutError' ? 'Zeitüberschreitung' : 'nicht erreichbar'; }
    if (v < 3) await new Promise((r) => setTimeout(r, 15000));
  }
  return { ok: false, grund };
}

const jetzt = new Date();
const tag = jetzt.toISOString().slice(0, 10);
const aktuell = { gemessen: jetzt.toISOString(), komponenten: [] };
for (const k of KOMPONENTEN) {
  if (!k.ziele.length) { aktuell.komponenten.push({ id: k.id, name: k.name, zustand: 'nicht gemessen' }); continue; }
  const e = await Promise.all(k.ziele.map(einmal));
  const gestoert = e.filter((x) => !x.ok).length;
  const ms = e.filter((x) => x.ok).map((x) => x.ms);
  aktuell.komponenten.push({
    id: k.id, name: k.name,
    zustand: gestoert === 0 ? 'in Betrieb' : gestoert === e.length ? 'gestört' : 'teilweise gestört',
    antwortzeit_ms: ms.length ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length) : null,
    // Bei Kundeninstanzen nur die Zahl, nie die Adresse
    hinweis: gestoert ? (k.id === 'kunden' ? `${gestoert} von ${e.length} nicht erreichbar` : e.find((x) => !x.ok).grund) : undefined,
  });
}

const VERLAUF = 'daten/verlauf.json';
const verlauf = (() => { try { return JSON.parse(fs.readFileSync(VERLAUF, 'utf8')); } catch { return { tage: {} }; } })();
verlauf.tage[tag] ??= {};
for (const k of aktuell.komponenten) {
  if (k.zustand === 'nicht gemessen') continue;
  const t = (verlauf.tage[tag][k.id] ??= { messungen: 0, gestoert: 0 });
  t.messungen += 1;
  if (k.zustand !== 'in Betrieb') t.gestoert += 1;
}
// 90 Tage aufbewahren
for (const d of Object.keys(verlauf.tage).sort().slice(0, -90)) delete verlauf.tage[d];

fs.mkdirSync('daten', { recursive: true });
fs.writeFileSync('daten/aktuell.json', JSON.stringify(aktuell, null, 1));
fs.writeFileSync(VERLAUF, JSON.stringify(verlauf));
for (const k of aktuell.komponenten) console.log(`${k.zustand.padEnd(18)} ${k.name}${k.hinweis ? ` (${k.hinweis})` : ''}`);
