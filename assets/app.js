/* Kishin Store - a custom storefront on the Tebex Headless API.
 * Tebex does the basket, payment and delivery (the credits command); this page only shows the packs
 * in our own design and sends the player to Tebex's checkout. Settings live in config.js. */
(() => {
  "use strict";

  const C = window.KISHIN || {};
  const API = "https://headless.tebex.io/api";
  const ID = (C.webstoreId || "").trim();
  const DEMO = !ID || ID.startsWith("PASTE_");
  const $ = (s) => document.querySelector(s);
  const USER_RE = /^[A-Za-z0-9_.]{3,16}$/;

  let currency = "EUR";
  let packages = [];
  let loaded = Promise.resolve();

  // ------------------------------------------------------------------ small helpers
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
    sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    sset(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch { /* ignore */ } },
  };

  function toast(msg, ms = 3200) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), ms);
  }

  function overlay(text) {
    const o = $("#overlay");
    if (text) { $("#overlayText").textContent = text; o.hidden = false; } else o.hidden = true;
  }

  function money(v, cur = currency) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur }).format(v); }
    catch { return v.toFixed(2) + " " + cur; }
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const head = (name, size = 64) => `https://mc-heads.net/avatar/${encodeURIComponent(name)}/${size}`;

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
    if (!res.ok) {
      const msg = (json && (json.detail || json.title || json.message || json.error_message)) || `Tebex error ${res.status}`;
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return json;
  }

  // ------------------------------------------------------------------ username
  const user = () => store.get("kishin_user") || "";

  function renderUser() {
    const name = user();
    $("#userName").textContent = name || "Set username";
    const img = $("#userHead");
    if (name) { img.src = head(name, 32); img.hidden = false; } else img.hidden = true;
  }

  /** Opens the username dialog; resolves with the name, or null when cancelled. */
  function askUser() {
    return new Promise((resolve) => {
      const modal = $("#userModal");
      const input = $("#userInput");
      const preview = $("#previewHead");
      const error = $("#userError");
      input.value = user();
      preview.src = input.value ? head(input.value) : head("MHF_Question");
      error.hidden = true;
      let timer;
      input.oninput = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { if (USER_RE.test(input.value)) preview.src = head(input.value); }, 350);
      };
      const done = (value) => {
        modal.close();
        $("#userForm").onsubmit = null;
        $("#userCancel").onclick = null;
        resolve(value);
      };
      $("#userForm").onsubmit = (e) => {
        e.preventDefault();
        const v = input.value.trim();
        if (!USER_RE.test(v)) { error.hidden = false; return; }
        store.set("kishin_user", v);
        renderUser();
        done(v);
      };
      $("#userCancel").onclick = () => done(null);
      modal.addEventListener("cancel", () => resolve(null), { once: true });
      modal.showModal();
      setTimeout(() => input.focus(), 50);
    });
  }

  // ------------------------------------------------------------------ coin art (drawn, no images needed)
  const STACKS = [[2], [2, 3], [3, 4, 2], [3, 5, 4], [3, 5, 7, 6, 4]];

  function coinArt(tier, uid) {
    const heights = STACKS[Math.min(tier, STACKS.length - 1)];
    const gap = 108, baseY = 222, step = 16;
    const total = (heights.length - 1) * gap;
    const scale = Math.min(1.7, 500 / (total + 130));
    const coin = (x, y) => `<g transform="translate(${x},${y})">
      <path d="M-58,0 L-58,14 A58,20 0 0 0 58,14 L58,0 Z" fill="url(#s${uid})"/>
      <ellipse rx="58" ry="20" fill="url(#f${uid})" stroke="#8a5a0f" stroke-width="1.5"/>
      <ellipse rx="49" ry="15" fill="none" stroke="#D62839" stroke-width="2.4"/>
      <path transform="scale(1,.55)" d="M0,-12 L3,-3 L12,0 L3,3 L0,12 L-3,3 L-12,0 L-3,-3 Z" fill="#D62839"/></g>`;
    const order = heights.map((_, i) => i).sort((a, b) =>
      Math.abs(b - (heights.length - 1) / 2) - Math.abs(a - (heights.length - 1) / 2));
    let body = "";
    for (const i of order) {
      const cx = 300 - total / 2 + i * gap;
      for (let k = 0; k < heights[i]; k++) body += coin(cx, baseY - k * step);
    }
    return `<svg viewBox="40 60 520 220" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
      <defs>
        <linearGradient id="f${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF3C4"/><stop offset=".45" stop-color="#FFD166"/><stop offset="1" stop-color="#D9971F"/></linearGradient>
        <linearGradient id="s${uid}" x1="0" x2="1"><stop offset="0" stop-color="#8a5a0f"/><stop offset=".5" stop-color="#E0A635"/><stop offset="1" stop-color="#7a4d0b"/></linearGradient>
        <radialGradient id="h${uid}"><stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
      </defs>
      <g transform="translate(300,${baseY}) scale(${scale}) translate(-300,${-baseY})">
        <ellipse cx="300" cy="${baseY + 24}" rx="${total / 2 + 90}" ry="22" fill="url(#h${uid})"/>${body}
      </g></svg>`;
  }

  // ------------------------------------------------------------------ packs
  const amountOf = (name) => {
    const m = String(name).replace(/[,.\s](?=\d{3}\b)/g, "").match(/\d+/);
    return m ? parseInt(m[0], 10) : 0;
  };

  function renderPacks() {
    const box = $("#packs");
    if (!packages.length) {
      box.innerHTML = `<div class="empty">No packs are on sale right now. Check back soon!</div>`;
      return;
    }
    // credits per unit of money, to show a bonus on bigger packs
    const rates = packages.map((p) => (p.total_price > 0 ? amountOf(p.name) / p.total_price : 0)).filter((r) => r > 0);
    const baseRate = rates.length ? Math.min(...rates) : 0;
    box.innerHTML = packages.map((p, i) => {
      const amount = amountOf(p.name);
      const badge = (C.badges || {})[String(amount)] || "";
      const discounted = p.discount > 0 && p.base_price > p.total_price;
      const rate = p.total_price > 0 ? amount / p.total_price : 0;
      const bonus = baseRate > 0 && rate > baseRate * 1.01 ? Math.round((rate / baseRate - 1) * 100) : 0;
      return `<article class="pack${badge ? " featured" : ""}">
        ${badge ? `<div class="ribbon">${esc(badge)}</div>` : ""}
        <div class="art">${coinArt(i, i)}</div>
        <div class="amount">${amount ? amount.toLocaleString("en-US") : esc(p.name)}</div>
        ${amount ? `<div class="unit">CREDITS</div>` : ""}
        <div class="price">${discounted ? `<s>${money(p.base_price, p.currency)}</s>` : ""}${money(p.total_price, p.currency)}</div>
        <div class="per">${bonus ? `+${bonus}% bonus credits` : ""}</div>
        <button class="btn primary" type="button" data-buy="${p.id}">Buy now</button>
      </article>`;
    }).join("");
    box.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => buy(Number(b.dataset.buy), b)));
  }

  async function loadPacks() {
    if (DEMO) {
      currency = "EUR";
      packages = [500, 1000, 1500, 2000, 5000].map((a, i) => ({
        id: -(i + 1), name: `${a.toLocaleString("en-US")} Credits`, total_price: a / 100, base_price: a / 100,
        discount: 0, currency: "EUR",
      }));
      renderPacks();
      $("#announce").hidden = false;
      $("#announce").textContent = "Preview mode - add your Tebex webstore identifier in assets/config.js to go live.";
      showRate();
      return;
    }
    try {
      const [shop, cats] = await Promise.all([
        api("GET", `/accounts/${ID}`).then((r) => r.data).catch(() => null),
        api("GET", `/accounts/${ID}/categories?includePackages=1`).then((r) => r.data),
      ]);
      if (shop && shop.currency) currency = shop.currency;
      const wanted = (C.creditsCategory || "").trim().toLowerCase();
      const chosen = wanted ? cats.filter((c) => c.name.trim().toLowerCase() === wanted) : cats;
      packages = (chosen.length ? chosen : cats).flatMap((c) => c.packages || []);
      packages.sort((a, b) => a.total_price - b.total_price);
      renderPacks();
    } catch (e) {
      console.error(e);
      $("#packs").innerHTML = `<div class="empty">Couldn't load the store (${esc(e.message)}). Please refresh in a moment.</div>`;
    }
    showRate();
  }

  function showRate() {
    const perUnit = document.querySelector("#credits .section-head p");
    perUnit.textContent = perUnit.textContent.replace("1 {currency}", money(1).replace(/[.,]00(?=\D*$)/, ""));
  }

  // ------------------------------------------------------------------ checkout
  const origin = () => location.origin + location.pathname.replace(/[^/]*$/, "");

  async function buy(packageId, button) {
    if (DEMO) { toast("Preview mode: connect Tebex in config.js to enable buying."); return; }
    let name = user();
    if (!name) {
      name = await askUser();
      if (!name) return;
    }
    if (button) button.disabled = true;
    overlay("Preparing your checkout...");
    try {
      const basket = (await api("POST", `/accounts/${ID}/baskets`, {
        username: name,
        complete_url: `${origin()}success.html?u=${encodeURIComponent(name)}`,
        cancel_url: `${origin()}#credits`,
        complete_auto_redirect: true,
      })).data;
      if (!basket.username) {
        // this store wants players to log in through Tebex first - come back here afterwards
        const auth = await api("GET", `/accounts/${ID}/baskets/${basket.ident}/auth?returnUrl=${encodeURIComponent(origin() + "?resume=1")}`);
        const url = Array.isArray(auth) && auth[0] && auth[0].url;
        if (!url) throw new Error("Tebex didn't return a login link.");
        store.sset("kishin_pending", JSON.stringify({ ident: basket.ident, packageId }));
        location.href = url;
        return;
      }
      await finish(basket.ident, packageId);
    } catch (e) {
      console.error(e);
      overlay(null);
      toast("Checkout failed: " + e.message, 5000);
    } finally {
      if (button) button.disabled = false;
    }
  }

  /** Adds the pack, applies a saved code and sends the player to Tebex's checkout. */
  async function finish(ident, packageId) {
    overlay("Adding your pack...");
    await api("POST", `/baskets/${ident}/packages`, { package_id: packageId, quantity: 1 });
    const code = (store.get("kishin_code") || "").trim();
    if (code) {
      try {
        await api("POST", `/accounts/${ID}/baskets/${ident}/coupons`, { coupon_code: code });
      } catch {
        try { await api("POST", `/accounts/${ID}/baskets/${ident}/creator-codes`, { creator_code: code }); }
        catch { toast(`The code "${code}" couldn't be applied.`, 4000); }
      }
    }
    overlay("Opening secure checkout...");
    const basket = (await api("GET", `/accounts/${ID}/baskets/${ident}`)).data;
    if (!basket.links || !basket.links.checkout) throw new Error("No checkout link");
    location.href = basket.links.checkout;
  }

  /** Links from the in-game /buy menu: ?buy=<package id>&u=<username> starts that checkout right away. */
  async function deepLink() {
    const params = new URLSearchParams(location.search);
    const id = Number(params.get("buy"));
    const u = params.get("u");
    if (!id) return;
    history.replaceState(null, "", location.pathname + "#credits");
    if (u && USER_RE.test(u)) { store.set("kishin_user", u); renderUser(); }
    await loaded;
    if (!packages.some((p) => p.id === id)) { toast("That pack isn't on sale any more - pick another one below."); return; }
    buy(id, null);
  }

  async function resume() {
    const params = new URLSearchParams(location.search);
    if (!params.has("resume")) return;
    history.replaceState(null, "", location.pathname + "#credits");
    const pending = store.sget("kishin_pending");
    store.sset("kishin_pending", null);
    if (!pending) return;
    try {
      const { ident, packageId } = JSON.parse(pending);
      await finish(ident, packageId);
    } catch (e) {
      overlay(null);
      toast("Checkout failed: " + e.message, 5000);
    }
  }

  // ------------------------------------------------------------------ extras
  function setupIp() {
    const ip = C.serverIp || "";
    const btn = $("#ipBtn");
    if (!ip) { btn.hidden = true; return; }
    $("#ipText").textContent = ip;
    btn.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(ip); toast("Server IP copied - see you in game!"); }
      catch { toast(ip); }
    });
    fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}`)
      .then((r) => r.json())
      .then((s) => {
        if (s && s.online) {
          $("#statusDot").classList.add("on");
          const p = s.players || {};
          $("#onlineText").textContent = `${p.online ?? 0} online · click to copy`;
        } else {
          $("#onlineText").textContent = "click to copy";
        }
      })
      .catch(() => {});
  }

  async function loadCommunity() {
    if (DEMO) return;
    let modules;
    try { modules = (await api("GET", `/accounts/${ID}/sidebar`)).data || []; } catch { return; }
    const parts = [];
    for (const m of modules) {
      const d = m.data || {};
      if (m.type === "payment_goal" || m.type === "community_goal") {
        const pct = Math.max(0, Math.min(100, Number(d.percentage) || 0));
        parts.push(`<div class="card"><h3>${esc(d.header || "Monthly goal")}</h3>
          <div class="goal-bar"><div style="width:${pct}%"></div></div>
          <div class="goal-text"><span>${pct}% reached</span><span>Thank you ❤</span></div></div>`);
      } else if (m.type === "recent_payments" && Array.isArray(d.payments) && d.payments.length) {
        parts.push(`<div class="card"><h3>${esc(d.header || "Recent supporters")}</h3><div class="recent">${
          d.payments.slice(0, 12).map((p) => `<img src="${head(p.username, 40)}" alt="${esc(p.username)}" title="${esc(p.username)} - ${esc(p.package && p.package.name)}" loading="lazy">`).join("")
        }</div></div>`);
      } else if (m.type === "top_customer" && d.username) {
        parts.push(`<div class="card"><h3>${esc(d.header || "Top supporter")}</h3>
          <div class="recent"><img src="${head(d.username, 40)}" alt=""><strong style="align-self:center">${esc(d.username)}</strong></div></div>`);
      }
    }
    if (parts.length) {
      $("#communityBody").innerHTML = parts.join("");
      $("#community").hidden = false;
    }
  }

  function setupCode() {
    const input = $("#codeInput");
    input.value = store.get("kishin_code") || "";
    if (input.value) $("#codeHint").textContent = `"${input.value}" will be applied at checkout.`;
    $("#codeForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      store.set("kishin_code", v || null);
      $("#codeHint").textContent = v ? `"${v}" will be applied at checkout.` : "It's applied when you check out.";
      toast(v ? "Code saved." : "Code removed.");
    });
  }

  // ------------------------------------------------------------------ start
  document.addEventListener("DOMContentLoaded", () => {
    if (C.announcement) { $("#announce").textContent = C.announcement; $("#announce").hidden = false; }
    const discord = $("#discordBtn");
    if (C.discord) discord.href = C.discord; else discord.hidden = true;
    $("#userChip").addEventListener("click", () => askUser());
    renderUser();
    setupIp();
    setupCode();
    loaded = loadPacks();
    loadCommunity();
    resume();
    deepLink();
  });
})();
