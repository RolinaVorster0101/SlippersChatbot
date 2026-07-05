let topics = [];
let rules = [];
let selectedTopicId = null; // null = "General (no topic)"

const topicListEl = document.getElementById("topicList");
const generalBtn = document.getElementById("generalTopicBtn");
const rulesListEl = document.getElementById("rulesList");
const selectedTopicTitleEl = document.getElementById("selectedTopicTitle");
const template = document.getElementById("ruleCardTemplate");

async function api(path, options = {}){
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadAll(){
  topics = await api("/api/admin/topics");
  rules = await api("/api/admin/rules");
  renderSidebar();
  renderRulesPane();
}

function groupKeyFor(rule){
  if(rule.requiresTopicId != null) return rule.requiresTopicId;
  if(rule.setsTopicId != null) return rule.setsTopicId;
  return null;
}

function renderSidebar(){
  topicListEl.innerHTML = "";
  topics.forEach(t => {
    const li = document.createElement("li");
    li.className = "topicItem" + (selectedTopicId === t.id ? " active" : "");
    li.innerHTML = `<span>${t.display_name}</span>`;
    li.addEventListener("click", () => {
      selectedTopicId = t.id;
      renderSidebar();
      renderRulesPane();
    });

    const delBtn = document.createElement("button");
    delBtn.className = "deleteTopicBtn";
    delBtn.textContent = "✕";
    delBtn.title = "Delete topic";
    delBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      if(!confirm(`Delete the "${t.display_name}" topic? Rules that used it will just stop requiring/setting a topic, they won't be deleted.`)) return;
      await api(`/api/admin/topics/${t.id}`, { method: "DELETE" });
      if(selectedTopicId === t.id) selectedTopicId = null;
      await loadAll();
    });
    li.appendChild(delBtn);
    topicListEl.appendChild(li);
  });

  generalBtn.classList.toggle("active", selectedTopicId === null);
}

function buildTopicOptions(selectEl, selectedId){
  selectEl.innerHTML = '<option value="">None</option>';
  topics.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.display_name;
    if(selectedId === t.id) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function renderRulesPane(){
  const selectedTopic = topics.find(t => t.id === selectedTopicId);
  selectedTopicTitleEl.textContent = selectedTopic ? selectedTopic.display_name : "General (no topic)";

  rulesListEl.innerHTML = "";
  const filtered = rules.filter(r => groupKeyFor(r) === selectedTopicId);
  filtered.sort((a,b) => a.sortOrder - b.sortOrder);
  filtered.forEach(rule => renderRuleCard(rule));
}

function renderRuleCard(rule){
  const node = template.content.cloneNode(true);
  const card = node.querySelector(".ruleCard");

  const badgeEl = node.querySelector(".specialBadge");
  const patternsEl = node.querySelector(".rc-patterns");
  const repliesEl = node.querySelector(".rc-replies");
  const altWrap = node.querySelector(".rc-altWrap");
  const repliesAltEl = node.querySelector(".rc-repliesAlt");
  const requiresSel = node.querySelector(".rc-requiresTopic");
  const setsSel = node.querySelector(".rc-setsTopic");
  const sortOrderEl = node.querySelector(".rc-sortOrder");
  const clearsEl = node.querySelector(".rc-clearsTopic");
  const enabledEl = node.querySelector(".rc-enabled");
  const notesEl = node.querySelector(".rc-notes");
  const saveBtn = node.querySelector(".saveRuleBtn");
  const deleteBtn = node.querySelector(".deleteRuleBtn");
  const statusEl = node.querySelector(".saveStatus");

  const isNew = rule.id == null;

  if(rule.specialKey){
    badgeEl.style.display = "inline-block";
    badgeEl.textContent = "⚙ built-in behavior: " + rule.specialKey;
  }
  if(rule.specialKey === "RECALL_NAME" || (rule.repliesAlt && rule.repliesAlt.length)){
    altWrap.style.display = "block";
  }

  patternsEl.value = (rule.patterns || []).join("\n");
  repliesEl.value = (rule.replies || []).join("\n");
  repliesAltEl.value = (rule.repliesAlt || []).join("\n");
  buildTopicOptions(requiresSel, rule.requiresTopicId);
  buildTopicOptions(setsSel, rule.setsTopicId);
  sortOrderEl.value = rule.sortOrder || 0;
  clearsEl.checked = !!rule.clearsTopic;
  enabledEl.checked = rule.enabled !== false;
  notesEl.value = rule.notes || "";

  if(!enabledEl.checked) card.classList.add("disabledCard");
  enabledEl.addEventListener("change", () => card.classList.toggle("disabledCard", !enabledEl.checked));

  if(isNew){
    deleteBtn.style.display = "none";
    saveBtn.textContent = "Create rule";
  }

  saveBtn.addEventListener("click", async () => {
    const payload = {
      patterns: patternsEl.value.split("\n").map(s => s.trim()).filter(Boolean),
      replies: repliesEl.value.split("\n").map(s => s.trim()).filter(Boolean),
      repliesAlt: repliesAltEl.value.split("\n").map(s => s.trim()).filter(Boolean),
      requiresTopicId: requiresSel.value ? Number(requiresSel.value) : null,
      setsTopicId: setsSel.value ? Number(setsSel.value) : null,
      sortOrder: Number(sortOrderEl.value) || 0,
      clearsTopic: clearsEl.checked,
      enabled: enabledEl.checked,
      notes: notesEl.value.trim() || null,
    };
    if(payload.patterns.length === 0 || payload.replies.length === 0){
      statusEl.textContent = "Need at least one pattern and one reply.";
      return;
    }
    statusEl.textContent = "Saving...";
    try{
      if(isNew){
        await api("/api/admin/rules", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await api(`/api/admin/rules/${rule.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      statusEl.textContent = "Saved ✓";
      await loadAll();
    } catch(err){
      statusEl.textContent = "Error: " + err.message;
    }
  });

  if(!isNew){
    deleteBtn.addEventListener("click", async () => {
      if(!confirm("Delete this rule permanently?")) return;
      try{
        await api(`/api/admin/rules/${rule.id}`, { method: "DELETE" });
        await loadAll();
      } catch(err){
        alert(err.message);
      }
    });
  }

  rulesListEl.appendChild(node);
}

generalBtn.addEventListener("click", () => {
  selectedTopicId = null;
  renderSidebar();
  renderRulesPane();
});

document.getElementById("addTopicBtn").addEventListener("click", async () => {
  const displayName = prompt("Topic display name (e.g. \"Cooking\"):");
  if(!displayName) return;
  const code = prompt("Topic code — short, uppercase, no spaces (e.g. \"COOKING\"):", displayName.toUpperCase().replace(/[^A-Z0-9]+/g, "_"));
  if(!code) return;
  try{
    await api("/api/admin/topics", { method: "POST", body: JSON.stringify({ code, displayName }) });
    await loadAll();
  } catch(err){
    alert("Could not create topic: " + err.message);
  }
});

document.getElementById("addRuleBtn").addEventListener("click", () => {
  renderRuleCard({
    id: null,
    patterns: [],
    replies: [],
    repliesAlt: [],
    requiresTopicId: selectedTopicId,
    setsTopicId: null,
    sortOrder: 0,
    clearsTopic: false,
    enabled: true,
    notes: "",
  });
});

document.getElementById("logoutLink").addEventListener("click", async (e) => {
  e.preventDefault();
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/login.html";
});

document.getElementById("exportBtn").addEventListener("click", async () => {
  try{
    const data = await api("/api/admin/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `slippers-rules-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch(err){
    alert("Export failed: " + err.message);
  }
});

document.getElementById("importFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if(!file) return;
  try{
    const text = await file.text();
    const data = JSON.parse(text);
    const result = await api("/api/admin/import", { method: "POST", body: JSON.stringify(data) });
    alert(
      `Import complete:\n` +
      `${result.topicsAdded} topic(s) added\n` +
      `${result.rulesAdded} rule(s) added\n` +
      `${result.rulesSkippedDuplicate} skipped (already exist)\n` +
      `${result.rulesSkippedSpecial} skipped (built-in behavior rules, never imported)`
    );
    await loadAll();
  } catch(err){
    alert("Import failed: " + err.message);
  }
  e.target.value = ""; // allow re-selecting the same file later
});

(async function init(){
  const meRes = await fetch("/api/auth/me");
  const meData = await meRes.json();
  if(!meData.user){
    window.location.href = "/login.html";
    return;
  }
  if(meData.user.role !== "admin"){
    alert("Admin access only.");
    window.location.href = "/";
    return;
  }
  document.getElementById("whoText").textContent = "logged in as " + meData.user.username;
  await loadAll();
})();
