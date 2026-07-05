# Slippers 🩰

A pattern-matching chatbot in the spirit of old AIML-era bots like Mitsuku — no machine
learning, no LLM, just a database of trigger phrases and replies, wrapped in a soft
ballet-pink UI with a hand-animated SVG avatar (blinking, winking, glancing around,
chuckling at "lol"/"haha").

Live at: **slippers.rvor.co.za**

## What's actually in here

- **Chat engine** (`public/js/chat.js`) — fetches rules from the database, matches the
  user's message against them (exact-phrase patterns always beat wildcard `*` patterns;
  topic-scoped rules always beat generic ones), and picks a random reply.
- **Topics** — WEATHER, SPORTS, GAMING, PHILOSOPHY (bait-and-switch), BALLET. Fully
  admin-editable, and you can add new ones from the browser.
- **User accounts** — registration (honeypot + rate limiting + Cloudflare Turnstile +
  required 18+ confirmation) and login (rate limiting + Turnstile), sessions stored in
  MySQL, per-account chat memory (name/mood/topic) instead of browser localStorage.
- **Admin panel** (`/admin.html`) — sidebar of topics, full CRUD on topics and rules,
  changes go live immediately with no redeploy. Export/import buttons let you sync rules
  you've tested locally over to the live site (see below).
- **"Special" rules** — name memory, mood tracking, ELIZA-style pronoun reflection
  ("I feel anxious" → "why do you feel anxious?"), and "forget me" all live in the
  database like everything else (wording/patterns are admin-editable), but their
  underlying mechanic is fixed in code via a `special_key` column — see
  `public/js/chat.js`'s `applySpecialEffects()`. These 8 rules can't be deleted from the
  admin panel (only disabled), to prevent accidentally breaking a core mechanic.
- **Inactivity cleanup** — accounts inactive for 120+ days are automatically deleted
  (the admin account is explicitly exempt, regardless of activity). Runs once at boot,
  then once every 24 hours.
- **Legal pages** — `/privacy.html` and `/terms.html`, a cookie consent banner, and a
  footer with contact details on every public page.
- **Mobile responsive** — all pages adapt below ~600-760px, including the admin sidebar
  restructuring into a stacked layout.

## Folder structure

```
app.js                      Express entry point — sessions, static files, seeding, cleanup job
server/
  middleware/auth.js         requireAuth, requireAdmin
  routes/
    auth.js                  register, login, logout, me
    memory.js                per-account name/mood/topic (GET/PUT/DELETE)
    admin.js                 topics + rules CRUD, export/import
db/
  schema.sql                 full table definitions (reference — see migration notes below)
  seedData.js                initial topic content (weather/sports/gaming/philosophy/ballet)
  specialRuleSeed.js          the 8 special-mechanic rule definitions
public/
  index.html, css/style.css, js/chat.js       the chat page itself
  login.html, register.html, css/auth.css, js/login.js, js/register.js
  admin.html, css/admin.css, js/admin.js
  privacy.html, terms.html, css/legal.css
  css/site.css, js/cookieConsent.js            shared footer + cookie banner styling/logic
```

## Environment variables

Copy `.env.example` to `.env` (locally) or set these in DirectAdmin's Node app
Environment Variables section (live):

```
DB_HOST, DB_USER, DB_PASSWORD, DB_NAME    your MySQL/MariaDB credentials
SESSION_SECRET                             random string, signs login cookies (see notes below)
ADMIN_USERNAME                             whichever username should become admin on registration
TURNSTILE_SECRET_KEY                       from Cloudflare Turnstile (leave unset locally = dev bypass)
```

`SESSION_SECRET` doesn't need to match between local and live — they're two independent
servers, each just needs its own random value. `TURNSTILE_SECRET_KEY` left blank skips
the captcha check entirely, which is fine for local dev but should always be set live.

## Local development

1. MySQL/MariaDB server running locally (Workbench is just the GUI client — you need an
   actual server underneath it, e.g. installed via the MySQL Installer on Windows)
2. Create a local database, run `db/schema.sql` against it once
3. `npm install`
4. `npm start`, visit `http://localhost:3000` — redirects to `/login.html` since nothing's
   logged in yet. Register with the username set as `ADMIN_USERNAME` to get admin access.

## Deploying to DirectAdmin (live)

1. Create a MySQL database + user (Extra Features → MySQL Management), note the credentials
2. Import `db/schema.sql` via phpMyAdmin's Import tab
3. Upload the project (minus `node_modules`, `.env`, `.git`) to a folder **outside**
   `public_html` — e.g. `domains/yourdomain/slippers-app`
4. Setup Node.js App → Node 18.20.8, Production mode, point Application root at that
   folder, startup file `app.js`, add the environment variables above
5. Run NPM Install, then Restart

The app self-seeds its own database on first boot (topics/rules if empty, special rules
individually by key) — no manual data-entry script needed, ever.

## Applying schema changes to an existing (already-seeded) database

Since `CREATE TABLE IF NOT EXISTS` doesn't retroactively add columns, whenever a change
adds new columns to an existing table, you'll get a specific `ALTER TABLE` snippet to run
once in Workbench (local) and once in phpMyAdmin's SQL tab (live) — new rows/rules are
always self-healing, but new *columns* need this one manual step. Current schema
includes all such changes; check git history if you need to reconstruct what changed when.

## Syncing rules between local and live

These are two entirely separate databases with no connection to each other. To bring
rules you've tested locally over to the live site: **Export rules** in the local admin
panel (downloads a JSON file) → **Import rules** in the live admin panel (upload that
file). Safe to re-run any time — it skips anything that already exists (matched by exact
pattern list) and never touches the 8 protected special rules.

## Still outstanding / explicitly deferred

- **Password reset / forgot password** — deferred. Would require collecting email
  addresses at registration and setting up outbound mail (DirectAdmin can do this, but
  it's a separate setup step). For now, only you (the admin) exist as a realistic account
  to lose access to, and this trade-off was made deliberately for now.
- **User management UI** — deliberately skipped in favor of the 120-day inactivity
  auto-delete, since there's only one admin and no real moderation need.
- **General user management/moderation tools** — not built; revisit if the user base or
  need for oversight grows.

## A few real bugs found and fixed along the way (for context if something seems off)

- MariaDB's JSON columns get auto-parsed by the driver — code must check
  `typeof x === "string"` before calling `JSON.parse()`, or it'll silently mangle data.
- Rule matching must check exact-phrase patterns before wildcard (`*`) patterns, and
  topic-scoped rules before generic ones — otherwise a vague rule can steal messages
  meant for a more specific one (this bit us twice before the general fix went in).
- Session cookies marked `secure: true` get silently dropped without `app.set("trust
  proxy", 1)`, since Express can't otherwise tell it's behind DirectAdmin's HTTPS-terminating
  reverse proxy.
