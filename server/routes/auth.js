const express = require("express");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many registration attempts. Try again later." },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts. Try again later." },
});

async function verifyTurnstile(token, remoteIp){
  if(!process.env.TURNSTILE_SECRET_KEY){
    // Turnstile not configured yet — allow through (dev/local mode).
    // Once TURNSTILE_SECRET_KEY is set in the environment, this check becomes mandatory.
    return true;
  }
  if(!token) return false;
  try{
    const resp = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret: process.env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: remoteIp || "",
      }),
    });
    const data = await resp.json();
    return !!data.success;
  } catch(e){
    console.error("Turnstile verification failed:", e);
    return false;
  }
}

module.exports = function(pool){
  const router = express.Router();

  router.post("/register", registerLimiter, async (req, res) => {
    const { username, password, turnstileToken, website, ageConfirmed } = req.body || {};

    // Honeypot: real users never fill this hidden field in. Bots often do.
    if(website){
      return res.status(400).json({ error: "Registration failed" });
    }

    if(!username || !USERNAME_RE.test(username)){
      return res.status(400).json({ error: "Username must be 3-20 characters, letters/numbers/underscore only." });
    }
    if(!password || password.length < 8){
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    // Never trust the checkbox state from the client alone — enforce it here too.
    if(ageConfirmed !== true){
      return res.status(400).json({ error: "You must confirm you are 18 or older to register." });
    }

    const okCaptcha = await verifyTurnstile(turnstileToken, req.ip);
    if(!okCaptcha){
      return res.status(400).json({ error: "Captcha verification failed. Please try again." });
    }

    const conn = await pool.getConnection();
    try{
      const [existing] = await conn.query("SELECT id FROM users WHERE username = ?", [username]);
      if(existing.length > 0){
        return res.status(400).json({ error: "That username is already taken." });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const role = (process.env.ADMIN_USERNAME && username === process.env.ADMIN_USERNAME) ? "admin" : "user";

      const [result] = await conn.query(
        "INSERT INTO users (username, password_hash, role, age_confirmed, age_confirmed_at) VALUES (?, ?, ?, 1, NOW())",
        [username, passwordHash, role]
      );
      await conn.query("INSERT INTO user_memory (user_id) VALUES (?)", [result.insertId]);

      req.session.user = { id: result.insertId, username, role };
      res.json({ ok: true, user: req.session.user });
    } catch(err){
      console.error(err);
      res.status(500).json({ error: "Registration failed, please try again." });
    } finally{
      conn.release();
    }
  });

  router.post("/login", loginLimiter, async (req, res) => {
    const { username, password, turnstileToken } = req.body || {};
    if(!username || !password){
      return res.status(400).json({ error: "Username and password required." });
    }

    const okCaptcha = await verifyTurnstile(turnstileToken, req.ip);
    if(!okCaptcha){
      return res.status(400).json({ error: "Captcha verification failed. Please try again." });
    }

    try{
      const [rows] = await pool.query(
        "SELECT id, username, password_hash, role FROM users WHERE username = ?",
        [username]
      );
      if(rows.length === 0){
        return res.status(401).json({ error: "Incorrect username or password." });
      }
      const user = rows[0];
      const match = await bcrypt.compare(password, user.password_hash);
      if(!match){
        return res.status(401).json({ error: "Incorrect username or password." });
      }

      await pool.query("UPDATE users SET last_active_at = NOW() WHERE id = ?", [user.id]);
      req.session.user = { id: user.id, username: user.username, role: user.role };
      res.json({ ok: true, user: req.session.user });
    } catch(err){
      console.error(err);
      res.status(500).json({ error: "Login failed, please try again." });
    }
  });

  router.post("/logout", (req, res) => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  router.get("/me", (req, res) => {
    res.json({ user: req.session.user || null });
  });

  return router;
};
