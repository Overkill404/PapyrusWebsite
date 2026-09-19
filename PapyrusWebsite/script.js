const STATUS_CONFIG = {
  state: "online", // "online" | "offline" | "degraded"
  message: "The Great Papyrus is operational. Probably making puzzles.",
  gateway: "Connected",
  apiUrl: null,
  incidents: [],
};

// Paste Discord bot GIF URL here (right-click bot → Copy Image Address)
const BOT_AVATAR_URL = "";

/* =====================================================================
   DISCORD SIGN-IN (implicit flow — works on a static site, no backend)
   One-time setup: in the Discord Developer Portal → your app → OAuth2 →
   Add Redirects, add the site's full URL (e.g. https://overkill404.github.io/PapyrusWebsite/index.html)
   Until then, or when opened from a local file, the "Try demo" link
   shows the whole signed-in experience with fake data.
===================================================================== */
const CLIENT_ID = "1538157742546616370";
const OAUTH_SCOPE = "identify guilds";
const MANAGE_GUILD = 0x20; // permission bit needed to add the bot
const ADMINISTRATOR = 0x8; // Administrator implicitly grants MANAGE_GUILD
function isAdminOf(g) {
  return !!g.owner || (parseInt(g.permissions || "0", 10) & (MANAGE_GUILD | ADMINISTRATOR)) !== 0;
}
const TOKEN_KEY = "papyrus_access_token";

const DEMO_USER = { username: "CrispyNugget", global_name: "CRISPY NUGGET", id: "1", avatar: null, bot: true };
const DEMO_GUILDS = [
  { id: "d1", name: "Papyrus HQ", icon: null, owner: true, permissions: "32" },
  { id: "d2", name: "Snowdin Town", icon: null, owner: false, permissions: "32" },
  { id: "d3", name: "Grillby's Regulars", icon: null, owner: false, permissions: "1024" },
  { id: "d4", name: "The Ruins Book Club", icon: null, owner: false, permissions: "0" },
];

let ME = null;      // signed-in user
let GUILDS = [];    // user's servers
let IS_DEMO = false;

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signInUrl() {
  const redirect = canRedirect()
    ? location.origin + location.pathname.replace(/index\.html?$/, "") 
    : "";
  const u = new URL("https://discord.com/oauth2/authorize");
  u.searchParams.set("client_id", CLIENT_ID);
  u.searchParams.set("response_type", "token");
  u.searchParams.set("scope", OAUTH_SCOPE);
  if (redirect) u.searchParams.set("redirect_uri", redirect);
  return u.toString();
}

function canRedirect() {
  return location.protocol === "http:" || location.protocol === "https:";
}

function startSignIn(demo = false) {
  if (demo || !canRedirect()) return startDemo();
  window.location.href = signInUrl();
}

function startDemo() {
  IS_DEMO = true;
  ME = DEMO_USER;
  GUILDS = DEMO_GUILDS;
  localStorage.setItem("papyrus_demo", "1");
  renderAuth();
  document.getElementById("me")?.scrollIntoView({ behavior: "smooth" });
}

function signOut() {
  IS_DEMO = false;
  ME = null;
  GUILDS = [];
  localStorage.removeItem("papyrus_access_token");
  localStorage.removeItem("papyrus_demo");
  renderAuth();
}

// Implicit flow returns the token in the URL fragment (#access_token=...)
async function handleOAuthCallback() {
  if (!location.hash || !location.hash.includes("access_token")) return false;
  const params = new URLSearchParams(location.hash.slice(1));
  const token = params.get("access_token");
  history.replaceState(null, "", location.pathname + location.search);
  if (!token) return false;
  localStorage.setItem(TOKEN_KEY, token);
  return await loadDiscordUser(token);
}

async function loadDiscordUser(token) {
  const headers = { Authorization: "Bearer " + token };
  const meRes = await fetch("https://discord.com/api/v10/users/@me", { headers });
  if (!meRes.ok) return false;
  ME = await meRes.json();
  const gRes = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers });
  GUILDS = gRes.ok ? await gRes.json() : [];
  return true;
}

async function restoreSession() {
  if (await handleOAuthCallback()) { renderAuth(); return; }
  if (localStorage.getItem("papyrus_demo") === "1") return startDemo();
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    try {
      if (await loadDiscordUser(token)) return renderAuth();
    } catch (e) { /* token expired */ }
    localStorage.removeItem(TOKEN_KEY);
  }
  renderAuth();
}

function guildIconHTML(g, size = 64) {
  if (g.icon) {
    return `<img src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=${size}" alt="" />`;
  }
  const letter = esc((g.name || "?").trim().charAt(0).toUpperCase());
  return `<div class="g-icon-letter">${letter}</div>`;
}

function renderAuth() {
  // nav button on every page
  const nav = document.querySelector(".nav-links");
  if (nav) {
    document.getElementById("auth-nav-slot")?.remove();
    const slot = document.createElement("span");
    slot.id = "auth-nav-slot";
    if (ME) {
      const name = ME.global_name || ME.username || "Player";
      const av = ME.bot || !ME.id
        ? "bot-avatar.gif"
        : `https://cdn.discordapp.com/avatars/${ME.id}/${ME.avatar}.png?size=64`;
      slot.innerHTML = `<a class="nav-user" href="index.html#me" data-nav><img src="${av}" alt="" class="nav-pfp" /> ${esc(name)}</a>`;
    } else {
      slot.innerHTML = `<button type="button" class="btn btn-sm btn-ghost" id="signin-btn">Sign in</button>`;
    }
    nav.appendChild(slot);
    slot.querySelector("#signin-btn")?.addEventListener("click", () => startSignIn());
  }

  // #me section only exists on index
  const me = document.getElementById("me");
  if (!me) return;
  if (!ME) {
    me.hidden = true;
    return;
  }
  me.hidden = false;
  const name = ME.global_name || ME.username || "Player";
  const av = ME.bot || !ME.id
    ? "bot-avatar.gif"
    : `https://cdn.discordapp.com/avatars/${ME.id}/${ME.avatar}.png?size=128`;

  const adminGuilds = GUILDS.filter(isAdminOf);
  const cards = adminGuilds.map((g) => {
    const canAdd = isAdminOf(g);
    const addBtn = canAdd
      ? `<a class="btn btn-sm" target="_blank" rel="noopener" href="https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=2147485696&scope=bot%20applications.commands&guild_id=${g.id}">Add Papyrus</a>`
      : `<span class="g-no-admin">needs admin</span>`;
    return `<article class="g-card" data-guild="${g.id}">
      <div class="g-head">${guildIconHTML(g, 64)}<h3>${esc(g.name)}</h3></div>
      <div class="g-actions">${addBtn}
        <button type="button" class="btn btn-sm btn-ghost g-dash" data-guild="${g.id}">Dashboard</button>
      </div>
    </article>`;
  }).join("");

  me.innerHTML = `
    <div class="me-card">
      <img class="me-pfp" src="${av}" alt="" />
      <div>
        <p class="me-hi">WELCOME BACK, <strong>${esc(name.toUpperCase())}</strong>!${IS_DEMO ? ' <span class="demo-tag">demo</span>' : ""}</p>
        <p class="muted">${adminGuilds.length} server${adminGuilds.length === 1 ? "" : "s"} you own or moderate — pick one for its dashboard, or add Papyrus where he's missing.</p>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="signout-btn">Sign out</button>
    </div>
    <div class="g-grid">${cards || '<p class="muted">No servers with admin access yet — invite Papyrus to one from Discord!</p>'}</div>
    <div id="server-dash" hidden></div>
  `;

  document.getElementById("signout-btn").addEventListener("click", signOut);
  me.querySelectorAll(".g-dash").forEach((b) =>
    b.addEventListener("click", () => openServerDash(b.getAttribute("data-guild")))
  );
}

function openServerDash(guildId) {
  const g = GUILDS.find((x) => x.id === guildId);
  const dash = document.getElementById("server-dash");
  if (!g || !dash) return;
  dash.hidden = false;
  const isAdmin = isAdminOf(g);

  dash.innerHTML = `
    <div class="sd-head">
      <div class="sd-icon">${guildIconHTML(g, 96)}</div>
      <div>
        <h3 class="sd-title">${esc(g.name)} <span class="demo-tag-inline">DASHBOARD</span></h3>
        <p class="muted">${isAdmin ? "ADMIN VIEW — every function of the bot, all in one place." : "Player view — ask an admin about the Admin Suite."}</p>
      </div>
      <button type="button" class="btn btn-sm btn-ghost" id="sd-close">Back</button>
    </div>
    <div class="sd-tabs">
      <button type="button" class="sd-tab active" data-tab="player">⚔️ Player Commands</button>
      ${isAdmin ? '<button type="button" class="sd-tab" data-tab="admin">🛡️ Admin Suite</button>' : ""}
    </div>
    <div id="sd-tab-player"></div>
    <div id="sd-tab-admin" hidden></div>
  `;

  renderPlayerDir(dash.querySelector("#sd-tab-player"));
  const adminPane = dash.querySelector("#sd-tab-admin");
  if (isAdmin) renderAdminDir(adminPane);

  dash.querySelectorAll(".sd-tab").forEach((t) => {
    t.addEventListener("click", () => {
      dash.querySelectorAll(".sd-tab").forEach((x) => x.classList.remove("active"));
      t.classList.add("active");
      dash.querySelector("#sd-tab-player").hidden = t.dataset.tab !== "player";
      adminPane.hidden = t.dataset.tab !== "admin";
    });
  });

  dash.scrollIntoView({ behavior: "smooth" });
  dash.querySelector("#sd-close").addEventListener("click", () => (dash.hidden = true));
}

/* =====================================================================
   MINI BATTLE V2 — a real (tiny) fight
===================================================================== */
function setupMiniBattle() {
  const frame = document.querySelector(".mb-frame");
  const stage = document.querySelector(".mb-stage");
  const line = document.getElementById("mini-line");
  const youBar = document.getElementById("mini-you-hp");
  const youNums = document.getElementById("mini-you-nums");
  const bossBar = document.querySelector(".mb-bar i.boss");
  const bossNums = document.getElementById("mini-boss-nums");
  if (!frame || !line) return;

  const MAX_YOU = 20;
  const MAX_BOSS = 300;
  let you = MAX_YOU;
  let boss = MAX_BOSS;
  let spared = false;
  let busy = false;

  const lines = {
    fight: [
      "NYEH! BONES ATTACK!",
      "MISS? IMPOSSIBLE! ...OR IS IT? YES. IT'S A MISS.",
      "YOUR ATTACK FILLS ME WITH... DETERMINATION TO DO BETTER!",
      "A GOOD EFFORT, HUMAN! ALMOST AS GOOD AS MINE!",
    ],
    act: [
      "YOU CHECK THE GREAT PAPYRUS...",
      "ATK 8 · DEF 9999 · MAKES EXCELLENT SPAGHETTI.",
      "YOU TELL A JOKE. PAPYRUS LAUGHS. IT'S A TIE.",
      "HE IS TOO BUSY MAKING PUZZLES TO BE DEFEATED.",
    ],
    item: [
      "YOU EAT SPAGHETTI. HP FULLY RESTORED. OF COURSE.",
      "THE ITEM IS RAW SPAGHETTI. IT'S... STILL SPAGHETTI.",
      "DELICIOUS. THE GREAT PAPYRUS APPROVES!",
    ],
    mercy: [
      "SPARE? YOU CHOOSE MERCY??",
      "I KNEW THERE WAS KINDNESS IN YOU!",
      "NYEH HEH HEH! FRIENDSHIP UNLOCKED!",
    ],
  };

  // typewriter dialogue
  let typeTimer = null;
  function say(text) {
    clearInterval(typeTimer);
    line.textContent = "";
    let i = 0;
    typeTimer = setInterval(() => {
      line.textContent = text.slice(0, ++i);
      if (i >= text.length) clearInterval(typeTimer);
    }, 18);
  }

  function popDamage(targetEl, text, cls) {
    const n = document.createElement("span");
    n.className = "dmg-num " + (cls || "");
    n.textContent = text;
    (targetEl || stage).appendChild(n);
    setTimeout(() => n.remove(), 1100);
  }

  function shake() {
    frame.classList.remove("shake");
    void frame.offsetWidth; // restart animation
    frame.classList.add("shake");
    setTimeout(() => frame.classList.remove("shake"), 500);
  }

  function boneWave(count = 4) {
    if (!stage) return;
    for (let i = 0; i < count; i++) {
      const b = document.createElement("span");
      b.className = "atk-bone";
      b.style.top = 15 + Math.random() * 65 + "%";
      b.style.animationDelay = i * 0.22 + "s";
      stage.appendChild(b);
      setTimeout(() => b.remove(), 1600);
    }
  }

  function updateBars() {
    if (youBar) youBar.style.width = (you / MAX_YOU) * 100 + "%";
    if (youNums) youNums.textContent = you + "/" + MAX_YOU;
    if (bossBar) bossBar.style.width = (boss / MAX_BOSS) * 100 + "%";
    if (bossNums) bossNums.textContent = boss + "/" + MAX_BOSS;
  }

  function spare() {
    spared = true;
    frame.classList.add("spared");
    document.querySelectorAll(".mb-act").forEach((b) => (b.disabled = true));
  }

  document.querySelectorAll(".mb-act").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (busy || spared) return;
      busy = true;
      const act = btn.getAttribute("data-act");
      const pool = lines[act] || lines.fight;
      say(pool[Math.floor(Math.random() * pool.length)]);

      if (act === "fight") {
        const dmg = Math.floor(Math.random() * 40 + 15);
        boss = Math.max(0, boss - dmg);
        stage?.querySelector(".error-sprite")?.classList.add("hit");
        setTimeout(() => stage?.querySelector(".error-sprite")?.classList.remove("hit"), 400);
        popDamage(stage, "-" + dmg, "on-boss");
        updateBars();
        // Papyrus retaliates with a bone wave
        setTimeout(() => {
          boneWave(4);
          setTimeout(() => {
            const hit = Math.floor(Math.random() * 6 + 2);
            you = Math.max(1, you - hit);
            popDamage(stage, "-" + hit, "on-you");
            shake();
            updateBars();
            busy = false;
            if (boss <= 0) spare();
          }, 900);
        }, 400);
      } else if (act === "item") {
        you = Math.min(MAX_YOU, you + 5);
        popDamage(stage, "+5", "heal");
        updateBars();
        busy = false;
      } else if (act === "mercy") {
        setTimeout(() => {
          spare();
          say("YOU WON! YOU EARNED 0 XP AND 0 GOLD. AND A FRIEND.");
          busy = false;
        }, 900);
      } else {
        busy = false;
      }
    });
  });

  updateBars();
  say("NYEH HEH HEH! STILL STANDING?");
}

/* ---------------- status ---------------- */
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
      if (href === location.pathname.split("/").pop() || href === location.href) return;
      e.preventDefault();
      overlay.classList.add("active", "flash");
      setTimeout(() => {
        window.location.href = href;
      }, 280);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  applyBotAvatar();
  // battle sprite is its own customizable file; fall back to the pfp if missing
  const sprite = document.getElementById("battle-sprite");
  if (sprite) sprite.addEventListener("error", () => { sprite.src = "bot-avatar.gif"; });
  loadStatus();
  setupNavGlitch();
  setupMiniBattle();
  restoreSession();
  document.getElementById("demo-signin")?.addEventListener("click", () => startDemo());
  document.getElementById("real-signin")?.addEventListener("click", () => startSignIn());
  const btn = document.getElementById("refresh-status");
  if (btn) btn.addEventListener("click", loadStatus);
});

/* =====================================================================
   FULL-FUNCTION DIRECTORY — real bot data
===================================================================== */
const COMMAND_GROUPS = {"🧩 Getting Started & Adventure": [["start", "Create your SOUL and begin"], ["backpack", "Your gear, skills, pets, and hub for everything you carry"], ["explore", "Venture out — encounters, treasures, mysteries"], ["puzzle", "Puzzles. THE GREAT PAPYRUS LOVES PUZZLES"], ["puzzle-gauntlet", "A full gauntlet of devious puzzles"], ["gather", "Gather materials (weather changes the odds)"], ["weather", "Check the weather — it matters, honestly"], ["route", "Genocide · neutral · pacifist — choose your path"], ["quests", "Daily quests and rewards"], ["treasure", "Hunt for buried treasure"], ["summon", "Summon a boss to fight"], ["summonboss", "Admin: summon a world boss for the server"], ["worldboss", "Join the ongoing world boss fight"], ["bosses", "Browse every boss"], ["bossloot", "See what a boss drops"], ["explore", "Travel the Underground's locations"], ["visit", "Travel the Underground's locations"], ["exchange", "Travel the Underground's locations"]], "⚔️ Combat & Skills": [["bonetraining", "Train your attack"], ["specialattack", "Unleash your special attack"], ["bossability", "Manage boss abilities (admins)"], ["skills", "Your skill tree"], ["spirit", "Your guardian spirit"], ["abilitylist", "All abilities"], ["betpvp", "Bet on PvP fights"], ["bounty", "Bounty board — hunt or be hunted"], ["guard", "The Royal Guard RPG"], ["createability", "Admin creation tools"], ["createboss", "Admin creation tools"], ["createitem", "Admin creation tools"], ["createequipment", "Admin creation tools"], ["editboss", "Admin editing tools"], ["editplayer", "Admin editing tools"], ["update", "Admin editing tools"], ["updaterole", "Admin editing tools"], ["deleteboss", "Admin removal tools"], ["removebossability", "Admin removal tools"], ["removebossloot", "Admin removal tools"], ["removebossrole", "Admin removal tools"]], "💰 Economy": [["bank", "Store your GOLD safely"], ["jobs", "Work a job, earn wages"], ["fish", "Cast a line (storms help)"], ["blackjack", "The casino classic"], ["stocks", "Invest in the market"], ["invest", "Long-term investments"], ["heist", "Plan a heist. Get rich. Or caught"], ["auction", "Bid on rare items"], ["shop", "The item shop"], ["prestigeshop", "Prestige currency store"], ["playershop", "Player-run shops"], ["stall", "Run your own market stall"], ["selljunk", "Clear your inventory for cash"], ["contracts", "Fishing & work contracts"], ["rent", "Rent equipment"], ["bribe", "Bribe the guard. We won't tell"], ["exchange", "Currency exchange"], ["gift", "Give to friends (or rivals)"], ["giveitem", "Give to friends (or rivals)"], ["cosmetics", "Look the part"], ["upgrade", "Upgrade your gear and pack"], ["backpackupgrades", "Upgrade your gear and pack"]], "👾 Social & Clans": [["clan", "Join or run a clan — wars included"], ["faction", "Factions of the Underground"], ["museum", "The server museum"], ["musicbox", "The music box"], ["mynpc", "Your custom NPC"], ["friendship", "Track friendships"], ["kitchen", "Cooking (spaghetti, presumably)"], ["cookinglb", "Cooking leaderboard"], ["poll", "Post a poll"], ["tip", "Tips and hints"], ["undernet", "The Undernet"], ["leaderboard", "Ranks, power, boss kills"], ["profile", "Your profile"], ["commands", "In-Discord command list"]], "🛡️ Moderation & Guard": [["papyrus", "The admin menu — everything lives here"], ["admin", "Admin tools and roles"], ["adminrole", "Admin tools and roles"], ["arrest", "The holding cell"], ["unarrest", "The holding cell"], ["jail", "Jail a troublemaker"], ["quarantine", "Quarantine cells"], ["erase", "Mute / unmute"], ["unerase", "Mute / unmute"], ["swisscheese", "Purge + mute. Don't ask"], ["uncheese", "Purge + mute. Don't ask"], ["court", "The Strings Court"], ["appeal", "Appeal a punishment"], ["modmail", "Contact the mods"], ["release", "Release someone"], ["rewardplayer", "Reward a player"], ["itemlist", "Admin lists & shop config"], ["equipmentlist", "Admin lists & shop config"], ["shopadd", "Admin lists & shop config"], ["shoplist", "Admin lists & shop config"], ["shopremove", "Admin lists & shop config"], ["bossrolelist", "Admin lists & shop config"]]};

// Admin suite mirrored from the bot's admin panel hubs (m29/m33/m37/m38/m41)
const ADMIN_SUITE = [
  { hub: "🎮 Economy II Hub", note: "20 economy features, admin-editable", items: ["Jobs", "Fishing", "Contracts", "Hot Items (daily bonus)", "Treasure Maps", "Bank", "Upgrades", "Rent", "Cosmetics & Titles", "Bribes", "Auctions", "Player Stalls (bulk)", "Currency Exchange", "Clan Tax", "Gifting", "Tipping", "Player Bounties", "Heists", "Investments", "Prestige Shop"] },
  { hub: "🛡️ Safety Hub", note: "20 moderation & protection tools", items: ["Join Verification Gate", "Account Age Gate", "Join-Burst Shield", "Anti-Nuke Watchdog", "Quarantine Cells", "Zalgo Filter", "Caps/Emoji Limiter", "Mass-Mention Detector", "Invite Filter", "Link Allowlist", "Copy-Paste Flood", "SOUL Integrity", "Auto-DM Warnings", "Timeout Scaler", "Impersonation Filter", "Message Archive", "Modmail", "Staff Audit Viewer", "Channel Heat Map", "Quiet Hours"] },
  { hub: "🎭 Immersion Hub", note: "14 world-building features", items: ["Rumor Mill", "Underground Newspaper", "Wanted Posters", "Echo Flowers", "Papyrus & Sans Skits", "Custom NPCs", "Factions & Territory", "Shop Stalls", "Music Box", "Art Museum", "Clan Wars", "Guard Tryouts", "Bounty Hunters", "Weather Consequences"] },
  { hub: "🧰 Admin Tools Hub", note: "21 server management tools", items: ["Player Logger", "Mass Role Manager", "Bulk Message Cleaner", "Slowmode Presets", "Scheduled Announcements", "Permission Tester", "Config Backup", "Staff Activity", "Auto-Thread", "Channel Templates", "Onboarding Checklist", "Raid Replay", "Webhook Logger", "Vote Timeouts", "Rules Quiz", "Auto Archiver", "The Button", "Reverse Card", "Grillby's Debt Collector", "Mystery Box Scam", "Challenge a Player"] },
  { hub: "📜 Player Logger", note: "proof logs, timelines, mod notes", items: ["Action Timelines", "Mod Notes", "Warnings", "Strikes", "Proof Uploads", "Cross-Server Records", "Search Players", "Open by ID"] },
];

function sdToast(msg) {
  let t = document.getElementById("sd-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "sd-toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.classList.remove("show"), 2200);
}

function renderPlayerDir(root) {
  if (!root) return;
  const html = Object.entries(COMMAND_GROUPS).map(([group, cmds]) => `
    <div class="fn-group">
      <h4>${esc(group)}</h4>
      <div class="fn-chips">
        ${cmds.map(([name, desc]) =>
          `<button type="button" class="fn-chip" data-cmd="/${esc(name)}" data-desc="${esc(desc)}">/${esc(name)}</button>`
        ).join("")}
      </div>
    </div>`).join("");
  root.innerHTML = `
    <p class="sd-note">Every one of the bot's ${Object.values(COMMAND_GROUPS).flat().length} player commands. Click one to copy it — paste it in any channel Papyrus is in.</p>
    ${html}`;
  root.querySelectorAll(".fn-chip").forEach((c) =>
    c.addEventListener("click", () => {
      const cmdText = c.dataset.cmd;
      if (navigator.clipboard) navigator.clipboard.writeText(cmdText).catch(() => {});
      sdToast(`📋 ${cmdText} copied — paste it in Discord! ${c.dataset.desc ? "· " + c.dataset.desc : ""}`);
    })
  );
}

function renderAdminDir(root) {
  if (!root) return;
  const html = ADMIN_SUITE.map((hub) => `
    <div class="fn-group">
      <h4>${esc(hub.hub)} <span style="font-weight:400; letter-spacing:0">— ${esc(hub.note)}</span></h4>
      <div class="fn-chips">
        ${hub.items.map((item) =>
          `<button type="button" class="fn-chip admin-chip" data-tool="${esc(item)}">${esc(item)}</button>`
        ).join("")}
      </div>
    </div>`).join("");
  root.innerHTML = `
    <p class="sd-note">The ENTIRE admin suite, mirrored from the bot's admin panel. Web control wires up when the bot's API lands — until then, each tool's panel lives in Discord under <code>/admin</code>.</p>
    ${html}`;
  root.querySelectorAll(".fn-chip").forEach((c) =>
    c.addEventListener("click", () =>
      sdToast(`🛡️ ${c.dataset.tool} — opens from the bot's Admin Panel (/admin in Discord). Web control coming soon!`)
    )
  );
}

/* =====================================================================
   THE BROTHERS — banter engine
===================================================================== */
const BANTER = [
  ["papyrus", "SANS! YOU ABSOLUTELY CANNOT NAP IN THE TALL GRASS OF THE RUINS!"],
  ["sans", "sure i can. i'm doing it right now."],
  ["papyrus", "THAT IS THE PROBLEM! YOU ARE DOING IT RIGHT NOW!"],
  ["sans", "sounds like a you problem, bro."],
  ["papyrus", "I HAVE CAPTURED ZERO HUMANS THIS MONTH AND YOU HAVE CONTRIBUTED ZERO EFFORT!"],
  ["sans", "technically we're tied."],
  ["papyrus", "I MADE A PUZZLE SO HARD EVEN I DON'T KNOW THE ANSWER."],
  ["sans", "that's... every puzzle you make, papyrus."],
  ["papyrus", "NYEH HEH HEH!! ...DO NOT MAKE ME LAUGH WHILE I AM FURIOUS."],
  ["sans", "welp. back to work. by which i mean, nap."],
];

function setupBanter() {
  const stage = document.getElementById("hangout-stage");
  if (!stage) return;
  // rising sparkles around each brother
  stage.querySelectorAll(".banter-actor").forEach((a) => {
    ["✨", "🦴", "✨"].forEach((s) => {
      const sp = document.createElement("span");
      sp.className = "spark";
      sp.textContent = s;
      a.appendChild(sp);
    });
  });
  let step = 0;
  let timer = null;

  function show() {
    const [who, line] = BANTER[step % BANTER.length];
    step++;
    const pb = document.getElementById("bubble-papyrus");
    const sb = document.getElementById("bubble-sans");
    const target = who === "sans" ? sb : pb;
    const other = who === "sans" ? pb : sb;
    other.hidden = true;
    target.hidden = false;
    target.querySelector(".b-line").textContent = line;
    clearTimeout(timer);
    timer = setTimeout(show, 5200); // they argue on their own
  }

  stage.querySelectorAll(".banter-actor").forEach((a) =>
    a.addEventListener("click", () => {
      clearTimeout(timer);
      show();
    })
  );
  // first line only when scrolled into view-ish: just start after a beat
  setTimeout(show, 1200);
}

document.addEventListener("DOMContentLoaded", () => setupBanter());

/* =====================================================================
   LIVE CONTROL — dashboard v2, wired to the bot's web API (m42)
===================================================================== */
function apiBase() {
  const saved = (window.PAPYRUS_API_BASE || localStorage.getItem("papyrus_api_base") || "").replace(/\/$/, "");
  if (saved) return saved;
  // Default: this site's own origin — the Netlify _redirects proxy forwards
  // /api/* to the bot on WispByte, which sidesteps the mixed-content block.
  const origin = window.location.origin || "";
  return origin.startsWith("http") ? origin : "";
}

async function apiFetch(path, opts = {}, token = null) {
  const base = apiBase();
  if (!base) throw new Error("no-api-base");
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = "Bearer " + token;
  const res = await fetch(base + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Object({ status: res.status, ...data });
  return data;
}

function liveToggleHTML(key, val) {
  const on = String(val) === "1" || String(val).toLowerCase() === "true";
  return `<div class="toggle-row">
    <code>${esc(key)}</code>
    <label class="switch"><input type="checkbox" data-cfg="${esc(key)}" ${on ? "checked" : ""} /><i></i></label>
  </div>`;
}

const TOGGLE_PREFIXES = ["webapi", "guard", "playerlog", "quiz", "autothread", "archive", "webhooklog", "skits", "rumor", "echo", "paper", "wanted", "npc", "faction", "stall", "music", "museum", "clanwar", "tryout", "bounty", "weather_", "jobs_enabled", "fish_enabled", "contracts_enabled", "hot_enabled", "maps_enabled", "bank_enabled", "upgrade_enabled", "rent_enabled", "cosmetics_enabled", "bribe_enabled", "auction_enabled", "bulk_enabled", "exchange_enabled", "clan_tax_enabled", "gift_enabled", "tip_enabled", "pbounty_enabled", "heist_enabled", "invest_enabled", "prestige_enabled", "quiet_hours", "zalgo", "invite_filter", "verify_gate", "account_age", "join_burst", "anti_nuke", "quarantine", "caps_limit", "mass_mention", "impersonation", "auto_dm"];

async function renderLiveTab(root, gid, apiToken) {
  if (IS_DEMO) {
    root.innerHTML = `<p class="live-note">⚡ Live Control talks to the real bot. Demo mode can't — sign in for real (after the site URL is in the bot app's OAuth redirects) and have the bot's API running.</p>`;
    return;
  }
  let base = apiBase();
  let online = false;
  if (base) {
    try { await apiFetch("/api/health", {}, apiToken); online = true; } catch (e) { online = false; }
  }
  if (!online) {
    root.innerHTML = `
      <p class="live-note">⚡ <strong>Live Control</strong> is wired through this site's secure proxy — no address to paste. It just can't reach the bot right now: make sure the bot is running with the new files and its API port is open.</p>
      <div class="api-row">
        <input id="api-base-input" placeholder="override address (optional)" value="${esc(localStorage.getItem("papyrus_api_base") || "")}" />
        <button type="button" class="btn btn-sm" id="api-base-save">Retry</button>
      </div>
      <p class="live-note">The bot prints <code>web_api: serving on port …</code> in its console when the API is live.</p>`;
    root.querySelector("#api-base-save").addEventListener("click", () => {
      const v = root.querySelector("#api-base-input").value.trim();
      if (v) localStorage.setItem("papyrus_api_base", v);
      else localStorage.removeItem("papyrus_api_base");
      renderLiveTab(root, gid, apiToken);
    });
    return;
  }

  root.innerHTML = `<p class="live-note">⚡ LIVE — changes apply to your server immediately. Every action is audit-logged with your name.</p>
    <div class="live-grid">
      <div class="live-card"><h4>🎚️ Feature Toggles</h4><div id="live-toggles"><p class="muted">loading…</p></div></div>
      <div class="live-card"><h4>💰 Economy Grant</h4>
        <div class="live-form">
          <input id="grant-user" placeholder="user id" />
          <input id="grant-amount" placeholder="amount" style="max-width:90px" />
          <button type="button" class="btn btn-sm" id="grant-btn">Give</button>
        </div>
        <div id="shop-wrap"></div>
      </div>
      <div class="live-card"><h4>🛡️ Moderation</h4>
        <div class="live-form">
          <input id="mod-user" placeholder="user id" />
          <input id="mod-reason" placeholder="reason" />
          <select id="mod-sev" style="max-width:70px"><option>1</option><option>2</option><option>3</option></select>
          <button type="button" class="btn btn-sm" id="warn-btn">Warn</button>
          <button type="button" class="btn btn-sm btn-ghost" id="to-btn">Timeout 10m</button>
        </div>
      </div>
      <div class="live-card"><h4>⚔️ Battle Preview</h4>
        <div class="live-form">
          <input id="bp-boss" placeholder="boss id" style="max-width:80px" />
          <input id="bp-level" placeholder="your level" style="max-width:80px" value="10" />
          <button type="button" class="btn btn-sm" id="bp-btn">Simulate</button>
        </div>
        <div class="battle-preview" id="bp-out"></div>
      </div>
      <div class="live-card" style="grid-column: 1 / -1;"><h4>🛒 Shop Editor</h4><div id="boss-shop"></div></div>
      <div class="live-card" style="grid-column: 1 / -1;"><h4>🐉 Boss Battles</h4><div id="boss-editor"></div></div>
    </div>`;

  const cfg = await apiFetch(`/api/guild/${gid}/config`, {}, apiToken);
  const conf = cfg.config || {};
  const toggleKeys = Object.keys(conf).filter((k) =>
    k.endsWith("_enabled") || k.endsWith("_on") || TOGGLE_PREFIXES.some((p) => k.startsWith(p))
  );
  root.querySelector("#live-toggles").innerHTML = toggleKeys.length
    ? toggleKeys.map((k) => liveToggleHTML(k, conf[k])).join("")
    : '<p class="muted">No toggles found.</p>';
  root.querySelectorAll("input[data-cfg]").forEach((inp) =>
    inp.addEventListener("change", async () => {
      try {
        await apiFetch(`/api/guild/${gid}/config`, { method: "POST", body: JSON.stringify({ [inp.dataset.cfg]: inp.checked ? 1 : 0 }) }, apiToken);
        sdToast(`🎚️ ${inp.dataset.cfg} = ${inp.checked ? "ON" : "OFF"} — applied!`);
      } catch (e) { sdToast("❌ failed: " + (e.error || e)); }
    })
  );

  const grant = root.querySelector("#grant-btn");
  if (grant) grant.addEventListener("click", async () => {
    try {
      await apiFetch(`/api/guild/${gid}/economy/grant`, { method: "POST", body: JSON.stringify({ user_id: root.querySelector("#grant-user").value, amount: root.querySelector("#grant-amount").value, reason: "website dashboard" }) }, apiToken);
      sdToast("💰 granted!");
    } catch (e) { sdToast("❌ " + (e.error || e)); }
  });

  const warn = root.querySelector("#warn-btn");
  if (warn) warn.addEventListener("click", async () => {
    try {
      await apiFetch(`/api/guild/${gid}/mod/warn`, { method: "POST", body: JSON.stringify({ user_id: root.querySelector("#mod-user").value, reason: root.querySelector("#mod-reason").value, severity: root.querySelector("#mod-sev").value }) }, apiToken);
      sdToast("🛡️ warning delivered!");
    } catch (e) { sdToast("❌ " + (e.error || e)); }
  });
  const to = root.querySelector("#to-btn");
  if (to) to.addEventListener("click", async () => {
    try {
      await apiFetch(`/api/guild/${gid}/mod/timeout`, { method: "POST", body: JSON.stringify({ user_id: root.querySelector("#mod-user").value, minutes: 10 }) }, apiToken);
      sdToast("⏱️ timed out 10 minutes!");
    } catch (e) { sdToast("❌ " + (e.error || e)); }
  });

  const bp = root.querySelector("#bp-btn");
  if (bp) bp.addEventListener("click", async () => {
    try {
      const sim = await apiFetch(`/api/guild/${gid}/battle/preview`, { method: "POST", body: JSON.stringify({ boss_id: root.querySelector("#bp-boss").value, player_level: root.querySelector("#bp-level").value }) }, apiToken);
      const bmax = sim.boss.hp, pmax = sim.player.hp;
      let pNow = pmax, bNow = bmax;
      root.querySelector("#bp-out").innerHTML = sim.turns.map((t) => {
        bNow = t.boss_hp; pNow = t.player_hp;
        return `<div class="bp-turn"><span class="t">T${t.turn}</span>
          <div class="bp-bar you"><i style="width:${(pNow / pmax) * 100}%"></i></div>
          <div class="bp-bar boss"><i style="width:${(bNow / bmax) * 100}%"></i></div>
          <span>-${t.player_dmg}</span></div>`;
      }).join("") + `<p class="bp-verdict">${sim.result === "player" ? "🏆 PLAYER WINS (simulated)" : "💀 BOSS STANDS (simulated)"}</p>`;
    } catch (e) { sdToast("❌ " + (e.error || e)); }
  });

  // shop editor
  try {
    const shop = await apiFetch(`/api/guild/${gid}/table/economy_shop?limit=50`, {}, apiToken);
    const wrap = root.querySelector("#boss-shop");
    const rows = shop.rows || [];
    wrap.innerHTML = `<table class="mini-table"><tr><th>Item</th><th>Cost</th><th>Stock</th><th></th></tr>
      ${rows.map((r) => `<tr><td>${esc(r.emoji || "")} ${esc(r.name)}</td><td>${esc(r.cost)}</td><td>${esc(r.stock)}</td>
        <td><button type="button" class="mini-x" data-del="${r.id}">✕</button></td></tr>`).join("")}
    </table>
    <div class="live-form">
      <input id="shop-name" placeholder="name" />
      <input id="shop-emoji" placeholder="🍕" style="max-width:60px" />
      <input id="shop-cost" placeholder="cost" style="max-width:80px" />
      <button type="button" class="btn btn-sm" id="shop-add">Add item</button>
    </div>`;
    wrap.querySelectorAll("[data-del]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await apiFetch(`/api/guild/${gid}/table/economy_shop/${b.dataset.del}`, { method: "DELETE" }, apiToken);
          b.closest("tr").remove(); sdToast("🗑️ item removed");
        } catch (e) { sdToast("❌ " + (e.error || e)); }
      })
    );
    wrap.querySelector("#shop-add").addEventListener("click", async () => {
      try {
        await apiFetch(`/api/guild/${gid}/table/economy_shop`, { method: "POST", body: JSON.stringify({
          name: wrap.querySelector("#shop-name").value, emoji: wrap.querySelector("#shop-emoji").value || "🍕",
          cost: wrap.querySelector("#shop-cost").value || "100", description: "added via website",
          reward_type: "item", reward_amount: 1, stock: -1, enabled: 1, sort_order: 99 }) }, apiToken);
        sdToast("🛒 item added to the shop!");
        renderLiveTab(root, gid, apiToken);
      } catch (e) { sdToast("❌ " + (e.error || e)); }
    });
  } catch (e) { /* shop table optional */ }

  // boss battles editor — create, list, and retire bosses (spawns in real battles)
  try {
    const bosses = await apiFetch(`/api/guild/${gid}/table/bosses?limit=100`, {}, apiToken);
    const bwrap = root.querySelector("#boss-editor");
    const brows = bosses.rows || [];
    bwrap.innerHTML = `<table class="mini-table"><tr><th>Name</th><th>HP</th><th>ATK</th><th>DEF</th><th>XP</th><th>Gold</th><th>On</th><th></th></tr>
      ${brows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.hp)}</td><td>${esc(r.attack)}</td><td>${esc(r.defense)}</td><td>${esc(r.xp)}</td><td>${esc(r.gold)}</td><td>${r.enabled ? "✅" : "—"}</td>
        <td><button type="button" class="mini-x" data-bdel="${r.id}">✕</button></td></tr>`).join("")}
    </table>
    <div class="live-form">
      <input id="boss-name" placeholder="boss name" />
      <input id="boss-hp" placeholder="hp" style="max-width:70px" value="300" />
      <input id="boss-atk" placeholder="atk" style="max-width:60px" value="25" />
      <input id="boss-def" placeholder="def" style="max-width:60px" value="5" />
      <input id="boss-xp" placeholder="xp" style="max-width:60px" value="150" />
      <input id="boss-gold" placeholder="gold" style="max-width:60px" value="80" />
      <button type="button" class="btn btn-sm" id="boss-add">Add boss</button>
    </div>
    <p class="muted" style="margin:6px 0 0">New bosses spawn in wild battles with these stats. Use the Battle Preview panel above to test one before releasing it.</p>`;
    bwrap.querySelectorAll("[data-bdel]").forEach((b) =>
      b.addEventListener("click", async () => {
        try {
          await apiFetch(`/api/guild/${gid}/table/bosses/${b.dataset.bdel}`, { method: "DELETE" }, apiToken);
          b.closest("tr").remove(); sdToast("💀 boss retired");
        } catch (e) { sdToast("❌ " + (e.error || e)); }
      })
    );
    bwrap.querySelector("#boss-add").addEventListener("click", async () => {
      try {
        await apiFetch(`/api/guild/${gid}/table/bosses`, { method: "POST", body: JSON.stringify({
          name: bwrap.querySelector("#boss-name").value || "Mystery Boss",
          hp: parseInt(bwrap.querySelector("#boss-hp").value, 10) || 300,
          attack: parseInt(bwrap.querySelector("#boss-atk").value, 10) || 25,
          defense: parseInt(bwrap.querySelector("#boss-def").value, 10) || 5,
          xp: parseInt(bwrap.querySelector("#boss-xp").value, 10) || 150,
          gold: parseInt(bwrap.querySelector("#boss-gold").value, 10) || 80,
          spawn_rate: 10, enabled: 1, mercy_required: 5 }) }, apiToken);
        sdToast("🐉 boss created! It can spawn in battles now.");
        renderLiveTab(root, gid, apiToken);
      } catch (e) { sdToast("❌ " + (e.error || e)); }
    });
  } catch (e) { /* bosses table optional */ }
}

// hook the Live Control tab into the server dashboard
const _origOpenServerDash = openServerDash;
openServerDash = function (guildId) {
  _origOpenServerDash(guildId);
  if (IS_DEMO || !apiBase()) {
    // still offer the connect UI in real mode without a base
    if (!IS_DEMO) {
      const dash = document.getElementById("server-dash");
      const tabs = dash?.querySelector(".sd-tabs");
      const panes = dash?.querySelectorAll("#sd-tab-player, #sd-tab-admin");
      if (dash && tabs && panes) {
        const pane = document.createElement("div");
        pane.id = "sd-tab-live";
        pane.hidden = true;
        dash.querySelector("#sd-tab-admin")?.after(pane);
        tabs.insertAdjacentHTML("beforeend", '<button type="button" class="sd-tab" data-tab="live">⚡ Live Control</button>');
        dash.querySelectorAll(".sd-tab").forEach((t) =>
          t.addEventListener("click", () => {
            const live = dash.querySelector("#sd-tab-live");
            if (live) live.hidden = t.dataset.tab !== "live";
          })
        );
        // render connect UI lazily on tab click
        tabs.querySelectorAll("[data-tab='live']").forEach((t) =>
          t.addEventListener("click", () => renderLiveTab(dash.querySelector("#sd-tab-live"), guildId, localStorage.getItem(TOKEN_KEY)))
        );
      }
    }
    return;
  }
  // API base already configured — add the live tab with data
  const dash = document.getElementById("server-dash");
  const tabs = dash?.querySelector(".sd-tabs");
  if (dash && tabs) {
    const pane = document.createElement("div");
    pane.id = "sd-tab-live";
    pane.hidden = true;
    dash.querySelector("#sd-tab-admin")?.after(pane);
    tabs.insertAdjacentHTML("beforeend", '<button type="button" class="sd-tab" data-tab="live">⚡ Live Control</button>');
    dash.querySelectorAll(".sd-tab").forEach((t) =>
      t.addEventListener("click", () => {
        const live = dash.querySelector("#sd-tab-live");
        if (live) live.hidden = t.dataset.tab !== "live";
      })
    );
    tabs.querySelectorAll("[data-tab='live']").forEach((t) =>
      t.addEventListener("click", () => renderLiveTab(dash.querySelector("#sd-tab-live"), guildId, localStorage.getItem(TOKEN_KEY)))
    );
  }
};
