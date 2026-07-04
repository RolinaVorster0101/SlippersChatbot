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
      SELECT r.id, r.patterns, r.replies, r.sort_order, r.enabled, r.notes,
             r.clears_topic, r.requires_topic_id, r.sets_topic_id,
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
      sortOrder: row.sort_order,
      enabled: !!row.enabled,
      notes: row.notes,
      clearsTopic: !!row.clears_topic,
      requiresTopicId: row.requires_topic_id,
      setsTopicId: row.sets_topic_id,
      requiresTopicCode: row.requires_topic_code,
      setsTopicCode: row.sets_topic_code,
    }));
    res.json(shaped);
  });

  router.post("/rules", async (req, res) => {
    const { patterns, replies, requiresTopicId, setsTopicId, clearsTopic, sortOrder, notes } = req.body || {};
    if(!Array.isArray(patterns) || patterns.length === 0){
      return res.status(400).json({ error: "patterns must be a non-empty array" });
    }
    if(!Array.isArray(replies) || replies.length === 0){
      return res.status(400).json({ error: "replies must be a non-empty array" });
    }
    try{
      const [result] = await pool.query(
        `INSERT INTO rules (requires_topic_id, sets_topic_id, clears_topic, patterns, replies, sort_order, enabled, notes)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          requiresTopicId || null,
          setsTopicId || null,
          clearsTopic ? 1 : 0,
          JSON.stringify(patterns.map(p => p.toUpperCase().trim())),
          JSON.stringify(replies),
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
    const { patterns, replies, requiresTopicId, setsTopicId, clearsTopic, sortOrder, notes, enabled } = req.body || {};
    try{
      await pool.query(
        `UPDATE rules SET
           patterns = ?, replies = ?, requires_topic_id = ?, sets_topic_id = ?,
           clears_topic = ?, sort_order = ?, notes = ?, enabled = ?
         WHERE id = ?`,
        [
          JSON.stringify(patterns.map(p => p.toUpperCase().trim())),
          JSON.stringify(replies),
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
    await pool.query("DELETE FROM rules WHERE id = ?", [req.params.id]);
    res.json({ ok: true });
  });

  return router;
};
