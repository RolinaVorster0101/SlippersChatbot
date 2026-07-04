# Slippers backend — Phase 1: data-driven rules

This is the foundation piece: a small Express API, backed by a MariaDB database,
that serves the chatbot's topics and rules as JSON instead of a hardcoded array
in the HTML file. This is what makes an admin panel possible later — editing a
row in the database changes what Slippers says, with no code deploy needed.

## What's NOT in here yet (by design, for this phase)

A handful of rules still live in the front-end JS because they involve
stateful behaviour (memory, mood, pronoun reflection) rather than a plain
pattern → reply lookup: name capture/recall, the badword-aware "YOU ARE *"
check, "HOW ARE YOU" + its yes/no follow-up, "I FEEL *" reflection, the
bad-language filter, and "FORGET ME". Everything else (identity chit-chat,
greetings, jokes, and all five topics — weather/sports/gaming/philosophy/ballet)
is now data-driven. We'll fold the rest in during the admin-panel phase.

## 1. Create the database in DirectAdmin

1. In DirectAdmin, find **MySQL Management** (usually under "Extra Features" or
   your account's feature list).
2. Create a new database — e.g. name it `slippers` (DirectAdmin will prefix it
   with your account name automatically, like `teoihwmx_slippers`).
3. Create a database user for it, and note down:
   - the **database name** (with prefix)
   - the **username** (with prefix)
   - the **password** you set
   - the **host** — almost always `localhost` on shared hosting

## 2. Import the schema

1. Open **phpMyAdmin** (you already found this).
2. Select your new database in the left sidebar.
3. Click the **Import** tab.
4. Choose the file `db/schema.sql` from this project and click **Go**.
5. You should now see two empty tables: `topics` and `rules`.

You do **not** need to run any seed script by hand — the app seeds itself
automatically the first time it starts, if it finds the `topics` table empty.

## 3. Upload the project files

Upload this whole folder (`app.js`, `package.json`, `.env.example`, `db/`)
somewhere **outside** `public_html` — e.g. a folder like `slippers-backend/`
in your home directory. DirectAdmin's Node Selector runs the app itself; it
doesn't need to sit in your public web folder.

Rename `.env.example` to `.env` and fill in the values from Step 1:

```
DB_HOST=localhost
DB_USER=teoihwmx_yourdbuser
DB_PASSWORD=your-db-password
DB_NAME=teoihwmx_slippers
```

## 4. Create the Node.js app in DirectAdmin

Back in the **Setup Node.js App** screen you showed me:

| Field | Value |
|---|---|
| Node.js version | **18.20.8 (recommended)** |
| Application mode | Production |
| Application root | the folder you uploaded to, e.g. `slippers-backend` |
| Application URL | pick a subdomain, e.g. `api.rvor.co.za` or a path like `slippers.rvor.co.za/api` |
| Application startup file | `app.js` |

Click **Create**. DirectAdmin will show you the app's management page with
buttons for:

- **Run NPM Install** — click this once, it reads `package.json` and installs
  `express`, `mysql2`, and `dotenv`.
- **Restart** — click this any time you update files or need the seed logic
  to re-run its check.

## 5. Verify it's working

Visit (in a browser):

```
https://api.rvor.co.za/api/health
```

You should see `{"ok":true}`. Then check:

```
https://api.rvor.co.za/api/rules
```

You should see a big JSON array of every rule — patterns, replies, topic
linkage. If the `topics` table was empty, the first request that starts the
app will trigger the seed automatically (check the app's log output in
DirectAdmin if you want to confirm it ran).

## Next phase

Once this is confirmed working, the next steps are:
1. Point the existing chat front-end at `/api/rules` instead of its hardcoded array
2. Add the remaining stateful rules as proper API-driven "actions"
3. Build login/accounts so memory is tied to a real user instead of a browser
4. Build the admin panel UI on top of this same API (it'll just add
   `POST`/`PUT`/`DELETE` routes to `/api/rules` and `/api/topics`)
