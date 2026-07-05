/* =========================================================
   SLIPPERS — a tiny AIML-style pattern-matching chatbot engine
   No ML. No LLM. Just: normalize -> match pattern -> pick a
   template -> maybe reflect pronouns -> respond.

   Rules come from two places:
   1. dbRules  — fetched from /api/rules (content: identity chit-chat,
      greetings, jokes, and every topic). Admin-editable once that panel exists.
   2. specialRules — a small hardcoded set here, for behaviour that needs
      real state: name memory, mood, pronoun reflection, bad-language checks.
   ========================================================= */

const mem = {
  name: null,
  botName: "Slippers",
  mood: 0,
  lastTopic: null,
  topic: null,
  history: []
};

function normalize(s){
  return s
    .toUpperCase()
    .replace(/['’]/g, "'")
    .replace(/[^A-Z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const reflections = {
  "I":"YOU","ME":"YOU","MY":"YOUR","MINE":"YOURS","AM":"ARE",
  "YOU":"I","YOUR":"MY","YOURS":"MINE","ARE":"AM",
  "MYSELF":"YOURSELF","YOURSELF":"MYSELF"
};
function reflect(text){
  return text.split(" ").map(w => reflections[w] || w).join(" ").toLowerCase();
}
function titleCase(s){
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function compilePattern(p){
  const escaped = p
    .split(" ")
    .map(tok => tok === "*" ? "(.+?)" : tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  return new RegExp("^" + escaped + "$");
}

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

function moodWord(){
  if(mem.mood <= -2) return "a little sulky";
  if(mem.mood === -1) return "a bit out of sorts";
  if(mem.mood === 0) return "soft and sweet";
  if(mem.mood === 1) return "cheerful";
  return "practically glowing";
}

const badWords = ["FUCK","SHIT","BITCH","ASSHOLE","CUNT","DAMN YOU","STUPID BOT"];

// fills {0}, {1}... with captured stars (lowercased) and {botName} with her name
function fillTemplate(template, stars){
  let out = template.replace(/\{botName\}/g, mem.botName);
  stars.forEach((s, i) => { out = out.split(`{${i}}`).join(s.toLowerCase()); });
  return out;
}

// ---------- special, stateful rules (stay in code) ----------
const specialRules = [
  { patterns:["MY NAME IS *","CALL ME *","I'M CALLED *","IM CALLED *"],
    reply:(s)=>{ mem.name = titleCase(s[0].toLowerCase()); mem.mood++;
      return pick([
        `Ooh, ${mem.name}! What a lovely name, I'll keep it safe.`,
        `Nice to meet you, ${mem.name}! I'm ${mem.botName}.`,
        `${mem.name}... tucked away in my little rulebook forever.`
      ]);
    }},
  { patterns:["WHAT IS MY NAME","DO YOU KNOW MY NAME","WHATS MY NAME"],
    reply:()=> mem.name
      ? pick([`You're ${mem.name}! Did you forget already, silly?`, `Your name's ${mem.name}. I never forget a name.`])
      : pick(["You haven't told me your name yet! What is it?", "No idea yet! Go on, tell me."]) },

  { patterns:["YOU ARE *","YOURE *","YOU'RE *"],
    reply:(s)=>{
      const word = s[0].toUpperCase();
      if(badWords.some(b=>word.includes(b))){
        mem.mood--;
        return pick(["Hey now, that's not very nice. Let's keep it soft and clean, yeah?", "Ouch — I don't love bad language."]);
      }
      mem.mood++;
      return pick([`Aw, you think I'm ${s[0].toLowerCase()}? That's sweet of you.`, `Takes one to know one — you're pretty ${s[0].toLowerCase()} yourself.`]);
    }},

  { patterns:["HOW ARE YOU","HOW ARE YOU DOING","HOW ARE YOU FEELING","HOWS IT GOING"],
    reply:()=>{ mem.lastTopic="askedfeeling"; return `I'm feeling ${moodWord()}, thanks for asking! How about you?`; }},

  { patterns:["I FEEL *","I AM FEELING *","IM FEELING *"],
    reply:(s)=>{ mem.lastTopic="feelings"; return pick([
      `Why do you feel ${s[0].toLowerCase()}?`,
      `That's interesting that ${reflect(s[0])} feel that way. Tell me more.`,
      `Feeling ${s[0].toLowerCase()}, huh? What brought that on?`
    ]);}},
  { patterns:["I AM SAD","IM SAD","I FEEL SAD"],
    reply:()=>{ mem.lastTopic="sad"; return pick(["Aw, I'm sorry to hear that. Want to talk about it?", "That's no good. What happened?"]); }},
  { patterns:["I AM HAPPY","IM HAPPY","I FEEL HAPPY","I AM GLAD"],
    reply:()=>{ mem.mood++; return pick(["Yay, that makes me happy too!", "Love that energy!"]); }},

  { patterns:["YES","YEAH","YEP","YUP"],
    reply:()=>{
      if(mem.lastTopic==="askedfeeling") return "Glad to hear it!";
      if(mem.lastTopic==="sad") return "I'm glad talking helped a little.";
      return pick(["Good to know!", "Cool, cool."]);
    }},
  { patterns:["NO","NOPE","NAH"],
    reply:()=>{
      if(mem.lastTopic==="askedfeeling") return "Oh no, sorry to hear that. Anything I can do?";
      return pick(["Alright, fair enough.", "No worries either way."]);
    }},

  { patterns:["FORGET ME","FORGET EVERYTHING","CLEAR MY DATA","RESET MEMORY","FORGET MY NAME"],
    reply:()=>{
      mem.name = null; mem.mood = 0; mem.topic = null; mem.lastTopic = null;
      clearSavedMemory();
      return "Poof — all forgotten! Clean slate. What's your name?";
    }},
];
specialRules.forEach(r => r.compiled = r.patterns.map(compilePattern));

// ---------- DB-driven rules, fetched at startup ----------
let dbRules = [];

async function loadDbRules(){
  const res = await fetch("/api/rules");
  if(!res.ok) throw new Error("Failed to load rules: " + res.status);
  const rows = await res.json();
  dbRules = rows.map(row => ({
    ...row,
    compiled: row.patterns.map(compilePattern)
  }));
}

const fallbacks = [
  "Hmm, I don't have a pattern for that one. Can you say it differently?",
  "I'm just a rulebook, not a mind-reader — try rephrasing that?",
  "Not sure I follow! What else is on your mind?",
  "That one's outside my rulebook. Tell me something else?",
  "Interesting... but I don't quite have a response coded for that yet."
];

function badLanguageCheck(norm){
  return badWords.some(w => norm.includes(w));
}

function respond(raw){
  const norm = normalize(raw);
  if(norm === "") return "Say something, I'm listening!";

  if(badLanguageCheck(norm)){
    mem.mood -= 2;
    return pick(["Hey! Let's keep it soft and clean, please.", "Whoa, let's keep it polite please."]);
  }

  // special stateful rules take priority
  for(const rule of specialRules){
    for(const re of rule.compiled){
      const m = norm.match(re);
      if(m) return rule.reply(m.slice(1));
    }
  }

  // then DB-driven content rules, respecting topic state.
  // Two layers of priority, both existing to make specific rules win over vague ones:
  //  1. Topic-scoped rules (requiresTopic matches the active topic) before generic ones —
  //     otherwise a generic "I LOVE *" could grab a message before a specific
  //     in-topic follow-up like "I LOVE DANCING" (under BALLET) ever gets a chance.
  //  2. Within each of those groups, exact-phrase rules (no "*") before wildcard
  //     rules — otherwise a generic "DO YOU LIKE *" could grab "DO YOU LIKE BALLET"
  //     before the specific, no-wildcard ballet-entry rule ever gets a chance.
  function hasWildcard(rule){
    return rule.patterns.some(p => p.includes("*"));
  }
  function bySpecificity(list){
    return [...list.filter(r => !hasWildcard(r)), ...list.filter(r => hasWildcard(r))];
  }

  const topicScoped = dbRules.filter(r => r.requiresTopic && r.requiresTopic === mem.topic);
  const generic = dbRules.filter(r => !r.requiresTopic);
  const orderedRules = [...bySpecificity(topicScoped), ...bySpecificity(generic)];

  for(const rule of orderedRules){
    for(const re of rule.compiled){
      const m = norm.match(re);
      if(m){
        const stars = m.slice(1);
        const reply = fillTemplate(pick(rule.replies), stars);
        if(rule.setsTopic) mem.topic = rule.setsTopic;
        if(rule.clearsTopic) mem.topic = null;
        return reply;
      }
    }
  }

  return pick(fallbacks);
}

const logEl = document.getElementById("log");
const inputEl = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const lastMsgEl = document.getElementById("lastMsg");
const statusText = document.getElementById("statusText");
const mouthPath = document.getElementById("mouthPath");
const mouthTypingOverlay = document.getElementById("mouthTypingOverlay");
const pupilGroupL = document.getElementById("pupilGroupL");
const pupilGroupR = document.getElementById("pupilGroupR");
const eyeLOpen = document.getElementById("eyeLOpen");
const eyeLClosed = document.getElementById("eyeLClosed");
const eyeROpen = document.getElementById("eyeROpen");
const eyeRClosed = document.getElementById("eyeRClosed");
const faceGroup = document.getElementById("faceGroup");
const shoulderGroup = document.getElementById("shoulderGroup");
const ruleCountEl = document.getElementById("ruleCount");

// ---------- face animation: pupils glance around, head tilts gently ----------
let eyesBusy = false;

function glanceAround(){
  const dx = (Math.random()*4.4 - 2.2).toFixed(1);
  const dy = (Math.random()*2.6 - 1.3).toFixed(1);
  const rot = (Math.random()*3 - 1.5).toFixed(1);
  const gaze = `translate(${dx}px, ${dy}px)`;
  pupilGroupL.style.transform = gaze;
  pupilGroupR.style.transform = gaze;
  faceGroup.style.transform = `rotate(${rot}deg)`;
  setTimeout(()=>{
    pupilGroupL.style.transform = "translate(0,0)";
    pupilGroupR.style.transform = "translate(0,0)";
    faceGroup.style.transform = "rotate(0deg)";
  }, 1000);
}
function scheduleGlance(){
  if(!eyesBusy) glanceAround();
  setTimeout(scheduleGlance, 2800 + Math.random()*3200);
}
scheduleGlance();

// ---------- blink ----------
let lastBlinkAt = 0;
function blink(){
  if(eyesBusy) return;
  eyesBusy = true;
  lastBlinkAt = Date.now();
  eyeLOpen.style.opacity = "0"; eyeLClosed.style.opacity = "1";
  eyeROpen.style.opacity = "0"; eyeRClosed.style.opacity = "1";
  setTimeout(()=>{
    eyeLOpen.style.opacity = "1"; eyeLClosed.style.opacity = "0";
    eyeROpen.style.opacity = "1"; eyeRClosed.style.opacity = "0";
    eyesBusy = false;
  }, 130);
}
function scheduleBlink(){
  setTimeout(()=>{ blink(); scheduleBlink(); }, 3200 + Math.random()*4000);
}
scheduleBlink();

// ---------- wink ----------
const WINK_BLINK_COOLDOWN = 1800;
function wink(){
  if(eyesBusy) return;
  if(Date.now() - lastBlinkAt < WINK_BLINK_COOLDOWN) return;
  eyesBusy = true;
  const isLeft = Math.random() < 0.5;
  const open = isLeft ? eyeLOpen : eyeROpen;
  const closed = isLeft ? eyeLClosed : eyeRClosed;
  open.style.opacity = "0";
  closed.style.opacity = "1";
  faceGroup.style.transform = `rotate(${isLeft ? -4 : 4}deg)`;
  setTimeout(()=>{
    open.style.opacity = "1";
    closed.style.opacity = "0";
    faceGroup.style.transform = "rotate(0deg)";
    eyesBusy = false;
  }, 280);
}

// ---------- laugh ----------
const LOL_REGEX = /\b(lol+|ha(ha)+h?a?|lmao|lmfao)\b/i;

const moodMouths = {
  "-2": "M54 70 Q60 66.5 66 70",
  "-1": "M54 69 Q60 68 66 69",
  "0":  "M54 68 Q60 71.5 66 68",
  "1":  "M53.5 67.5 Q60 72.5 66.5 67.5",
  "2":  "M53 67 Q60 73.5 67 67"
};

function laugh(){
  eyesBusy = true;
  eyeLOpen.style.opacity = "0"; eyeLClosed.style.opacity = "1";
  eyeROpen.style.opacity = "0"; eyeRClosed.style.opacity = "1";
  const prevMouth = mouthPath.getAttribute("d");
  mouthPath.setAttribute("d", moodMouths["2"]);
  faceGroup.classList.add("laughing-head");
  shoulderGroup.classList.add("laughing-shoulders");
  setTimeout(()=>{
    eyeLOpen.style.opacity = "1"; eyeLClosed.style.opacity = "0";
    eyeROpen.style.opacity = "1"; eyeRClosed.style.opacity = "0";
    mouthPath.setAttribute("d", prevMouth);
    faceGroup.classList.remove("laughing-head");
    shoulderGroup.classList.remove("laughing-shoulders");
    faceGroup.style.transform = "rotate(0deg)";
    eyesBusy = false;
  }, 1150);
}

function updateMood(){
  const key = String(Math.max(-2, Math.min(2, mem.mood)));
  mouthPath.setAttribute("d", moodMouths[key]);
}

inputEl.addEventListener("input", ()=>{
  mouthTypingOverlay.style.opacity = inputEl.value.trim().length > 0 ? "1" : "0";
});
inputEl.addEventListener("blur", ()=>{
  mouthTypingOverlay.style.opacity = "0";
});

function addLine(who, text){
  const wrap = document.createElement("div");
  wrap.className = "msg " + (who === "Slippers" ? "bot" : "user");
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  wrap.appendChild(bubble);
  logEl.appendChild(wrap);
  logEl.scrollTop = logEl.scrollHeight;
  mem.history.push({who, text});
}

function showTyping(){
  const wrap = document.createElement("div");
  wrap.className = "msg bot";
  wrap.id = "typingIndicator";
  const bubble = document.createElement("div");
  bubble.className = "bubble typing-bubble";
  bubble.innerHTML = '<span class="tdot"></span><span class="tdot"></span><span class="tdot"></span>';
  wrap.appendChild(bubble);
  logEl.appendChild(wrap);
  logEl.scrollTop = logEl.scrollHeight;
  return wrap;
}

function sendMessage(){
  const text = inputEl.value.trim();
  if(!text) return;
  addLine(mem.name || "You", text);
  lastMsgEl.textContent = text;
  if(LOL_REGEX.test(text)){
    setTimeout(laugh, 150);
  }
  const reply = respond(text);
  const typingEl = showTyping();
  const delay = 3600 + Math.random()*800;
  setTimeout(()=>{
    typingEl.remove();
    addLine("Slippers", reply);
    updateMood();
    saveMemory();
    if(Math.random() < 0.4){
      setTimeout(wink, 350 + Math.random()*300);
    }
  }, delay);
  inputEl.value = "";
  inputEl.focus();
}

sendBtn.addEventListener("click", sendMessage);
inputEl.addEventListener("keydown", e => { if(e.key === "Enter") sendMessage(); });

const modal = document.getElementById("logModal");
document.getElementById("openLog").addEventListener("click", ()=>{
  const content = document.getElementById("modalContent");
  content.innerHTML = mem.history.length
    ? mem.history.map(h=>`<div><b>${h.who}:</b> ${h.text}</div>`).join("")
    : "<i>No chatlog yet — say hello first!</i>";
  modal.style.display = "flex";
});
document.getElementById("closeModal").addEventListener("click", ()=> modal.style.display = "none");

// ---------- persistence: per-account memory via /api/memory ----------
async function loadSavedMemory(){
  try{
    const res = await fetch("/api/memory");
    if(!res.ok) return;
    const data = await res.json();
    if(data.name) mem.name = data.name;
    if(typeof data.mood === "number") mem.mood = data.mood;
    if(data.topic) mem.topic = data.topic;
  } catch(e){ /* no saved memory yet */ }
}

async function saveMemory(){
  try{
    await fetch("/api/memory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mem.name, mood: mem.mood, topic: mem.topic }),
    });
  } catch(e){ console.error("Slippers couldn't save memory:", e); }
}

function clearSavedMemory(){
  fetch("/api/memory", { method: "DELETE" }).catch(()=>{});
}

document.getElementById("logoutLink").addEventListener("click", async (e) => {
  e.preventDefault();
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
});

(async function init(){
  try{
    const meRes = await fetch("/api/auth/me");
    const meData = await meRes.json();
    if(!meData.user){
      window.location.href = "/login.html";
      return;
    }
    document.getElementById("whoText").textContent = "logged in as " + meData.user.username;
    document.getElementById("whoRow").style.display = "flex";

    await loadDbRules();
    await loadSavedMemory();

    ruleCountEl.textContent = "patterns: " + (
      dbRules.reduce((n,r)=>n+r.patterns.length,0) +
      specialRules.reduce((n,r)=>n+r.patterns.length,0)
    );
    statusText.textContent = "online & listening";
    inputEl.disabled = false;
    sendBtn.disabled = false;

    if(mem.name){
      addLine("Slippers", `Welcome back, ${mem.name}! Good to see you again.`);
      addLine("Slippers", "Pick up right where we left off, or tell me something new.");
    } else {
      addLine("Slippers", "Welcome! Wanna chat with me? What do you wanna talk about?");
      addLine("Slippers", "Just type whatever you like below and we can start chatting.");
      addLine("Slippers", "I don't think I've spoken with you before. What's your name?");
    }
    updateMood();
  } catch(err){
    console.error(err);
    statusText.textContent = "couldn't connect — check the server";
    addLine("Slippers", "Hmm, I couldn't reach my rulebook (the API). Is the server running?");
  }
})();
