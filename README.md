# status.stratkern.com

Betriebsstatus der Oase und der Website, **gemessen außerhalb unserer Server**. GitHub Actions misst alle 15 Minuten (`pruefen.mjs`), legt das Ergebnis in `daten/` ab, und GitHub Pages liefert `index.html` aus. Wenn unser Server ausfällt, bleibt diese Seite erreichbar.

- **Kosten:** keine. Das Repo ist öffentlich, dadurch sind Actions-Minuten und Pages frei. Im privaten Repo ginge Pages im Free-Plan der Organisation nicht.
- **Keine Geheimnisse im Repo.** Die Adressen der Kundeninstanzen stehen im Actions-Secret `KUNDEN_ZIELE` und erscheinen auf der Seite nur als Zahl. Der öffentliche Supabase-Schlüssel steht in `SUPABASE_PUBLISHABLE`.
- **Keine Messwerte von Hand.** Der erste Eintrag in `daten/` kommt aus dem ersten Actions-Lauf.

## Einrichten (erst nach Janniks „Status frei“)

```bash
cd ~/Projekte/stratkern-status
gh repo create stratkern/status --public --source . --push
gh secret set KUNDEN_ZIELE --repo stratkern/status          # Adressen der Kundeninstanzen, kommagetrennt
gh secret set SUPABASE_PUBLISHABLE --repo stratkern/status  # publishable key aus der Supabase-API
gh api -X POST repos/stratkern/status/pages -f 'source[branch]=main' -f 'source[path]=/'
gh api -X PUT repos/stratkern/status/pages -f cname=status.stratkern.com
gh workflow run messen.yml --repo stratkern/status
cd ~/Projekte/oase && node kontext/dns-eintrag-anlegen.cjs status.stratkern.com stratkern.github.io --cname
```

Danach setzen: in Pages „Enforce HTTPS“, sobald GitHub das Zertifikat ausgestellt hat.

**Rückweg:**
1. `gh repo archive stratkern/status`, oder das Repo löschen, das braucht Janniks Wort.
2. Den DNS-Eintrag `status` in IONOS entfernen.
