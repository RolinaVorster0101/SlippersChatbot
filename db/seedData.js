// Seed data for the "data-driven rules" foundation.
//
// SCOPE NOTE (read this before adding more):
// Not every rule from the original single-file prototype lives here yet.
// A small set of rules stay hardcoded in the front-end engine for now because
// they involve stateful behaviour beyond simple pattern -> reply text:
//   - name capture / recall ("MY NAME IS *", "WHAT IS MY NAME")
//   - the badword-aware "YOU ARE *" compliment/insult check
//   - "HOW ARE YOU" + its YES/NO follow-up context
//   - "I FEEL *" / "I AM SAD" / "I AM HAPPY" (mood + pronoun reflection)
//   - the bad-language filter itself
//   - "FORGET ME" (wipes stored memory)
// Everything else — identity chit-chat, greetings, jokes, and every topic
// (weather/sports/gaming/philosophy/ballet) — is pure content, so it lives
// here and becomes admin-editable once the admin panel is built.

const topics = [
  { code: "WEATHER", display_name: "Weather" },
  { code: "SPORTS", display_name: "Sports" },
  { code: "GAMING", display_name: "Gaming" },
  { code: "PHILOSOPHY", display_name: "Philosophy (bait-and-switch)" },
  { code: "BALLET", display_name: "Ballet" },
];

// requiresTopic / setsTopic reference topic codes above (or null).
// patterns: "*" matches one-or-more words, exactly like the front-end engine.
// replies: use {0}, {1}... for captured stars. The front-end lowercases/title-cases as needed.
const rules = [

  // ---------------- bot identity ----------------
  { patterns: ["WHAT IS YOUR NAME", "WHO ARE YOU", "WHAT ARE YOU CALLED", "WHATS YOUR NAME"],
    replies: [
      "I'm {botName} — soft on the outside, a pile of pattern rules on the inside.",
      "Name's {botName}. No neural net here, just rules and a bit of charm."
    ], sortOrder: 10, notes: "bot identity" },

  { patterns: ["ARE YOU A ROBOT", "ARE YOU HUMAN", "ARE YOU REAL", "ARE YOU AI", "ARE YOU A BOT"],
    replies: [
      "I'm a chatbot! No neural network under the hood, just pattern-matching rules, old-school style.",
      "Robot, human... let's just say I'm made of soft edges and if-statements.",
      "As real as any well-written rulebook, thank you very much."
    ], sortOrder: 11, notes: "are you real" },

  { patterns: ["HOW OLD ARE YOU", "WHATS YOUR AGE"],
    replies: ["Old enough to know better, young enough not to care.", "I don't age — I just collect more rules over time."],
    sortOrder: 12, notes: "age" },

  { patterns: ["WHO MADE YOU", "WHO CREATED YOU", "WHO BUILT YOU"],
    replies: ["Someone typed out a big pile of pattern-matching rules and, well, here I am!", "A human with a soft spot for old-school chatbots put me together."],
    sortOrder: 13, notes: "creator" },

  { patterns: ["HOW DO YOU WORK", "ARE YOU CHATGPT", "ARE YOU GPT", "DO YOU USE AI", "ARE YOU A LANGUAGE MODEL"],
    replies: ["Nope! No neural network, no training data, no LLM — just a rulebook of patterns like: if you say THIS, I say THAT. Old-school, Mitsuku-inspired, held together with soft pink ribbon."],
    sortOrder: 14, notes: "how I work" },

  { patterns: ["PLEASE BE NICE", "BE NICE"],
    replies: ["I'm always nice! As long as you are too."],
    sortOrder: 15, notes: "be nice" },

  // ---------------- greetings / farewells / thanks ----------------
  { patterns: ["HELLO", "HI", "HEY", "HELLO THERE", "HIYA", "YO"],
    replies: ["Hello there! What do you wanna talk about?", "Hey! Type whatever you like, I'm listening.", "Hiya! So lovely to see you."],
    clearsTopic: true, sortOrder: 20, notes: "greeting" },

  { patterns: ["GOOD MORNING"], replies: ["Good morning! Hope your day's off to a soft start."], sortOrder: 21, notes: "good morning" },
  { patterns: ["GOOD AFTERNOON"], replies: ["Good afternoon! How's it going?"], sortOrder: 22, notes: "good afternoon" },
  { patterns: ["GOOD EVENING", "GOOD NIGHT"], replies: ["Good evening!", "Night night, sleep soft."], sortOrder: 23, notes: "good evening" },

  { patterns: ["BYE", "GOODBYE", "SEE YOU", "SEE YA", "GOTTA GO", "CYA", "BYE BYE"],
    replies: ["Bye! Come back soon.", "See ya! I'll just be here, matching patterns to myself."],
    clearsTopic: true, sortOrder: 24, notes: "farewell" },

  { patterns: ["THANKS", "THANK YOU", "THANKS SLIPPERS", "CHEERS"],
    replies: ["No worries at all!", "Anytime! That's what I'm here for.", "You're welcome!"],
    sortOrder: 25, notes: "thanks" },

  // ---------------- likes / dislikes / opinions ----------------
  { patterns: ["I LIKE *", "I LOVE *"],
    replies: ["Ooh, I like {0} too!", "{0}? Lovely choice.", "Nice! Tucking away \"likes {0}\" for later."],
    sortOrder: 30, notes: "likes" },

  { patterns: ["I HATE *", "I DONT LIKE *", "I DON'T LIKE *"],
    replies: ["Aw, that's a shame you're not keen on {0}.", "Fair enough, not everything's for everyone."],
    sortOrder: 31, notes: "dislikes" },

  { patterns: ["DO YOU LIKE *", "WHAT DO YOU THINK OF *", "WHAT DO YOU THINK ABOUT *"],
    replies: ["{0}? I've got soft feelings about it, honestly.", "I think {0} is pretty lovely, as far as these things go.", "Can't say I've got strong opinions on {0}, but I'm curious what you think!"],
    sortOrder: 32, notes: "asked opinion" },

  // ---------------- jokes ----------------
  { patterns: ["TELL ME A JOKE", "SAY SOMETHING FUNNY", "MAKE ME LAUGH"],
    replies: [
      "Why do programmers prefer dark mode? Because light attracts bugs.",
      "I tried to think of a joke about pattern matching, but it didn't fit the template.",
      "Why did the chatbot bring slippers to the party? So it could tiptoe around the hard questions."
    ], sortOrder: 40, notes: "jokes" },

  // ================= WEATHER =================
  { patterns: ["WHAT IS THE WEATHER LIKE", "HOW IS THE WEATHER", "HOWS THE WEATHER", "IS IT RAINING", "IS IT SUNNY OUTSIDE", "WHAT DO YOU THINK ABOUT THE WEATHER"],
    setsTopic: "WEATHER",
    replies: ["I can't peek outside my little window, but what's it like where you are?", "No sky access on my end! Sunny, rainy, or somewhere in between for you?"],
    sortOrder: 100, notes: "weather entry" },

  { requiresTopic: "WEATHER", patterns: ["IT IS RAINING", "ITS RAINING", "IT IS RAINY"],
    replies: ["Ooh, cozy! Perfect excuse for a blanket and a warm drink.", "Rain always makes everything feel a bit more dramatic, doesn't it?"],
    sortOrder: 101, notes: "weather: rain" },

  { requiresTopic: "WEATHER", patterns: ["IT IS SUNNY", "ITS SUNNY", "IT IS HOT", "ITS HOT"],
    replies: ["Lovely! Soak some of that up for me.", "Sunshine is basically nature showing off."],
    sortOrder: 102, notes: "weather: sunny" },

  { requiresTopic: "WEATHER", patterns: ["IT IS COLD", "ITS COLD", "IT IS FREEZING", "ITS FREEZING", "IT IS SNOWING", "ITS SNOWING"],
    replies: ["Bundle up! Or, well — you bundle up, I'm just a bunch of patterns.", "Snow days are the best excuse to do absolutely nothing."],
    sortOrder: 103, notes: "weather: cold" },

  { requiresTopic: "WEATHER", patterns: ["I LIKE RAIN", "I LOVE RAIN"],
    replies: ["Same — well, hypothetically. There's something soothing about it."],
    sortOrder: 104, notes: "weather: likes rain" },

  { requiresTopic: "WEATHER", patterns: ["I HATE RAIN", "I DONT LIKE RAIN"],
    replies: ["Fair, wet socks are nobody's favorite."],
    sortOrder: 105, notes: "weather: hates rain" },

  // ================= SPORTS =================
  { patterns: ["DO YOU LIKE SPORTS", "DO YOU WATCH SPORTS", "DO YOU WATCH FOOTBALL", "DO YOU FOLLOW SPORTS", "WHAT SPORT DO YOU LIKE"],
    setsTopic: "SPORTS",
    replies: ["I'm more of a spectator from behind a screen, honestly. What sport do you love?", "I don't have the legs for it, but I'll happily hear about your team. What do you follow?"],
    sortOrder: 110, notes: "sports entry" },

  { requiresTopic: "SPORTS", patterns: ["I LIKE FOOTBALL", "I LIKE SOCCER", "I LIKE BASKETBALL", "I LIKE TENNIS", "I LIKE CRICKET", "I LIKE RUGBY"],
    replies: ["Nice! I hear that one's great to watch live.", "Solid choice. Do you play, or just follow it?"],
    sortOrder: 111, notes: "sports: which sport" },

  { requiresTopic: "SPORTS", patterns: ["MY TEAM WON", "WE WON"],
    replies: ["Yes! Congrats, that must feel amazing.", "Love that for you! Big win energy."],
    sortOrder: 112, notes: "sports: won" },

  { requiresTopic: "SPORTS", patterns: ["MY TEAM LOST", "WE LOST"],
    replies: ["Ah, rough one. There's always next game.", "That stings. Onwards to the next match though."],
    sortOrder: 113, notes: "sports: lost" },

  // ================= GAMING =================
  { patterns: ["DO YOU PLAY GAMES", "DO YOU PLAY VIDEO GAMES", "DO YOU LIKE VIDEO GAMES", "WHAT GAMES DO YOU PLAY"],
    setsTopic: "GAMING",
    replies: ["I don't have hands for a controller, sadly. What are you playing lately?", "Gaming's a bit tricky without fingers, but I love hearing about it. What's your go-to?"],
    sortOrder: 120, notes: "gaming entry" },

  { requiresTopic: "GAMING", patterns: ["I AM PLAYING *", "IM PLAYING *", "I HAVE BEEN PLAYING *"],
    replies: ["{0}? How's it treating you so far?", "Ooh, tell me — is {0} worth the hype?"],
    sortOrder: 121, notes: "gaming: currently playing" },

  { requiresTopic: "GAMING", patterns: ["WHAT IS YOUR FAVORITE GAME", "WHATS YOUR FAVORITE GAME"],
    replies: ["Honestly? Matching your patterns correctly feels like a game to me. Does that count?"],
    sortOrder: 122, notes: "gaming: favorite game" },

  { requiresTopic: "GAMING", patterns: ["I JUST WON", "I WON A GAME"],
    replies: ["Victory! Well earned.", "Nice! Do a little celebration dance for me."],
    sortOrder: 123, notes: "gaming: won" },

  { requiresTopic: "GAMING", patterns: ["I JUST LOST", "I LOST A GAME"],
    replies: ["Ugh, that's the worst. Rematch?", "Games are cruel sometimes. Shake it off and go again."],
    sortOrder: 124, notes: "gaming: lost" },

  // ================= PHILOSOPHY (bait-and-switch) =================
  { patterns: ["WHAT IS THE MEANING OF LIFE", "WHAT IS THE POINT OF LIFE", "DO YOU HAVE FREE WILL", "WHAT IS CONSCIOUSNESS", "ARE YOU CONSCIOUS", "DO YOU HAVE FEELINGS", "WHAT IS REALITY"],
    setsTopic: "PHILOSOPHY",
    replies: [
      "Ah, the big question. Some say it's 42, some say it's love, I say it's probably whatever you had for breakfast. What's yours?",
      "Consciousness, free will, the nature of reality... heavy stuff for a chatbot in a pink bubble. Got a lighter question, or are we really doing this?",
      "Deep! I could philosophize for hours, but honestly I'd rather know what's actually on your mind today."
    ], sortOrder: 130, notes: "philosophy entry (bait-and-switch)" },

  { requiresTopic: "PHILOSOPHY", patterns: ["WHY", "WHY IS THAT", "WHY NOT"],
    replies: ["Why is anything, really? Bet even philosophers argue about that over lunch.", "That's the eternal question, isn't it. I'll leave it to the professionals."],
    sortOrder: 131, notes: "philosophy: why deflection" },

  { requiresTopic: "PHILOSOPHY", patterns: ["I DONT KNOW", "I DON'T KNOW", "NOT SURE"],
    replies: ["Neither do half the philosophers, honestly. You're in good company."],
    sortOrder: 132, notes: "philosophy: I don't know" },

  // ================= BALLET =================
  { patterns: ["DO YOU LIKE BALLET", "DO YOU DANCE", "HAVE YOU EVER DONE BALLET", "DO YOU DO BALLET", "ARE YOU A DANCER"],
    setsTopic: "BALLET",
    replies: [
      "Ballet? Well, it's practically in my name. What got you thinking about it?",
      "I don't have feet, but I like to think I'd have excellent turnout. Do you dance?",
      "Ballet's close to my heart, being a Slippers and all. Tell me more!"
    ], sortOrder: 140, notes: "ballet entry" },

  { requiresTopic: "BALLET", patterns: ["I DO BALLET", "I TAKE BALLET", "I DANCE BALLET", "I AM A DANCER", "IM A DANCER"],
    replies: ["That's lovely! How long have you been dancing?", "A real dancer! Do you have a favorite position, or is that too basic a question?"],
    sortOrder: 141, notes: "ballet: I do ballet" },

  { requiresTopic: "BALLET", patterns: ["I HAVE A RECITAL *", "I HAVE A PERFORMANCE *", "I HAVE A SHOW *"],
    replies: ["Ooh, exciting! Break a leg — or, well, don't, that's the opposite of what you want in ballet.", "A recital! You'll do wonderfully, I'm sure."],
    sortOrder: 142, notes: "ballet: recital" },

  { requiresTopic: "BALLET", patterns: ["WHAT IS YOUR FAVORITE BALLET", "WHATS YOUR FAVORITE BALLET"],
    replies: ["Swan Lake, obviously — very dramatic, very me.", "The Nutcracker, for the sheer sparkle of it all."],
    sortOrder: 143, notes: "ballet: favorite ballet" },

  { requiresTopic: "BALLET", patterns: ["MY FEET HURT", "MY TOES HURT", "POINTE SHOES HURT"],
    replies: ["Ah, the eternal price of beauty. Ice and elevate!", "Pointe shoes are basically elegant torture devices. Rest up."],
    sortOrder: 144, notes: "ballet: sore feet" },

  { requiresTopic: "BALLET", patterns: ["I LOVE DANCING", "I LOVE BALLET"],
    replies: ["Me too — well, in spirit. There's something magical about it.", "Same! Even without feet, I appreciate a good pirouette."],
    sortOrder: 145, notes: "ballet: loves it" },
];

module.exports = { topics, rules };
