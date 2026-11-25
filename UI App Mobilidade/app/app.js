// Move Ijuí — navegação e interações do app reconstruído em HTML.
// Cada <section class="screen"> é uma tela; a URL guarda a tela atual (#s01 … #s16).

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ---------- Cabeçalho e barra inferior (montados a partir dos data-attributes) ----------
const STATUS = `<div class="statusbar"><span>07:45</span><span class="icons"><span class="ms">signal_cellular_alt</span>5G<span class="ms">wifi</span><span class="ms">battery_full</span></span></div>`;
const AVATAR = `<button class="avatar-btn" data-go="s15" aria-label="Perfil"><img class="avatar" src="assets/avatar-usuaria.jpg" alt=""></button>`;
const TABS = {
  bus: [["s01", "home", "Início"], ["s04", "location_on", "Pontos"], ["s14", "notifications", "Alertas", true], ["s15", "person", "Perfil"]],
  car: [["s01", "directions_bus", "Ônibus"], ["s09", "directions_car", "Particular"], ["s04", "location_on", "Pontos"], ["s14", "notifications", "Alertas", true], ["s16", "local_taxi", "Motorista"]],
};

// Passos dos fluxos: [fluxo, passo, total] — aparece no cabeçalho com uma barrinha de progresso
const STEPS = {
  s03: ["De ônibus", 1, 3], s05: ["De ônibus", 2, 3], s08: ["De ônibus", 3, 3],
  s10: ["De carro", 1, 5], s11: ["De carro", 2, 5], s12: ["De carro", 3, 5],
  s06: ["De carro", 4, 5], s07: ["De carro", 5, 5],
};

for (const sc of $$(".screen")) {
  const d = sc.dataset, step = STEPS[sc.id];
  const sub = step ? `<div class="s step">Passo ${step[1]} de ${step[2]} • ${step[0]}</div>` : "";
  const bar = d.header === "back"
    ? `<button class="back" data-back aria-label="Voltar"><span class="ms">arrow_back</span></button>
       <div class="titles"><div class="t">${d.title}</div>${sub}</div>`
    : `<button class="row gap-8" data-go="s01" style="flex:1;text-align:left"><img class="logo" src="assets/logo-move-ijui.jpg" alt="">
       <div class="titles"><div class="t brand">Move Ijuí</div></div></button>${AVATAR}`;
  const progress = step ? `<div class="step-bar"><i style="width:${(step[1] / step[2]) * 100}%"></i></div>` : "";
  sc.insertAdjacentHTML("afterbegin", `<header class="appbar">${STATUS}<div class="bar">${bar}</div>${progress}</header>`);
  if (sc.querySelector(".cta-bar")) sc.classList.add("has-cta");
  if (d.tabs) {
    sc.classList.add("has-tabs");
    const tabs = TABS[d.tabs].map(([id, icon, label, dot]) =>
      `<button data-go="${id}" class="${id === d.tab ? "on" : ""}"><span class="ms">${icon}</span>${label}${dot ? '<i class="dot"></i>' : ""}</button>`).join("");
    sc.insertAdjacentHTML("beforeend", `<nav class="tabbar">${tabs}</nav>`);
  }
}

// ---------- Roteador com transição deslizante ----------
const screens = Object.fromEntries($$(".screen").map(s => [s.id, s]));
let current = null, stack = [], autoTimer = null;

function show(id, dir) {
  if (!screens[id] || id === current) return;
  const next = screens[id], prev = current && screens[current];
  clearTimeout(autoTimer);
  next.querySelector(".content").scrollTop = 0;
  next.classList.remove("enter"); void next.offsetWidth; next.classList.add("enter");
  if (prev) {
    // dir 1 = avança, -1 = volta, 0 = troca suave (abas e fim de fluxo)
    next.style.transition = "none";
    next.style.transform = dir ? `translateX(${dir * 100}%)` : "none";
    next.style.opacity = dir ? "1" : "0";
    next.classList.add("active");
    prev.classList.remove("active"); prev.classList.add("leaving");
    void next.offsetWidth;
    next.style.transition = ""; prev.style.transition = "";
    next.style.transform = "none"; next.style.opacity = "1";
    prev.style.transform = dir ? `translateX(${-dir * 25}%)` : "none"; prev.style.opacity = dir ? ".6" : "0";
    setTimeout(() => { prev.classList.remove("leaving"); prev.style.transform = ""; prev.style.opacity = ""; }, 520);
  } else {
    next.classList.add("active");
  }
  current = id;
  onEnter(id);
  if (window.mapEnter) window.mapEnter(id); // mapas reais (mapa.js)
  if (window.onScreen) window.onScreen(id); // modo de teste (teste.js)
  window.parent !== window && window.parent.postMessage({ moveIjui: "screen", id }, "*");
}

function go(id, opts = {}) {
  if (!screens[id] || id === current) return;
  if (isOffline() && NEEDS_NET.includes(id)) return toast("Sem internet: pedir carro fica indisponível");
  // trocar de aba ou terminar um fluxo: recomeça o histórico e troca com fade
  const isTab = sc => sc && sc.dataset.tabs;
  if (opts.reset || (isTab(screens[id]) && isTab(screens[current]))) {
    stack = [];
    history.replaceState(null, "", "#" + id);
    return show(id, 0);
  }
  // voltar para a tela anterior conta como "voltar"
  if (stack.length && stack[stack.length - 1] === id) return back();
  // replace: a tela atual não entra no histórico (ex.: a busca, que já terminou)
  if (current && !opts.replace) stack.push(current);
  history.replaceState(null, "", "#" + id);
  show(id, 1);
}
function back(fallback) {
  const id = stack.pop() || fallback;
  if (!id) return;
  if (window.onBack) window.onBack(); // modo de teste (teste.js)
  history.replaceState(null, "", "#" + id);
  show(id, -1);
}
addEventListener("hashchange", () => { const id = location.hash.slice(1); if (screens[id] && id !== current) go(id); });
addEventListener("message", e => {
  const m = e.data; if (!m) return;
  if (m.moveIjui === "go") go(m.id);
  // simulações disparadas pelo painel do protótipo
  if (m.moveIjui === "simulate") {
    if (m.what === "offline") { setOffline(m.on); toast(m.on ? "Sem internet" : "Conectado de novo"); }
    if (m.what === "theme") setTheme(m.value);
    if (m.what === "driver-cancel") { state.cancelBy = "driver"; render(); go("s18", { replace: true }); }
  }
});

// ---------- Toast ----------
const toastEl = $("#toast"); let toastT;
function toast(msg) {
  toastEl.lastElementChild.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 2200);
}

// ---------- Estado compartilhado entre as telas ----------
// O que a pessoa escolhe numa tela aparece nas seguintes (destino, categoria, preço, horário).
const state = { dest: "Campus UNIJUÍ", destFull: "Campus UNIJUÍ • Portão 01", cat: "Move Pop", price: 14.5, when: "Agora", time: "09:00", cancelBy: "driver", arrived: false, pila: 38, pay: "Cartão Move Estudante", saldo: 24 };

// Tela 12 tem dois momentos: o motorista vem vindo, depois chega. A troca é na mesma tela.
function setArrived(on) {
  state.arrived = on;
  const sc = $("#s12");
  sc.classList.toggle("arrived", on);
  $(".bar .t", sc).textContent = on ? sc.dataset.titleArrived : sc.dataset.title;
}
const money = v => "R$ " + v.toFixed(2).replace(".", ",");
function render() {
  const val = {
    dest: state.dest, "dest-full": state.destFull, cat: state.cat, time: state.time,
    price: money(state.price), base: money(state.price + 2), pay: state.pay,
    when: state.when === "Agora" ? "agora" : "hoje às " + state.time,
  };
  $$("[data-s]").forEach(el => { if (val[el.dataset.s] !== undefined) el.textContent = val[el.dataset.s]; });
  $$("[data-show-when]").forEach(el => { el.style.display = el.dataset.showWhen === state.when ? "" : "none"; });
  $$("[data-cancel]").forEach(el => { el.style.display = el.dataset.cancel === state.cancelBy ? "" : "none"; });
  $$(".chip[data-when]").forEach(c => c.classList.toggle("on", c.dataset.when === state.when));
  $$(".chip[data-dest]").forEach(c => c.classList.toggle("on", c.dataset.dest.split("|")[0] === state.dest));
  $$("[data-pay] .item").forEach(c => c.classList.toggle("on-pay", c.dataset.name === state.pay));
  $$("[data-saldo]").forEach(el => { el.textContent = state.saldo.toFixed(2).replace(".", ","); });
  $$("[data-pick] .card").forEach(c => c.classList.toggle("on-pick", c.dataset.name === state.cat));
  // Favos: saldo, quanto falta para "Árvore" (50) e o que já dá para trocar
  $$("[data-pila]").forEach(el => { el.textContent = state.pila; });
  $$("[data-pila-next]").forEach(el => { el.textContent = Math.max(0, 50 - state.pila); });
  $$("[data-pila-bar]").forEach(el => { el.style.width = Math.min(100, state.pila / 50 * 100) + "%"; });
  $$('[data-action="redeem"]').forEach(b => b.classList.toggle("locked", +b.dataset.cost > state.pila));
  $("[data-pick-label]").textContent = `${state.when === "Agora" ? "Confirmar" : "Agendar"} ${state.cat} • ${money(state.price)}`;
}

// ---------- Tema claro/escuro ----------
// "auto" segue o celular; "light"/"dark" forçam. A escolha fica salva neste aparelho.
const THEME_KEY = "moveIjuiTema", THEMES = { auto: "Automático", dark: "Escuro", light: "Claro" };
const darkMQ = matchMedia("(prefers-color-scheme: dark)");
const URL_THEME = new URLSearchParams(location.search).get("tema"); // ?tema=dark|light|auto força o tema
function applyTheme(pref = (THEMES[URL_THEME] && URL_THEME) || localStorage.getItem(THEME_KEY) || "auto", animate = false) {
  const root = document.documentElement;
  if (pref === "auto") root.removeAttribute("data-theme"); else root.dataset.theme = pref;
  const dark = pref === "dark" || (pref === "auto" && darkMQ.matches);
  if (animate) { root.classList.add("theme-anim"); setTimeout(() => root.classList.remove("theme-anim"), 400); }
  root.classList.toggle("dark", dark);
  $('meta[name="theme-color"]').content = dark ? "#000000" : "#FFFFFF";
  $$('[data-s="theme"]').forEach(el => { el.textContent = THEMES[pref]; });
}
function setTheme(pref) { localStorage.setItem(THEME_KEY, pref); applyTheme(pref, true); }
darkMQ.addEventListener("change", () => applyTheme(undefined, true));
applyTheme();

// ---------- Sem internet ----------
const NEEDS_NET = ["s09", "s10", "s11", "s12", "s19"];
function setOffline(on) { document.body.classList.toggle("is-offline", on); }
const isOffline = () => document.body.classList.contains("is-offline");

// ---------- Cliques ----------
document.addEventListener("click", e => {
  // escolhas que alimentam o estado (podem vir junto com uma navegação)
  const sd = e.target.closest("[data-dest],[data-when],[data-time]");
  if (sd) {
    if (sd.dataset.dest) [state.dest, state.destFull] = sd.dataset.dest.split("|");
    if (sd.dataset.when) state.when = sd.dataset.when;
    if (sd.dataset.time) state.time = sd.dataset.time;
    render();
  }
  // atenção: a própria <section> tem data-back (destino do "voltar"), por isso só o botão conta
  const t = e.target.closest("[data-go],button[data-back],[data-action]");
  if (!t) return;
  if (t.hasAttribute("data-back")) return back(t.closest(".screen").dataset.back);
  if (t.dataset.go) { if (t.dataset.msg) setTimeout(() => toast(t.dataset.msg), 350); return go(t.dataset.go, { reset: t.hasAttribute("data-reset") }); }
  const a = t.dataset.action;
  if (a === "toast") toast(t.dataset.msg);
  if (a === "toggle") t.classList.toggle("on");
  if (a === "save") { const on = t.classList.toggle("saved"); t.firstElementChild.textContent = on ? "bookmark_added" : "bookmark_add"; toast(on ? "Trajeto salvo em Locais Salvos" : "Trajeto removido"); }
  if (a === "fav") { const on = t.classList.toggle("saved"); t.firstElementChild.classList.toggle("fill", on); toast(on ? "Ponto adicionado aos favoritos" : "Ponto removido dos favoritos"); }
  if (a === "accordion") { const list = t.nextElementSibling, open = t.classList.toggle("open"); list.style.maxHeight = open ? list.scrollHeight + "px" : "0"; t.querySelector(".grow").textContent = open ? "Ocultar paradas" : "Ver lista de 8 paradas"; }
  if (a === "swap") swapRoute();
  if (a === "online") toggleOnline(t);
  if (a === "accept") { toast("Corrida aceita! Siga até a Praça da República"); stopRing(); }
  if (a === "confirm-car") return go(state.when === "Agendar" ? "s19" : "s11");
  if (a === "try-pop") { state.cat = "Move Pop"; state.price = 14.5; render(); return go("s11"); }
  if (a === "cancel-ride") { state.cancelBy = "you"; render(); return go("s18", { replace: true }); }
  if (a === "theme") {
    const order = ["auto", "dark", "light"], cur = localStorage.getItem(THEME_KEY) || "auto";
    const next = order[(order.indexOf(cur) + 1) % order.length];
    setTheme(next); toast(`Aparência: ${THEMES[next]}`);
  }
  if (a === "redeem") {
    const cost = +t.dataset.cost;
    if (cost > state.pila) return toast(`Faltam ${cost - state.pila} favos para essa troca`);
    state.pila -= cost; render(); toast(`${t.dataset.msg} • −${cost} favos`);
  }
  if (a === "topup") { state.saldo += 20; render(); toast("Recarga de R$ 20,00 feita no cartão"); }
  if (a === "faq") { const q = t.parentElement, open = q.classList.toggle("open"); const p = q.querySelector("p"); p.style.maxHeight = open ? p.scrollHeight + 16 + "px" : "0"; }
  if (a === "add-place") return addPlace();
  if (a === "reconnect") { setOffline(false); toast("Conectado de novo"); }
  if (a === "decline") { stopRing(); $("[data-request]").style.display = "none"; $("[data-waiting]").style.display = ""; }
});

// Chips de segmento (uma opção ativa por grupo)
for (const g of $$("[data-seg]")) g.addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  $$(".chip", g).forEach(c => c.classList.toggle("on", c === b));
  if (g.dataset.bindTarget && b.dataset.value) $(`[data-bind="${g.dataset.bindTarget}"]`).textContent = b.dataset.value;
});

// Escolhas múltiplas
for (const g of $$(".choices")) g.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  const on = b.classList.toggle("on");
  const icon = b.querySelector(".ms");
  if (on && !icon) b.insertAdjacentHTML("afterbegin", '<span class="ms">check</span>');
  if (!on && icon) icon.remove();
});

// Estrelas
for (const box of $$("[data-stars]")) {
  const labels = box.dataset.labels.split("|"), out = box.parentElement.querySelector("[data-stars-label]") || box.nextElementSibling;
  const set = n => {
    $$("button", box).forEach((b, i) => b.classList.toggle("off", i >= n));
    const txt = labels[n - 1];
    out.textContent = box.classList.contains("dark") ? `${txt} (${n} de 5 estrelas)` : `${txt} (${n}/5)`;
  };
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button"); b.setAttribute("aria-label", `${i} estrela${i > 1 ? "s" : ""}`);
    b.innerHTML = '<span class="ms">star</span>'; b.onclick = () => set(i); box.appendChild(b);
  }
  set(+box.dataset.stars);
}

// Seleção de categoria (tela 10)
const pick = $("[data-pick]");
pick.addEventListener("click", e => {
  const c = e.target.closest(".card"); if (!c) return;
  state.cat = c.dataset.name; state.price = +c.dataset.price;
  render();
});

// Forma de pagamento (tela 23): a escolha aparece na categoria, na avaliação e no perfil
$("[data-pay]").addEventListener("click", e => {
  const c = e.target.closest(".item"); if (!c) return;
  state.pay = c.dataset.name; render(); toast(`Pagamento: ${state.pay}`);
});

// Adicionar local (tela 24): sugestões preenchem o formulário; salvar entra na lista do perfil
$$("[data-fill]").forEach(b => b.addEventListener("click", () => {
  const [n, ad] = b.dataset.fill.split("|"); $("#place-name").value = n; $("#place-addr").value = ad;
}));
function addPlace() {
  const name = $("#place-name").value.trim(), addr = $("#place-addr").value.trim();
  if (!name || !addr) return toast("Preencha nome e endereço");
  const icon = $("[data-place-type] .chip.on").dataset.icon;
  const it = document.createElement("button");
  it.className = "item"; it.dataset.go = "s02"; it.dataset.dest = `${name}|${name} • ${addr}`;
  it.innerHTML = `<span class="icon-sq"><span class="ms">${icon}</span></span><div class="grow"><div class="sb"></div><div class="small muted"></div></div><span class="ms chev">chevron_right</span>`;
  $(".sb", it).textContent = name; $(".small", it).textContent = addr;
  $("[data-places]").appendChild(it);
  toast(`${name} salvo nos seus locais`);
  back("s15");
}

// Inverter origem/destino
function swapRoute() {
  const sc = screens[current], a = $('[data-swap="a"]', sc), b = $('[data-swap="b"]', sc);
  if (!a || !b) return;
  [a.textContent, b.textContent] = [b.textContent, a.textContent];
  toast("Origem e destino invertidos");
}

// Modo motorista: online/offline
function toggleOnline(t) {
  const on = t.classList.toggle("on");
  $("[data-online-label]").textContent = on ? "Online" : "Offline";
  $("[data-online-dot]").style.background = on ? "var(--brand)" : "var(--line)";
}

// ---------- Ações ao entrar em cada tela ----------
let timerI, ringI;
// ?still = miniatura estática (galeria): sem cronômetros nem avanço automático
const STILL = new URLSearchParams(location.search).has("still");
function stopRing() { clearInterval(ringI); }
function onEnter(id) {
  clearInterval(timerI);
  // "Sem motoristas" sempre fala da categoria lotada (mesmo se aberta direto pela lista do protótipo)
  if (id === "s17" && state.cat !== "Move Família") { state.cat = "Move Família"; state.price = 24; render(); }
  if (STILL) return;
  const sc = screens[id];
  // nova busca = novo motorista, que ainda vai vir até você
  if (id === "s11") setArrived(false);
  // sem o mapa (sem internet para o Leaflet), o motorista chega por tempo
  if (id === "s12" && !window.L && !state.arrived) autoTimer = setTimeout(() => { setArrived(true); toast("Seu motorista chegou!"); }, 6000);
  // tela 11: cronômetro e avanço automático
  if (id === "s11") {
    let s = 0; const el = $("[data-timer]", sc);
    const bar = $(".searching", sc); bar.style.animation = "none"; void bar.offsetWidth; bar.style.animation = "";
    el.textContent = "00:00";
    timerI = setInterval(() => { s++; el.textContent = `00:${String(s).padStart(2, "0")}`; }, 1000);
  }
  // a busca termina em "motorista encontrado", ou em "sem motoristas" se a categoria estiver lotada (Move Família)
  if (sc.dataset.auto) {
    const target = id === "s11" && state.cat === "Move Família" ? "s17" : sc.dataset.auto;
    autoTimer = setTimeout(() => go(target, { replace: true }), +sc.dataset.autoMs || 4000);
  }
  // tela 16: contagem regressiva para aceitar
  if (id === "s16") {
    $("[data-request]").style.display = ""; $("[data-waiting]").style.display = "none";
    let n = 12; const ring = $(".ring", sc), b = $("[data-ring]", sc);
    ring.style.setProperty("--p", 1); b.textContent = n; stopRing();
    ringI = setInterval(() => {
      n--; b.textContent = Math.max(n, 0); ring.style.setProperty("--p", Math.max(n, 0) / 12);
      if (n <= 0) { stopRing(); $("[data-request]").style.display = "none"; $("[data-waiting]").style.display = ""; }
    }, 1000);
  } else stopRing();
}

// ---------- Gesto: arrastar da borda esquerda para voltar ----------
let sx = null;
addEventListener("touchstart", e => { sx = e.touches[0].clientX < 24 ? e.touches[0].clientX : null; }, { passive: true });
addEventListener("touchend", e => { if (sx !== null && e.changedTouches[0].clientX - sx > 80) back(screens[current].dataset.back); sx = null; });

// ---------- Início ----------
render();
if (new URLSearchParams(location.search).has("offline")) setOffline(true);
const first = location.hash.slice(1);
show(screens[first] ? first : "s01", 1);
