# Clip Dashboard – Einrichtung

Ein Dashboard für alle Clipping-Accounts: alle Videos, Views und Statistiken gesamt, pro Kanal oder pro Account.
Läuft kostenlos online (Vercel + Neon-Datenbank) und aktualisiert sich jeden Morgen automatisch.

**Dauer:** ca. 45–60 Minuten. Du brauchst nichts zu programmieren – nur Konten anlegen und Werte kopieren.

> Hängst du irgendwo? Mach einen Screenshot und schick ihn Claude.

---

## Übersicht der Werte („Environment Variables“)

Die trägst du alle in **Vercel → dein Projekt → Settings → Environment Variables** ein.
Nach jeder Änderung: **Deployments → ⋯ → Redeploy**, sonst gelten sie nicht.

| Name | Woher | Schritt |
|---|---|---|
| `DATABASE_URL` | setzt Vercel automatisch | 3 |
| `DASHBOARD_PASSWORD` | denkst du dir aus | 4 |
| `CRON_SECRET` | beliebiger langer Zufallstext | 4 |
| `YOUTUBE_API_KEY` | Google Cloud | 5 |
| `INSTAGRAM_APP_ID` + `INSTAGRAM_APP_SECRET` | Meta for Developers | 6 |
| `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET` | TikTok for Developers | 7 |

---

## Schritt 1 – Code auf GitHub hochladen

1. Auf [github.com](https://github.com) ein Konto anlegen (falls noch keins).
2. Oben rechts **+ → New repository** → Name `clip-dashboard` → **Private** → **Create repository**.
3. Auf der leeren Seite auf **„uploading an existing file“** klicken.
4. ZIP entpacken, den Ordner `clip-dashboard` öffnen und **alles darin** (nicht den Ordner selbst) ins Browserfenster ziehen → **Commit changes**.

## Schritt 2 – Bei Vercel online stellen

1. [vercel.com](https://vercel.com) → **Continue with GitHub**.
2. **Add New → Project** → dein Repo `clip-dashboard` → **Import** → **Deploy** (nichts verändern).
3. Danach siehst du deine Adresse, z. B. `https://clip-dashboard-abc.vercel.app`.
   **Das ist ab jetzt DEINE_URL.** (Dauerhaft findest du sie unter Project → Settings → Domains.)

Wenn du die Seite öffnest, steht da „Datenbank fehlt“ – das ist richtig so.

## Schritt 3 – Datenbank verbinden

1. Im Vercel-Projekt: **Storage → Create Database → Neon** (Postgres) → Free-Plan → **Create**.
2. **Connect to Project** → dein Projekt auswählen → bestätigen.
   Damit ist `DATABASE_URL` automatisch gesetzt. Die Tabellen legt das Dashboard selbst an.

## Schritt 4 – Passwort und täglicher Auto-Sync

1. **Settings → Environment Variables** → hinzufügen:
   - `DASHBOARD_PASSWORD` = dein Passwort fürs Dashboard
   - `CRON_SECRET` = langer Zufallstext (z. B. 30 beliebige Buchstaben/Zahlen)
2. **Deployments → ⋯ → Redeploy**.
3. DEINE_URL öffnen → einloggen → **Verwalten** → deine 5 Kanäle anlegen (z. B. nach Nische benennen).

Unter „Verwalten → Setup-Status“ siehst du ab jetzt immer, was noch fehlt.

## Schritt 5 – YouTube (ca. 5 Min.)

1. [console.cloud.google.com](https://console.cloud.google.com) → oben **Projekt auswählen → Neues Projekt** → Name „Clip Dashboard“ → Erstellen.
2. Menü ☰ → **APIs & Dienste → Bibliothek** → „YouTube Data API v3“ suchen → **Aktivieren**.
3. **APIs & Dienste → Anmeldedaten → + Anmeldedaten erstellen → API-Schlüssel**.
   Empfohlen: Schlüssel bearbeiten → „API einschränken“ → nur „YouTube Data API v3“.
4. In Vercel: `YOUTUBE_API_KEY` = der Schlüssel → **Redeploy**.
5. Dashboard → **Verwalten** → beim Kanal unter YouTube das `@Handle` oder den Kanal-Link eintragen → **Hinzufügen**.

## Schritt 6 – Instagram (ca. 15 Min.)

**Voraussetzung:** Jeder Insta-Account ist ein **Business- oder Creator-Account**
(Insta-App → Einstellungen → Kontoart und Tools → Zu professionellem Konto wechseln).

1. [developers.facebook.com](https://developers.facebook.com) → **Meine Apps → App erstellen**.
   Anwendungsfall: **„Nachrichten und Inhalte auf Instagram verwalten“** → Namen eingeben → erstellen.
2. In der App: **Anwendungsfälle → Instagram → Anpassen → „API-Einrichtung mit Instagram-Login“**.
3. Dort stehen **Instagram-App-ID** und **Instagram-App-Geheimcode** → in Vercel als
   `INSTAGRAM_APP_ID` und `INSTAGRAM_APP_SECRET` eintragen.
   ⚠️ Nicht die normale Meta-App-ID ganz oben nehmen – das ist eine andere Nummer.
4. Abschnitt **„Instagram-Business-Login einrichten“ → Business-Login-Einstellungen → OAuth-Weiterleitungs-URIs**:
   `DEINE_URL/api/callback/instagram` eintragen → Speichern.
   (Die genaue URL steht im Dashboard unter „Verwalten“ zum Kopieren.)
5. Deine 5 Insta-Accounts als Tester hinzufügen: **App-Rollen → Rollen → Personen hinzufügen → Instagram-Tester**.
   Dann in jedem Account die Einladung annehmen: auf instagram.com einloggen →
   [instagram.com/accounts/manage_access](https://www.instagram.com/accounts/manage_access/) → **Tester-Einladungen → Annehmen**.
6. **Redeploy** → Dashboard → Verwalten → bei Instagram **Verbinden** → mit genau diesem Account einloggen → erlauben.
   Für den nächsten Kanal einfach wieder „Verbinden“ – das Login-Fenster kommt jedes Mal neu.

Die App bleibt im **Entwicklungsmodus**. Das reicht für deine eigenen Accounts – keine Prüfung durch Meta nötig.

## Schritt 7 – TikTok (ca. 15 Min.)

1. [developers.tiktok.com](https://developers.tiktok.com) → registrieren → **Manage apps → Connect an app**.
2. Oben neben dem App-Namen den Schalter auf **Sandbox** → **Create Sandbox** → Name eingeben.
3. **App details** ausfüllen:
   - Icon, Name, Kategorie, kurze Beschreibung („Private analytics dashboard for my own accounts“)
   - Terms of Service URL: `DEINE_URL/terms`
   - Privacy Policy URL: `DEINE_URL/privacy`
   - Platform: **Web**, Website-URL: `DEINE_URL`
4. **Add products** → **Login Kit** und **Display API** hinzufügen.
   Bei **Scopes** diese aktivieren: `user.info.basic`, `user.info.profile`, `user.info.stats`, `video.list`.
5. **Login Kit → Redirect URI (Web):** `DEINE_URL/api/callback/tiktok`
6. **Sandbox settings → Target users → Add account** → nacheinander mit allen 5 TikTok-Accounts einloggen (max. 10).
7. **Apply changes** klicken.
8. Oben bei der App **Client key** und **Client secret** kopieren → in Vercel als
   `TIKTOK_CLIENT_KEY` und `TIKTOK_CLIENT_SECRET` → **Redeploy**.
9. Dashboard → Verwalten → bei TikTok **Verbinden**.
   ⚠️ Vorher auf tiktok.com **zu genau diesem Account wechseln** – TikTok nimmt den gerade eingeloggten.

Falls TikTok verlangt, die Domain mit einer Datei zu bestätigen (z. B. `tiktokAbC123.txt`): in Vercel
`TIKTOK_VERIFICATION_FILE` = Dateiname und `TIKTOK_VERIFICATION_CONTENT` = Inhalt der Datei eintragen → Redeploy.

---

## So benutzt du es

- **Übersicht:** oben „Alle Kanäle“ oder ein einzelner Kanal. Darunter Filter nach Plattform und Zeitraum.
- **Ein einzelner Account:** auf die Account-Karte klicken → alles zeigt nur noch diesen Account. ✕ hebt es auf.
- **Videos:** sortierbar nach Neueste, Views, Likes, Engagement. Klick auf den Titel öffnet das Video.
- **Aktualisieren:** passiert automatisch jeden Morgen (ca. 5–7 Uhr). „Alle aktualisieren“ lädt sofort neu.
- **Täglicher Zuwachs:** erscheint ab dem 2. Tag, weil jeden Tag ein Stand gespeichert und mit dem Vortag verglichen wird.

## Gut zu wissen

- **Instagram-Views** gibt es nur einzeln pro Beitrag. Pro Sync werden die neuesten 150 Beiträge aktualisiert
  plus 150 ältere, die noch keine Views haben. Bei sehr vielen Beiträgen füllt sich der Rest über ein paar Tage auf.
- **YouTube** gibt Shares nicht heraus; dort steht „–“.
- **TikTok-Sandbox** erlaubt bis zu 10 eigene Accounts. Für mehr müsstest du die App zur Prüfung einreichen.
- **Vorschaubilder** von TikTok/Instagram laufen nach einiger Zeit ab und werden beim nächsten Sync erneuert.
- **Instagram-Verbindung** hält 60 Tage und wird automatisch verlängert, solange der tägliche Sync läuft.
- **Vercel Hobby** (kostenlos) ist laut Vercel für private, nicht-kommerzielle Projekte gedacht. Wenn du das
  Dashboard geschäftlich nutzt, prüf die Bedingungen – ggf. ist der Pro-Plan nötig.

## Fehlersuche

| Meldung | Lösung |
|---|---|
| „redirect_uri“ / „Redirect URI mismatch“ | URL bei Meta/TikTok exakt wie im Dashboard unter „Verwalten“ eintragen (https, kein `/` am Ende). |
| Instagram: „Invalid platform app“ | Falsche ID – die **Instagram**-App-ID aus Schritt 6.3 nehmen, nicht die Meta-App-ID. |
| Instagram: Account lässt sich nicht verbinden | Ist er Business/Creator? Ist die Tester-Einladung angenommen? |
| TikTok: „scope“ / „unauthorized“ | In der Sandbox alle 4 Scopes aktivieren und **Apply changes** klicken. Account als Target user hinzugefügt? |
| „… abgelaufen – bitte neu verbinden“ | Verwalten → **Neu verbinden** beim betroffenen Account. |
| Änderungen in Vercel wirken nicht | Nach jeder neuen Variable **Redeploy** klicken. |

Die genaue Fehlermeldung steht immer unter **Verwalten** beim jeweiligen Account.

---

## Was macht welche Datei? (zum Mitlesen)

| Datei | Aufgabe |
|---|---|
| `app/page.tsx` | Übersicht (Kennzahlen, Diagramme, Accounts, Videoliste) |
| `app/manage/page.tsx` + `actions.ts` | Seite „Verwalten“: Kanäle, Accounts verbinden/trennen |
| `app/login/page.tsx`, `proxy.ts`, `lib/auth.ts` | Passwortschutz |
| `app/api/connect/…`, `app/api/callback/…` | Verbinden mit TikTok/Instagram (Login-Weiterleitung) |
| `app/api/sync/[id]` | Einen Account neu laden |
| `app/api/cron` + `vercel.json` | Täglicher Auto-Sync |
| `lib/platforms/youtube.ts`, `instagram.ts`, `tiktok.ts` | Gespräch mit der jeweiligen Plattform |
| `lib/sync.ts` | Videos holen und speichern, Tokens erneuern |
| `lib/queries.ts` | Zahlen fürs Dashboard aus der Datenbank berechnen |
| `lib/db.ts` | Datenbank-Verbindung + Tabellen |
| `components/GrowthChart.tsx`, `BreakdownBars.tsx` | Die beiden Diagramme |
| `app/globals.css` | Aussehen (hell/dunkel automatisch) |
