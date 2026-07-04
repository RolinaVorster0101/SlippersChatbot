require("dotenv").config();
const path = require("path");
const express = require("express");
const mysql = require("mysql2/promise");
const { topics: seedTopics, rules: seedRules } = require("./db/seedData");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
});

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
      SELECT r.id, r.patterns, r.replies, r.sort_order, r.clears_topic,
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
      requiresTopic: row.requires_topic || null,
      setsTopic: row.sets_topic || null,
      clearsTopic: !!row.clears_topic,
    }));

    res.json(shaped);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load rules" });
  }
});

ensureSeeded()
  .catch((err) => console.error("Seeding failed:", err))
  .finally(() => {
    app.listen(PORT, () => console.log(`Slippers backend listening on port ${PORT}`));
  });
