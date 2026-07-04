const express = require("express");
const { requireAuth } = require("../middleware/auth");

module.exports = function(pool){
  const router = express.Router();

  router.get("/", requireAuth, async (req, res) => {
    try{
      const [rows] = await pool.query(
        `SELECT m.display_name, m.mood, t.code AS topic
         FROM user_memory m
         LEFT JOIN topics t ON m.topic_id = t.id
         WHERE m.user_id = ?`,
        [req.session.user.id]
      );
      if(rows.length === 0){
        return res.json({ name: null, mood: 0, topic: null });
      }
      res.json({ name: rows[0].display_name, mood: rows[0].mood, topic: rows[0].topic });
    } catch(err){
      console.error(err);
      res.status(500).json({ error: "Could not load memory" });
    }
  });

  router.put("/", requireAuth, async (req, res) => {
    const { name, mood, topic } = req.body || {};
    try{
      let topicId = null;
      if(topic){
        const [topicRows] = await pool.query("SELECT id FROM topics WHERE code = ?", [topic]);
        if(topicRows.length > 0) topicId = topicRows[0].id;
      }
      await pool.query(
        `INSERT INTO user_memory (user_id, display_name, mood, topic_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), mood = VALUES(mood), topic_id = VALUES(topic_id)`,
        [req.session.user.id, name || null, mood || 0, topicId]
      );
      res.json({ ok: true });
    } catch(err){
      console.error(err);
      res.status(500).json({ error: "Could not save memory" });
    }
  });

  router.delete("/", requireAuth, async (req, res) => {
    try{
      await pool.query(
        "UPDATE user_memory SET display_name = NULL, mood = 0, topic_id = NULL WHERE user_id = ?",
        [req.session.user.id]
      );
      res.json({ ok: true });
    } catch(err){
      console.error(err);
      res.status(500).json({ error: "Could not clear memory" });
    }
  });

  return router;
};
