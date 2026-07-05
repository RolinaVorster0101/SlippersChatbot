// These rules are inserted separately from the main topic seed, and — unlike
// everything else — are checked for individually by special_key on every boot
// (see ensureSpecialRulesSeeded in app.js), so they get added automatically
// even to databases that were seeded before this feature existed.
//
// Patterns, replies, sort order, enabled/disabled, and notes are all
// admin-editable exactly like any other rule. The special_key itself is not
// exposed for editing in the admin panel — it's what tells the chat engine
// which fixed bit of code to run (store a name, adjust mood, reflect
// pronouns, wipe memory) once one of these matches.

const specialRuleSeeds = [
  {
    specialKey: "CAPTURE_NAME",
    patterns: ["MY NAME IS *", "CALL ME *", "I'M CALLED *", "IM CALLED *"],
    replies: [
      "Ooh, {name}! What a lovely name, I'll keep it safe.",
      "Nice to meet you, {name}! I'm {botName}.",
      "{name}... tucked away in my little rulebook forever."
    ],
    sortOrder: 1,
    notes: "capture name (stores the captured word, then uses {name} in the reply)",
  },
  {
    specialKey: "RECALL_NAME",
    patterns: ["WHAT IS MY NAME", "DO YOU KNOW MY NAME", "WHATS MY NAME"],
    replies: [
      "You're {name}! Did you forget already, silly?",
      "Your name's {name}. I never forget a name."
    ],
    repliesAlt: [
      "You haven't told me your name yet! What is it?",
      "No idea yet! Go on, tell me."
    ],
    sortOrder: 2,
    notes: "recall name (replies used if known, alt replies used if not)",
  },
  {
    specialKey: "MOOD_UP",
    patterns: ["YOU ARE *", "YOURE *", "YOU'RE *"],
    replies: [
      "Aw, you think I'm {0}? That's sweet of you.",
      "Takes one to know one — you're pretty {0} yourself."
    ],
    sortOrder: 3,
    notes: "compliment (raises mood by one)",
  },
  {
    specialKey: "MOOD_UP",
    patterns: ["I AM HAPPY", "IM HAPPY", "I FEEL HAPPY", "I AM GLAD"],
    replies: ["Yay, that makes me happy too!", "Love that energy!"],
    sortOrder: 4,
    notes: "user is happy (raises mood by one)",
  },
  {
    specialKey: "HOW_ARE_YOU",
    patterns: ["HOW ARE YOU", "HOW ARE YOU DOING", "HOW ARE YOU FEELING", "HOWS IT GOING"],
    replies: ["I'm feeling {mood}, thanks for asking! How about you?"],
    sortOrder: 5,
    notes: "reads back her current mood word, sets context for a yes/no follow-up",
  },
  {
    specialKey: "FEELINGS_REFLECT",
    patterns: ["I FEEL *", "I AM FEELING *", "IM FEELING *"],
    replies: [
      "Why do you feel {0}?",
      "That's interesting that {reflect0} feel that way. Tell me more.",
      "Feeling {0}, huh? What brought that on?"
    ],
    sortOrder: 6,
    notes: "ELIZA-style pronoun reflection ({reflect0} swaps I/you, my/your, etc.)",
  },
  {
    specialKey: "SAD_CONTEXT",
    patterns: ["I AM SAD", "IM SAD", "I FEEL SAD"],
    replies: ["Aw, I'm sorry to hear that. Want to talk about it?", "That's no good. What happened?"],
    sortOrder: 7,
    notes: "sets context for a yes/no follow-up",
  },
  {
    specialKey: "FORGET_ME",
    patterns: ["FORGET ME", "FORGET EVERYTHING", "CLEAR MY DATA", "RESET MEMORY", "FORGET MY NAME"],
    replies: ["Poof — all forgotten! Clean slate. What's your name?"],
    sortOrder: 8,
    notes: "wipes stored name/mood/topic",
  },
];

module.exports = { specialRuleSeeds };
