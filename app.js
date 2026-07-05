require("dotenv").config();
const path = require("path");
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2/promise");
const { topics: seedTopics, rules: seedRules } = require("./db/seedData");
const { specialRuleSeeds } = require("./db/specialRuleSeed");

const app = express();
app.set("trust proxy", 1); // we sit behind DirectAdmin's LiteSpeed reverse proxy —
// this makes Express read X-Forwarded-Proto to correctly detect HTTPS, so secure
// cookies actually get issued instead of silently dropped.
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 5,
});

const sessionStore = new MySQLStore({ ...dbConfig, createDatabaseTable: true });

app.use(session({
  key: "connect.sid",
  secret: process.env.SESSION_SECRET || "dev-only-secret-change-me",
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
    sameSite: "lax",
    // secure:true requires HTTPS, which the live site has (via DirectAdmin) but
    // localhost doesn't during local dev — so only enable it in production.
    secure: process.env.NODE_ENV === "production",
  },
}));

app.use("/api/auth", require("./server/routes/auth")(pool));
app.use("/api/memory", require("./server/routes/memory")(pool));
app.use("/api/admin", require("./server/routes/admin")(pool));

// ---------- self-seed on first boot ----------
// If the topics table is empty, populate it (and the rules table) from
// db/seedData.js. Safe to leave in place — it only runs when the table is empty,
// so it won't clobber anything you edit later via the admin panel.
async function ensureSeeded() {
  const conn = await pool.getConnection();
  try {
    const [[{ count }]] = await conn.query("SELECT COUNT(*) AS count FROM topics");
    if (count > 0) {
      console.log("Database already seeded, skipping.");
      return;
    }
    console.log("Empty database detected — seeding topics and rules...");

    const topicIdByCode = {};
    for (const t of seedTopics) {
      const [result] = await conn.query(
        "INSERT INTO topics (code, display_name) VALUES (?, ?)",
        [t.code, t.display_name]
      );
      topicIdByCode[t.code] = result.insertId;
    }

    for (const r of seedRules) {
      await conn.query(
        `INSERT INTO rules
          (requires_topic_id, sets_topic_id, clears_topic, patterns, replies, sort_order, enabled, notes)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          r.requiresTopic ? topicIdByCode[r.requiresTopic] : null,
          r.setsTopic ? topicIdByCode[r.setsTopic] : null,
          r.clearsTopic ? 1 : 0,
          JSON.stringify(r.patterns),
          JSON.stringify(r.replies),
          r.sortOrder || 0,
          r.notes || null,
        ]
      );
    }
    console.log(`Seeded ${seedTopics.length} topics and ${seedRules.length} rules.`);
  } finally {
    conn.release();
  }
}

// ---------- self-heal: add any missing "special" rules ----------
// Checked individually by special_key on every boot (not just when the whole
// database is empty), so this safely adds these rules to databases that were
// seeded before this feature existed, without duplicating anything on repeat
// restarts, and without touching rows an admin has already customized.
async function ensureSpecialRulesSeeded() {
  const conn = await pool.getConnection();
  try {
    let added = 0;
    for (const r of specialRuleSeeds) {
      const [existing] = await conn.query(
        "SELECT id FROM rules WHERE special_key = ? AND patterns = ?",
        [r.specialKey, JSON.stringify(r.patterns)]
      );
      if (existing.length > 0) continue;

      await conn.query(
        `INSERT INTO rules
          (patterns, replies, replies_alt, sort_order, enabled, notes, special_key)
         VALUES (?, ?, ?, ?, 1, ?, ?)`,
        [
          JSON.stringify(r.patterns),
          JSON.stringify(r.replies),
          r.repliesAlt ? JSON.stringify(r.repliesAlt) : null,
          r.sortOrder || 0,
          r.notes || null,
          r.specialKey,
        ]
      );
      added++;
    }
    if (added > 0) console.log(`Added ${added} special rule(s) (name memory, mood, feelings, forget-me).`);
  } finally {
    conn.release();
  }
}

// ---------- API ----------
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/topics", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, code, display_name FROM topics ORDER BY display_name");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load topics" });
  }
});

// Serves every enabled rule, shaped for the front-end matching engine.
app.get("/api/rules", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.id, r.patterns, r.replies, r.replies_alt, r.sort_order, r.clears_topic, r.special_key,
             rt.code AS requires_topic, st.code AS sets_topic
      FROM rules r
      LEFT JOIN topics rt ON r.requires_topic_id = rt.id
      LEFT JOIN topics st ON r.sets_topic_id = st.id
      WHERE r.enabled = 1
      ORDER BY r.sort_order ASC, r.id ASC
    `);

    const shaped = rows.map((row) => ({
      id: row.id,
      patterns: typeof row.patterns === "string" ? JSON.parse(row.patterns) : row.patterns,
      replies: typeof row.replies === "string" ? JSON.parse(row.replies) : row.replies,
      repliesAlt: row.replies_alt
        ? (typeof row.replies_alt === "string" ? JSON.parse(row.replies_alt) : row.replies_alt)
        : null,
      requiresTopic: row.requires_topic || null,
      setsTopic: row.sets_topic || null,
      clearsTopic: !!row.clears_topic,
      specialKey: row.special_key || null,
    }));

    res.json(shaped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load rules" });
  }
});

ensureSeeded()
  .then(() => ensureSpecialRulesSeeded())
  .catch((err) => console.error("Seeding failed:", err))
  .finally(() => {
    app.listen(PORT, () => console.log(`Slippers backend listening on port ${PORT}`));
  });
