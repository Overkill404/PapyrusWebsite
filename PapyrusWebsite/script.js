const STATUS_CONFIG = {
  state: "online", // "online" | "offline" | "degraded"
  message: "All systems operational.",
  gateway: "Connected",
  apiUrl: null,
  incidents: [],
};

// Paste Discord bot GIF URL here (right-click bot → Copy Image Address)
const BOT_AVATAR_URL = "";

async function loadStatus() {
  let data = { ...STATUS_CONFIG };
  if (STATUS_CONFIG.apiUrl) {
    try {
      const res = await fetch(STATUS_CONFIG.apiUrl, { cache: "no-store" });
      if (res.ok) data = { ...STATUS_CONFIG, ...(await res.json()) };
    } catch (e) {
      data = {
        state: "degraded",
        message: "Could not reach status API.",
        gateway: "Unknown",
        incidents: STATUS_CONFIG.incidents,
      };
    }
  }
  applyStatus(data);
}

function applyStatus(data) {
  const state = data.state || "offline";
  const label =
    state === "online" ? "Online" :
    state === "degraded" ? "Degraded" : "Offline";
  const time = new Date().toLocaleString();

  const dot = document.getElementById("status-dot");
  if (dot) dot.className = "dot " + state;
  const set = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("status-title", label);
  set("status-sub", data.message || "");
  set("stat-bot", label);
  set("stat-gateway", data.gateway || "—");
  set("stat-time", time);
  set("stat-msg", data.message || "—");

  const list = document.getElementById("incident-list");
  if (list) {
    const items = data.incidents || [];
    list.innerHTML = items.length
      ? items.map((i) => `<li><strong>${esc(i.title || "Incident")}</strong> — ${esc(i.detail || "")}</li>`).join("")
      : '<li class="muted">No open incidents reported.</li>';
  }

  const pill = document.getElementById("status-pill");
  const pillText = document.getElementById("status-pill-text");
  if (pill && pillText) {
    const d = pill.querySelector(".dot");
    if (d) d.className = "dot " + state;
    pillText.textContent =
      state === "online" ? "Bot online" :
      state === "degraded" ? "Bot degraded" : "Bot offline";
  }
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyBotAvatar() {
  if (!BOT_AVATAR_URL) return;
  document.querySelectorAll("img.bot-avatar").forEach((img) => {
    img.src = BOT_AVATAR_URL;
  });
}

/* Glitch page transitions */
function setupNavGlitch() {
  const overlay = document.getElementById("page-transition");
  if (!overlay) return;

  document.querySelectorAll("a[data-nav]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("#")) return;
      if (a.target === "_blank") return;
      // same page
      if (href === location.pathname.split("/").pop() || href === location.href) return;
      e.preventDefault();
      overlay.classList.add("active", "flash");
      setTimeout(() => {
        window.location.href = href;
      }, 280);
    });
  });
}

/* Mini battle demo */
function setupMiniBattle() {
  const line = document.getElementById("mini-line");
  const youBar = document.getElementById("mini-you-hp");
  const youNums = document.getElementById("mini-you-nums");
  if (!line) return;

  let hp = 20;
  const lines = {
    fight: [
      "bones rattle through the void.",
      "MISS… or was it?",
      "9999 damage. the strings laugh.",
      "heh. try harder.",
    ],
    act: [
      "you check ERROR SANS…",
      "ATK 99 DEF 99 · strange strings.",
      "you taunt. he glitches harder.",
      "ragebait activated. bad idea.",
    ],
    item: [
      "you eat Dark Candy. HP up.",
      "inventory glitches. item maybe worked.",
      "* determination tastes like static.",
    ],
    mercy: [
      "spare? heh.",
      "not happening.",
      "the blue eye flashes. no mercy.",
    ],
  };

  document.querySelectorAll(".mb-act").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      const pool = lines[act] || lines.fight;
      line.textContent = pool[Math.floor(Math.random() * pool.length)];

      if (act === "fight") {
        hp = Math.max(1, hp - Math.floor(Math.random() * 6 + 2));
      } else if (act === "item") {
        hp = Math.min(20, hp + 5);
      } else if (act === "mercy") {
        hp = Math.max(1, hp - 1);
      }
      if (youBar) youBar.style.width = (hp / 20) * 100 + "%";
      if (youNums) youNums.textContent = hp + "/20";
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyBotAvatar();
  loadStatus();
  setupNavGlitch();
  setupMiniBattle();
  const btn = document.getElementById("refresh-status");
  if (btn) btn.addEventListener("click", loadStatus);
});
