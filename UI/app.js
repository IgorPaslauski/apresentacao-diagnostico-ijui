import {
  ALERTS,
  OFFER_MS,
  STORAGE_KEY,
  TRIP,
  TRIP_NET_CENTS,
  formatBRL,
  grossFromNet,
} from "./data.js";
import { renderMap } from "./map.js";
import { createInitialState, deserialize, reduce, serialize } from "./state.js";

const params = new URLSearchParams(location.search);
const demoMode = params.get("modo") !== "normal";
const RING = 2 * Math.PI * 18;

const ICONS = {
  pin: '<path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z"/><circle cx="12" cy="11" r="2.2"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  person: '<circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.5c1.2-3 3.4-4.5 6.5-4.5s5.3 1.5 6.5 4.5"/>',
  car: '<path d="M4 15v2.5M20 15v2.5"/><path d="M5 15.5 6.8 9.2A2 2 0 0 1 8.7 8h6.6a2 2 0 0 1 1.9 1.2L19 15.5"/><path d="M4 15.5h16v3.2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="8" cy="16.2" r="0.8" fill="currentColor" stroke="none"/><circle cx="16" cy="16.2" r="0.8" fill="currentColor" stroke="none"/>',
  map: '<path d="M9 5 4 7v12l5-2 6 2 5-2V5l-5 2-6-2z"/><path d="M9 5v12M15 7v12"/>',
  earnings: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17"/><path d="M7 14h4"/>',
  alert: '<path d="M12 4 3.5 19h17L12 4z"/><path d="M12 10v4"/><path d="M12 16.5h.01"/>',
  back: '<path d="M15 6 9 12l6 6"/>',
  star: '<path d="m12 3.8 2.1 4.4 4.8.7-3.5 3.4.8 4.8L12 15l-4.2 2.1.8-4.8L5.1 8.9l4.8-.7L12 3.8z"/>',
  shield: '<path d="M12 3.5 6 6v5.2c0 3.4 2.4 6.4 6 7.3 3.6-.9 6-3.9 6-7.3V6l-6-2.5z"/>',
  card: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17"/>',
};

const TITLES = {
  map: ["Modo Motorista Parceiro", "Capital Nacional das Etnias"],
  earnings: ["Ganhos", ""],
  alerts: ["Alertas", ""],
  profile: ["Perfil", ""],
  offered: ["Modo Motorista Parceiro", "Move Ijuí • Capital Nacional das Etnias"],
  accepted: ["A caminho", ""],
  arrived: ["No embarque", ""],
  in_progress: ["Em viagem", ""],
  completed: ["Corrida concluída", ""],
};

let domain = createInitialState();
let ui = { confirm: false };
let renderKey = "";
let expireTimer = 0;
let autoTimer = 0;
let tickTimer = 0;
let toastTimer = 0;
let lastSecond = null;

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

function screenKey() {
  return domain.trip.phase === "idle" ? domain.nav : domain.trip.phase;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, serialize(domain));
  } catch {
    /* A demonstração segue em memória se o navegador bloquear o armazenamento. */
  }
}

function showToast(message) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

function dispatch(action, options = {}) {
  const result = reduce(domain, action, Date.now());
  if (!result.ok) {
    if (!options.silent) showToast(result.reason);
    return false;
  }
  domain = result.state;
  if (result.changed) persist();
  if (action.type === "EXPIRE_OFFER") showToast("Oferta expirada");
  if (action.type === "DECLINE_OFFER") showToast("Oferta recusada");
  if (action.type === "CONFIRM_FINISH") showToast("Valor lançado nos ganhos de hoje");
  if (action.type === "SET_AVAILABILITY") {
    showToast(domain.driver.availability === "online" ? "Você está disponível" : "Você está indisponível");
  }
  ui.confirm = false;
  syncClocks();
  render();
  return true;
}

function clearClocks() {
  clearTimeout(expireTimer);
  clearTimeout(autoTimer);
  clearInterval(tickTimer);
  expireTimer = 0;
  autoTimer = 0;
  tickTimer = 0;
}

function syncClocks() {
  clearClocks();
  if (domain.trip.phase === "offered" && typeof domain.trip.offerExpiresAt === "number") {
    const wait = domain.trip.offerExpiresAt - Date.now();
    if (wait <= 0) {
      dispatch({ type: "EXPIRE_OFFER" }, { silent: true });
      return;
    }
    expireTimer = setTimeout(() => dispatch({ type: "EXPIRE_OFFER" }, { silent: true }), wait);
    tickTimer = setInterval(paintCountdown, 200);
    paintCountdown();
  }
  if (!demoMode && domain.driver.availability === "online" && domain.trip.phase === "idle" && domain.nav === "map" && !domain.trip.offerConsumed && !domain.trip.settled) {
    autoTimer = setTimeout(() => dispatch({ type: "SHOW_OFFER" }, { silent: true }), 1000);
  }
}

function paintCountdown() {
  if (domain.trip.phase !== "offered" || typeof domain.trip.offerExpiresAt !== "number") return;
  const remain = Math.max(0, domain.trip.offerExpiresAt - Date.now());
  const seconds = Math.ceil(remain / 1000);
  const ring = document.querySelector("[data-ring]");
  const live = document.querySelector("[data-countdown-live]");
  if (seconds !== lastSecond) {
    document.querySelectorAll("[data-countdown]").forEach((label) => {
      label.textContent = String(seconds);
    });
    const badge = document.querySelector("[data-countdown-badge]");
    if (badge) badge.textContent = `${seconds}s`;
    lastSecond = seconds;
  }
  if (live) live.textContent = `A oferta expira em ${seconds} segundos`;
  if (ring) ring.style.strokeDashoffset = String(RING * (1 - remain / OFFER_MS));
  if (remain <= 0) syncClocks();
}

function header() {
  const key = screenKey();
  const [title, support] = TITLES[key];
  const headerEl = document.getElementById("header");
  const compact = key === "offered";
  headerEl.classList.toggle("compact", compact);
  const full = key === "map" || compact;
  headerEl.innerHTML = `
    <div class="brand-mark">${icon("pin")}</div>
    <div>
      ${compact ? "" : `<p class="overline">Move Ijuí</p>`}
      <h1>${esc(title)}</h1>
      ${full || support ? `<p class="support">${esc(support || "Capital Nacional das Etnias")}</p>` : ""}
    </div>`;
}

function tabbar() {
  const tabs = [
    ["map", "Mapa", "map"],
    ["earnings", "Ganhos", "earnings"],
    ["alerts", "Alertas", "alert"],
    ["profile", "Perfil", "person"],
  ];
  return `<nav class="tabbar" aria-label="Principal">${tabs
    .map(
      ([id, label, glyph]) =>
        `<button type="button" id="tab-${id}" data-action="tab" data-tab="${id}" ${domain.nav === id ? 'aria-current="page"' : ""}>${icon(glyph)}<span>${label}</span></button>`,
    )
    .join("")}</nav>`;
}

function actions(...buttons) {
  if (!buttons.length) return "";
  return `<div class="sheet-actions">${buttons.join("")}</div>`;
}

function primary(id, action, label) {
  return `<button type="button" class="btn btn-primary" id="${id}" data-action="${action}">${label}</button>`;
}

function ghost(id, action, label) {
  return `<button type="button" class="btn btn-ghost" id="${id}" data-action="${action}">${label}</button>`;
}

function moneyBlock() {
  const gross = grossFromNet(TRIP_NET_CENTS);
  return `<div class="money-detail">
    <div><span>Bruto estimado no protótipo</span><span>${formatBRL(gross.gross)}</span></div>
    <div><span>Taxa da cooperativa, 10%</span><span>${formatBRL(gross.fee)}</span></div>
    <div class="net"><span>Valor líquido</span><span>${formatBRL(TRIP_NET_CENTS)}</span></div>
    <p class="fine">O líquido de ${formatBRL(TRIP_NET_CENTS)} é o valor do projeto. O bruto é a conta deste protótipo.</p>
  </div>`;
}

function sheet(body, footer = "", extra = "") {
  return `<section class="sheet ${extra}"><div class="sheet-handle"></div><div class="sheet-body">${body}</div>${footer}</section>`;
}

function mapScreen(body, footer = "", chip = "", sheetClass = "") {
  return `<div class="screen screen-map"><div class="map-stage">${renderMap(domain.trip.phase)}${chip}<p class="map-caption">Mapa ilustrativo</p></div>${sheet(body, footer, sheetClass)}</div>`;
}

function statusCards(interactive) {
  const online = domain.driver.availability === "online";
  const toggle = interactive
    ? `<button type="button" class="pill-switch" id="toggle-availability" data-action="toggle" aria-pressed="${online ? "true" : "false"}"><span>${online ? "Ativo" : "Inativo"}</span><span class="pill-knob"></span></button>`
    : `<span class="pill-switch" aria-hidden="true"><span>Ativo</span><span class="pill-knob"></span></span>`;
  return `<div class="status-card">
      <span class="live-dot"></span>
      <div class="status-copy">
        <p class="kicker ${online ? "online" : "offline"}">${online ? "Online • Conectado" : "Offline"}</p>
        <p class="body">${esc(TRIP.cooperative)}</p>
      </div>
      ${toggle}
    </div>
    <div class="earn-banner">
      <span>${icon("earnings")} Ganhos de Hoje</span>
      <p><strong id="day-total">${formatBRL(domain.finances.dayNetCents)}</strong> <span id="trip-count">(${domain.finances.dayTrips} corridas)</span></p>
    </div>`;
}

function home() {
  const online = domain.driver.availability === "online";
  return mapScreen(
    `${statusCards(true)}
    <p class="subtle">${online ? "Disponível para corridas em Ijuí." : "Indisponível. Nenhuma corrida será oferecida."}</p>`,
    "",
  ) + tabbar();
}

function offer() {
  return `<div class="screen offer-screen">
    <div class="offer-scroll">
      <div class="offer-top">${statusCards(false)}</div>
      <div class="offer-map">
        ${renderMap("offered")}
        <div class="offer-map-fade">
          <p>${icon("pin")} Embarque a ${esc(TRIP.pickupDistance)} (${esc(TRIP.pickupTime)})</p>
          <span>Praça da República</span>
        </div>
      </div>
      <article class="offer-card">
        <div class="offer-topbar">
          <div class="offer-pills">
            <span class="pop-chip">${icon("car")} Move Pop</span>
            <span class="fee-chip">Taxa Coop 10%</span>
          </div>
          <div class="timer">
            <svg viewBox="0 0 44 44" aria-hidden="true">
              <circle class="timer-track" cx="22" cy="22" r="18"></circle>
              <circle class="timer-value" data-ring cx="22" cy="22" r="18" stroke-dasharray="${RING}" stroke-dashoffset="0"></circle>
            </svg>
            <strong data-countdown>12</strong>
          </div>
        </div>
        <p class="sr-only" data-countdown-live>A oferta expira em 12 segundos</p>
        <div class="payout">
          <div>
            <p class="eyebrow">Valor líquido estimado</p>
            <p class="payout-value">${formatBRL(TRIP_NET_CENTS)}</p>
          </div>
          <p class="payout-meta"><span>Total Viagem</span><strong>${esc(TRIP.tripDistance)} • ${esc(TRIP.tripTime)}</strong></p>
        </div>
        <div class="person offer-person">
          <div class="avatar" aria-hidden="true">MS</div>
          <div>
            <strong>${esc(TRIP.passenger)} <span class="stars-inline">${icon("star")} ${esc(TRIP.rating)}</span></strong>
            <p class="subtle">${esc(TRIP.detail)}</p>
          </div>
          <span class="shield" aria-hidden="true">${icon("shield")}</span>
        </div>
        <div class="timeline">
          <div class="timeline-stop">
            <span class="timeline-mark"></span>
            <div>
              <p class="eyebrow pickup">Embarque <span>• ${esc(TRIP.pickupDistance)} de você</span></p>
              <strong>${esc(TRIP.origin)}</strong>
              <p class="subtle">${esc(TRIP.originNote)}</p>
            </div>
          </div>
          <div class="timeline-stop">
            <span class="timeline-mark dest"></span>
            <div>
              <p class="eyebrow dest">Destino final</p>
              <strong>${esc(TRIP.destination)}</strong>
              <p class="subtle">${esc(TRIP.destinationNote)}</p>
            </div>
          </div>
        </div>
        <div class="pay-pill">
          ${icon("card")}
          <div>
            <p class="eyebrow pickup">Move Card Digital</p>
            <p class="body">Cresol/Sicredi. O protótipo não liquida crédito.</p>
          </div>
        </div>
        <div class="safety-note">${icon("alert")} Interação permitida apenas com o veículo parado. Dirija com atenção pela cidade.</div>
      </article>
    </div>
    <div class="offer-actions">
      <button type="button" class="accept-ride" id="accept-offer" data-action="accept">
        <span>
          <strong>Aceitar corrida</strong>
          <small>Navegar direto para Praça da República</small>
        </span>
        <em data-countdown-badge>12s</em>
      </button>
      <button type="button" class="decline-ride" id="decline-offer" data-action="decline">Recusar (passar para o próximo cooperado)</button>
    </div>
  </div>`;
}

function accepted() {
  return mapScreen(
    `<p class="eyebrow">${esc(TRIP.vehicle)}</p>
    <h2 class="section" style="margin-top:4px">${esc(TRIP.passenger)}</h2>
    <div class="stop">
      <span class="dot"></span>
      <div>
        <p class="eyebrow">Embarque · ${esc(TRIP.pickupDistance)} · ${esc(TRIP.pickupTime)}</p>
        <strong>${esc(TRIP.origin)}</strong>
        <p class="subtle">${esc(TRIP.originNote)}</p>
      </div>
    </div>
    <p class="subtle">${esc(TRIP.approach)}.</p>
    <p class="fine">Estimativa da oferta, sem rastreamento.</p>`,
    actions(primary("arrive", "arrive", "Cheguei ao local")),
  );
}

function arrived() {
  return mapScreen(
    `<p class="kicker online">Aguardando embarque</p>
    <h2 class="section">${esc(TRIP.passenger)}</h2>
    <p class="body">Você está na ${esc(TRIP.origin)}, em frente ao coreto.</p>
    <p class="subtle">A corrida começa quando ela embarcar.</p>`,
    actions(primary("start-trip", "start", "Iniciar corrida")),
  );
}

function riding() {
  return mapScreen(
    `<p class="kicker online">Viagem em andamento</p>
    <h2 class="section">${esc(TRIP.passenger)} embarcou</h2>
    <div class="stop">
      <span class="dot dest"></span>
      <div>
        <p class="eyebrow">Destino · ${esc(TRIP.tripDistance)} · ${esc(TRIP.tripTime)}</p>
        <strong>${esc(TRIP.destination)}</strong>
        <p class="subtle">${esc(TRIP.destinationNote)}</p>
      </div>
    </div>
    <div class="notice">
      <strong>Desvio no percurso</strong>
      <p>Av. 21 de Abril interditada e alagamento na Praça dos Imigrantes. Siga pela Av. Getúlio Vargas até o Portão 01.</p>
    </div>`,
    actions(primary("ask-finish", "ask-finish", "Finalizar corrida")),
    `<p class="map-chip">Desvio pela Av. Getúlio Vargas</p>`,
  );
}

function completed() {
  const stars = [1, 2, 3, 4, 5]
    .map(
      (value) =>
        `<button type="button" data-action="rate" data-value="${value}" aria-pressed="${domain.trip.rating >= value ? "true" : "false"}" aria-label="${value} ${value === 1 ? "estrela" : "estrelas"}">★</button>`,
    )
    .join("");
  return mapScreen(
    `<p class="kicker online">Corrida concluída</p>
    <h2 class="section">${esc(TRIP.passenger)}</h2>
    <p class="body">${esc(TRIP.origin)} → ${esc(TRIP.destination)}</p>
    <p class="hero-number" style="margin-top:8px">${formatBRL(TRIP_NET_CENTS)}</p>
    <p class="subtle">Pagamento por ${esc(TRIP.payment)}</p>
    ${moneyBlock()}
    <p class="eyebrow" style="margin-top:16px">Avaliação da passageira</p>
    <div class="stars" role="group" aria-label="Avaliação da passageira">${stars}</div>
    <p class="fine">A avaliação é opcional.</p>`,
    actions(primary("conclude", "conclude", "Concluir")),
  );
}

function earnings() {
  const featured = domain.finances.history.find((item) => item.id === TRIP.id);
  const rows = domain.finances.history
    .filter((item) => item.demonstrative)
    .map(
      (item, index) =>
        `<li><span class="badge">Demonstrativo</span><div><strong>Registro ${index + 1}</strong><p class="subtle">Dado de apresentação, sem horário oficial.</p></div><strong>${formatBRL(item.cents)}</strong></li>`,
    )
    .join("");
  return `<div class="screen"><div class="page">
    <p class="eyebrow">Total recebido no dia</p>
    <p class="hero-number" id="day-total">${formatBRL(domain.finances.dayNetCents)}</p>
    <p class="support" id="trip-count">${domain.finances.dayTrips} corridas</p>
    <h2 class="section">Corrida da demonstração</h2>
    ${
      featured
        ? `<p class="body">${esc(featured.passenger)}</p><p class="subtle">${esc(featured.origin)} → ${esc(featured.destination)}</p><p class="subtle">${esc(featured.payment)}</p>${moneyBlock()}`
        : `<p class="body">Ela entra neste painel quando a corrida de Mariana Silva for concluída.</p>`
    }
    <h2 class="section">Registros do dia</h2>
    <ul class="list">${rows}</ul>
    <p class="fine">Os oito registros demonstrativos somam ${formatBRL(14280)} e não são corridas reais.</p>
  </div>${tabbar()}</div>`;
}

function alerts() {
  const items = ALERTS.map(
    (alert) => `<article class="alert alert-${alert.severity}">
      <span class="alert-icon">${icon(alert.severity === "route" ? "map" : "alert")}</span>
      <div>
        <p class="eyebrow">${esc(alert.kicker)}</p>
        <h2>${esc(alert.title)}</h2>
        <p class="body">${esc(alert.text)}</p>
      </div>
    </article>`,
  ).join("");
  return `<div class="screen"><div class="page"><p class="body">Condições do percurso ilustrado até o campus.</p>${items}</div>${tabbar()}</div>`;
}

function profile() {
  const online = domain.driver.availability === "online";
  return `<div class="screen"><div class="page">
    <section class="profile-block">
      <p class="eyebrow">Cooperativa</p>
      <h2>${esc(TRIP.cooperative)}</h2>
      <p class="subtle">Identidade do modo motorista parceiro.</p>
    </section>
    <section class="profile-block">
      <p class="eyebrow">Veículo</p>
      <h2>${esc(TRIP.vehicle)}</h2>
      <p class="subtle">Categoria ${esc(TRIP.category)}</p>
    </section>
    <section class="profile-block">
      <p class="eyebrow">Situação</p>
      <h2>${online ? "Disponível" : "Indisponível"}</h2>
    </section>
    <section class="profile-block profile-grid">
      <div><p class="eyebrow">Ganhos de hoje</p><p class="number">${formatBRL(domain.finances.dayNetCents)}</p></div>
      <div><p class="eyebrow">Corridas</p><p class="number">${domain.finances.dayTrips}</p></div>
    </section>
  </div>${tabbar()}</div>`;
}

function render() {
  const key = `${domain.trip.phase}|${domain.nav}|${domain.driver.availability}|${domain.trip.settled}|${ui.confirm}`;
  const phone = document.getElementById("phone");
  phone.dataset.phase = domain.trip.phase;
  phone.dataset.availability = domain.driver.availability;
  const same = key === renderKey;
  renderKey = key;
  syncDemo();
  if (same && domain.trip.phase === "completed") {
    updateStars();
    return;
  }
  if (same) return;
  header();
  const views = {
    map: home,
    earnings,
    alerts,
    profile,
    offered: offer,
    accepted,
    arrived,
    in_progress: riding,
    completed,
  };
  document.getElementById("view").innerHTML = (domain.trip.phase === "idle" ? views[domain.nav] : views[domain.trip.phase])();
  document.getElementById("dialog-root").innerHTML = ui.confirm ? dialog() : "";
  if (ui.confirm) document.getElementById("confirm-finish")?.focus();
  lastSecond = null;
  paintCountdown();
}

function updateStars() {
  document.querySelectorAll("[data-action='rate']").forEach((button) => {
    button.setAttribute("aria-pressed", domain.trip.rating >= Number(button.dataset.value) ? "true" : "false");
  });
}

function dialog() {
  return `<div class="scrim"><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="finish-title">
    <h2 id="finish-title">Finalizar a corrida?</h2>
    <p>${formatBRL(TRIP_NET_CENTS)} entram nos ganhos do dia. ${esc(TRIP.payment)} permanece como forma de pagamento, sem liquidação.</p>
    <div class="dialog-actions">
      <button type="button" class="btn btn-secondary" id="cancel-finish" data-action="cancel-finish">Voltar</button>
      <button type="button" class="btn btn-primary" id="confirm-finish" data-action="confirm-finish">Finalizar</button>
    </div>
  </div></div>`;
}

function syncDemo() {
  const note = document.getElementById("demo-note");
  const offerBtn = document.getElementById("demo-offer");
  const expireBtn = document.getElementById("demo-expire");
  if (note) {
    note.textContent = demoMode
      ? "A oferta não dispara sozinha. Use os botões abaixo. Servidor local: python -m http.server 5500"
      : "Modo normal: a primeira oferta chega sozinha no mapa.";
  }
  if (offerBtn) {
    offerBtn.disabled = !(domain.trip.phase === "idle" && domain.driver.availability === "online" && !domain.trip.settled);
  }
  if (expireBtn) expireBtn.disabled = domain.trip.phase !== "offered";
}

function onClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === "toggle") {
    dispatch({ type: "SET_AVAILABILITY", availability: domain.driver.availability === "online" ? "offline" : "online" });
    return;
  }
  if (action === "tab") {
    dispatch({ type: "OPEN_TAB", tab: button.dataset.tab });
    return;
  }
  if (action === "ask-finish") {
    if (domain.trip.phase !== "in_progress") {
      showToast("A corrida ainda não começou.");
      return;
    }
    ui.confirm = true;
    renderKey = "";
    render();
    return;
  }
  if (action === "cancel-finish") {
    ui.confirm = false;
    renderKey = "";
    render();
    return;
  }
  if (action === "rate") {
    dispatch({ type: "SET_RATING", rating: Number(button.dataset.value) });
    return;
  }
  if (action === "conclude") {
    const rated = domain.trip.rating != null;
    if (dispatch({ type: "FINISH_REVIEW" })) showToast(rated ? "Avaliação registrada" : "Corrida encerrada");
    return;
  }
  const types = {
    accept: "ACCEPT_OFFER",
    decline: "DECLINE_OFFER",
    arrive: "ARRIVE",
    start: "START_TRIP",
    "confirm-finish": "CONFIRM_FINISH",
  };
  if (types[action]) dispatch({ type: types[action] });
}

function boot() {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  domain = raw ? deserialize(raw, Date.now()) : createInitialState();
  persist();
  document.getElementById("phone").addEventListener("click", onClick);
  document.getElementById("demo-reset").addEventListener("click", () => dispatch({ type: "RESET" }));
  document.getElementById("demo-offer").addEventListener("click", () => dispatch({ type: "SHOW_OFFER", manual: true }));
  document.getElementById("demo-expire").addEventListener("click", () => dispatch({ type: "EXPIRE_OFFER" }));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && ui.confirm) {
      ui.confirm = false;
      renderKey = "";
      render();
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncClocks();
  });
  window.addEventListener("pageshow", () => syncClocks());
  render();
  syncClocks();
}

boot();
