const express = require("express");
const { requireAdmin } = require("../middleware/auth");

module.exports = function(pool){
  const router = express.Router();
  router.use(requireAdmin);

  // ---------- topics ----------
  router.get("/topics", async (req, res) => {
    const [rows] = await pool.query("SELECT id, code, display_name FROM topics ORDER BY display_name");
    res.json(rows);
  });

  router.post("/topics", async (req, res) => {
    const { code, displayName } = req.body || {};
    if(!code || !displayName){
      return res.status(400).json({ error: "code and displayName are required" });
    }
    try{
      const [result] = await pool.query(
        "INSERT INTO topics (code, display_name) VALUES (?, ?)",
        [code.toUpperCase().trim(), displayName.trim()]
      );
      res.json({ id: result.insertId, code: code.toUpperCase().trim(), display_name: displayName.trim() });
    } catch(err){
      if(err.code === "ER_DUP_ENTRY"){
        return res.status(400).json({ error: "A topic with that code already exists." });
      }
      console.error(err);
      res.status(500).json({ error: "Could not create topic" });
    }
  });

  router.put("/topics/:id", async (req, res) => {
    const { displayName } = req.body || {};
    await pool.query("UPDATE topics SET display_name = ? WHERE id = ?", [displayName, req.params.id]);
    res.json({ ok: true });
  });

  router.delete("/topics/:id", async (req, res) => {
    // Rules referencing this topic have requires_topic_id / sets_topic_id set to
    // NULL automatically (ON DELETE SET NULL in the schema) rather than being deleted.
    await pool.query("DELETE FROM topics WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  });

  // ---------- rules ----------
  router.get("/rules", async (req, res) => {
    const [rows] = await pool.query(`
      SELECT r.id, r.patterns, r.replies, r.replies_alt, r.sort_order, r.enabled, r.notes,
             r.clears_topic, r.requires_topic_id, r.sets_topic_id, r.special_key,
             rt.code AS requires_topic_code, st.code AS sets_topic_code
      FROM rules r
      LEFT JOIN topics rt ON r.requires_topic_id = rt.id
      LEFT JOIN topics st ON r.sets_topic_id = st.id
      ORDER BY r.sort_order ASC, r.id ASC
    `);
    const shaped = rows.map(row => ({
      id: row.id,
      patterns: typeof row.patterns === "string" ? JSON.parse(row.patterns) : row.patterns,
      replies: typeof row.replies === "string" ? JSON.parse(row.replies) : row.replies,
      repliesAlt: row.replies_alt
        ? (typeof row.replies_alt === "string" ? JSON.parse(row.replies_alt) : row.replies_alt)
        : null,
      sortOrder: row.sort_order,
      enabled: !!row.enabled,
      notes: row.notes,
      clearsTopic: !!row.clears_topic,
      requiresTopicId: row.requires_topic_id,
      setsTopicId: row.sets_topic_id,
      requiresTopicCode: row.requires_topic_code,
      setsTopicCode: row.sets_topic_code,
      specialKey: row.special_key || null,
    }));
    res.json(shaped);
  });

  router.post("/rules", async (req, res) => {
    const { patterns, replies, repliesAlt, requiresTopicId, setsTopicId, clearsTopic, sortOrder, notes } = req.body || {};
    if(!Array.isArray(patterns) || patterns.length === 0){
      return res.status(400).json({ error: "patterns must be a non-empty array" });
    }
    if(!Array.isArray(replies) || replies.length === 0){
      return res.status(400).json({ error: "replies must be a non-empty array" });
    }
    try{
      const [result] = await pool.query(
        `INSERT INTO rules (requires_topic_id, sets_topic_id, clears_topic, patterns, replies, replies_alt, sort_order, enabled, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          requiresTopicId || null,
          setsTopicId || null,
          clearsTopic ? 1 : 0,
          JSON.stringify(patterns.map(p => p.toUpperCase().trim())),
          JSON.stringify(replies),
          repliesAlt && repliesAlt.length ? JSON.stringify(repliesAlt) : null,
          sortOrder || 0,
          notes || null,
        ]
      );
      res.json({ id: result.insertId });
    } catch(err){
      console.error(err);
      res.status(500).json({ error: "Could not create rule" });
    }
  });

  router.put("/rules/:id", async (req, res) => {
    const { patterns, replies, repliesAlt, requiresTopicId, setsTopicId, clearsTopic, sortOrder, notes, enabled } = req.body || {};
    if(!Array.isArray(patterns) || patterns.length === 0){
      return res.status(400).json({ error: "patterns must be a non-empty array" });
    }
    if(!Array.isArray(replies) || replies.length === 0){
      return res.status(400).json({ error: "replies must be a non-empty array" });
    }
    try{
      await pool.query(
        `UPDATE rules SET
           patterns = ?, replies = ?, replies_alt = ?, requires_topic_id = ?, sets_topic_id = ?,
           clears_topic = ?, sort_order = ?, notes = ?, enabled = ?
         WHERE id = ?`,
        [
          JSON.stringify(patterns.map(p => p.toUpperCase().trim())),
          JSON.stringify(replies),
          repliesAlt && repliesAlt.length ? JSON.stringify(repliesAlt) : null,
          requiresTopicId || null,
          setsTopicId || null,
          clearsTopic ? 1 : 0,
          sortOrder || 0,
          notes || null,
          enabled ? 1 : 0,
          req.params.id,
        ]
      );
      res.json({ ok: true });
    } catch(err){
      console.error(err);
      res.status(500).json({ error: "Could not update rule" });
    }
  });

  router.delete("/rules/:id", async (req, res) => {
    const [rows] = await pool.query("SELECT special_key FROM rules WHERE id = ?", [req.params.id]);
    if(rows.length && rows[0].special_key){
      return res.status(400).json({
        error: "This rule powers a built-in behavior (name memory, mood, feelings, or forget-me) and can't be deleted. You can disable it instead."
      });
    }
    await pool.query("DELETE FROM rules WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  });

  // ---------- export / import (for syncing rules between two separate databases,
  // e.g. testing locally then bringing new rules over to the live site) ----------
  router.get("/export", async (req, res) => {
    const [topics] = await pool.query("SELECT code, display_name FROM topics ORDER BY code");
    const [rows] = await pool.query(`
      SELECT r.patterns, r.replies, r.replies_alt, r.sort_order, r.enabled, r.notes,
             r.clears_topic, r.special_key,
             rt.code AS requires_topic_code, st.code AS sets_topic_code
      FROM rules r
      LEFT JOIN topics rt ON r.requires_topic_id = rt.id
      LEFT JOIN topics st ON r.sets_topic_id = st.id
      ORDER BY r.sort_order ASC, r.id ASC
    `);
    const rules = rows.map(row => ({
      patterns: typeof row.patterns === "string" ? JSON.parse(row.patterns) : row.patterns,
      replies: typeof row.replies === "string" ? JSON.parse(row.replies) : row.replies,
      repliesAlt: row.replies_alt
        ? (typeof row.replies_alt === "string" ? JSON.parse(row.replies_alt) : row.replies_alt)
        : null,
      sortOrder: row.sort_order,
      enabled: !!row.enabled,
      notes: row.notes,
      clearsTopic: !!row.clears_topic,
      requiresTopicCode: row.requires_topic_code,
      setsTopicCode: row.sets_topic_code,
      specialKey: row.special_key || null,
    }));
    res.json({ exportedAt: new Date().toISOString(), topics, rules });
  });

  router.post("/import", async (req, res) => {
    const { topics = [], rules = [] } = req.body || {};
    const conn = await pool.getConnection();
    let topicsAdded = 0, rulesAdded = 0, rulesSkippedSpecial = 0, rulesSkippedDuplicate = 0;
    try{
      // upsert topics by code
      for(const t of topics){
        const [existing] = await conn.query("SELECT id FROM topics WHERE code = ?", [t.code]);
        if(existing.length === 0){
          await conn.query("INSERT INTO topics (code, display_name) VALUES (?, ?)", [t.code, t.display_name]);
          topicsAdded++;
        }
      }

      // build a fresh code -> id map (covers both pre-existing and newly-added topics)
      const [allTopics] = await conn.query("SELECT id, code FROM topics");
      const topicIdByCode = {};
      allTopics.forEach(t => { topicIdByCode[t.code] = t.id; });

      const [existingRules] = await conn.query("SELECT patterns FROM rules");
      const existingPatternSets = new Set(
        existingRules.map(r => JSON.stringify((typeof r.patterns === "string" ? JSON.parse(r.patterns) : r.patterns).slice().sort()))
      );

      for(const r of rules){
        // Special rules (name memory, mood, etc.) are managed per-install by the
        // self-healing seed on boot — never imported, to avoid ever duplicating
        // or conflicting with a protected built-in behavior.
        if(r.specialKey){
          rulesSkippedSpecial++;
          continue;
        }
        const key = JSON.stringify((r.patterns || []).slice().sort());
        if(existingPatternSets.has(key)){
          rulesSkippedDuplicate++;
          continue;
        }
        await conn.query(
          `INSERT INTO rules (requires_topic_id, sets_topic_id, clears_topic, patterns, replies, replies_alt, sort_order, enabled, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            r.requiresTopicCode ? (topicIdByCode[r.requiresTopicCode] || null) : null,
            r.setsTopicCode ? (topicIdByCode[r.setsTopicCode] || null) : null,
            r.clearsTopic ? 1 : 0,
            JSON.stringify(r.patterns),
            JSON.stringify(r.replies),
            r.repliesAlt && r.repliesAlt.length ? JSON.stringify(r.repliesAlt) : null,
            r.sortOrder || 0,
            r.enabled === false ? 0 : 1,
            r.notes || null,
          ]
        );
        existingPatternSets.add(key);
        rulesAdded++;
      }

      res.json({ topicsAdded, rulesAdded, rulesSkippedSpecial, rulesSkippedDuplicate });
    } catch(err){
      console.error(err);
      res.status(500).json({ error: "Import failed: " + err.message });
    } finally{
      conn.release();
    }
  });

  return router;
};
