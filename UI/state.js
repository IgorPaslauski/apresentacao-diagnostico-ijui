import {
  DAY_START_CENTS,
  DAY_START_TRIPS,
  DEMO_HISTORY,
  OFFER_MS,
  TRIP,
  TRIP_NET_CENTS,
} from "./data.js";

const PHASES = ["idle", "offered", "accepted", "arrived", "in_progress", "completed"];
const TABS = ["map", "earnings", "alerts", "profile"];

export function createInitialState() {
  return {
    driver: { availability: "online" },
    nav: "map",
    trip: {
      phase: "idle",
      offerConsumed: false,
      offerExpiresAt: null,
      settled: false,
      rating: null,
    },
    finances: {
      dayNetCents: DAY_START_CENTS,
      dayTrips: DAY_START_TRIPS,
      history: DEMO_HISTORY.map((item) => ({ ...item })),
    },
  };
}

function clone(state) {
  return {
    driver: { ...state.driver },
    nav: state.nav,
    trip: { ...state.trip },
    finances: {
      dayNetCents: state.finances.dayNetCents,
      dayTrips: state.finances.dayTrips,
      history: state.finances.history.map((item) => ({ ...item })),
    },
  };
}

function ok(state) {
  return { ok: true, state, changed: true };
}

function same(state) {
  return { ok: true, state, changed: false };
}

function fail(state, reason) {
  return { ok: false, state, changed: false, reason };
}

function demoHistoryMatches(list) {
  if (!Array.isArray(list) || list.length !== DEMO_HISTORY.length) return false;
  return list.every(
    (item, index) =>
      item &&
      item.id === DEMO_HISTORY[index].id &&
      item.cents === DEMO_HISTORY[index].cents &&
      item.demonstrative === true,
  );
}

function realTripMatches(item) {
  return (
    item &&
    item.id === TRIP.id &&
    item.cents === TRIP_NET_CENTS &&
    item.demonstrative === false &&
    item.passenger === TRIP.passenger &&
    item.origin === TRIP.origin &&
    item.destination === TRIP.destination &&
    item.payment === TRIP.payment
  );
}

export function validateState(input) {
  if (!input || typeof input !== "object" || !input.trip || !input.finances) return null;
  const phase = input.trip.phase;
  if (!PHASES.includes(phase)) return null;
  const availability = input.driver?.availability;
  if (availability !== "online" && availability !== "offline") return null;
  if (!TABS.includes(input.nav)) return null;

  const trip = input.trip;
  if (typeof trip.offerConsumed !== "boolean" || typeof trip.settled !== "boolean") return null;
  if (phase === "offered" && (typeof trip.offerExpiresAt !== "number" || !Number.isFinite(trip.offerExpiresAt))) {
    return null;
  }
  if (phase === "completed" && !trip.settled) return null;
  if (trip.settled && phase !== "completed" && phase !== "idle") return null;

  const ratingOk =
    phase === "completed"
      ? trip.rating === null || (Number.isInteger(trip.rating) && trip.rating >= 1 && trip.rating <= 5)
      : trip.rating === null;
  if (!ratingOk) return null;

  const { history, dayNetCents, dayTrips } = input.finances;
  if (!Array.isArray(history)) return null;
  if (trip.settled) {
    if (dayNetCents !== DAY_START_CENTS + TRIP_NET_CENTS || dayTrips !== DAY_START_TRIPS + 1) return null;
    if (!realTripMatches(history[0]) || !demoHistoryMatches(history.slice(1))) return null;
  } else if (dayNetCents !== DAY_START_CENTS || dayTrips !== DAY_START_TRIPS || !demoHistoryMatches(history)) {
    return null;
  }

  return {
    driver: { availability },
    nav: phase === "idle" ? input.nav : "map",
    trip: {
      phase,
      offerConsumed: trip.offerConsumed,
      offerExpiresAt: phase === "offered" ? trip.offerExpiresAt : null,
      settled: trip.settled,
      rating: phase === "completed" ? trip.rating : null,
    },
    finances: {
      dayNetCents,
      dayTrips,
      history: history.map((item) => ({ ...item })),
    },
  };
}

export function reduce(state, action, now = Date.now()) {
  switch (action?.type) {
    case "SET_AVAILABILITY": {
      if (state.trip.phase !== "idle") {
        return fail(state, "A disponibilidade muda quando não há corrida em andamento.");
      }
      if (action.availability !== "online" && action.availability !== "offline") {
        return fail(state, "Situação inválida.");
      }
      if (state.driver.availability === action.availability) return same(state);
      const next = clone(state);
      next.driver.availability = action.availability;
      return ok(next);
    }
    case "OPEN_TAB": {
      if (state.trip.phase !== "idle") {
        return fail(state, "A navegação volta quando a corrida terminar.");
      }
      if (!TABS.includes(action.tab)) return fail(state, "Aba inválida.");
      if (state.nav === action.tab) return same(state);
      const next = clone(state);
      next.nav = action.tab;
      return ok(next);
    }
    case "SHOW_OFFER": {
      if (state.trip.phase !== "idle") return fail(state, "A oferta só chega com o motorista livre.");
      if (state.driver.availability !== "online") return fail(state, "Fique disponível para receber corridas.");
      if (state.trip.settled) {
        return fail(state, "Esta corrida já foi contabilizada. Reinicie o cenário para repetir.");
      }
      if (action.manual !== true && state.trip.offerConsumed) {
        return fail(state, "A oferta desta demonstração já foi encerrada.");
      }
      if (action.manual !== true && state.nav !== "map") return fail(state, "Volte ao mapa para receber a corrida.");
      const next = clone(state);
      next.nav = "map";
      next.trip.phase = "offered";
      next.trip.offerExpiresAt = now + OFFER_MS;
      return ok(next);
    }
    case "ACCEPT_OFFER": {
      if (state.trip.phase !== "offered") return fail(state, "Não há oferta para aceitar.");
      if (state.driver.availability !== "online") return fail(state, "Fique disponível para aceitar corridas.");
      const next = clone(state);
      next.trip.phase = "accepted";
      next.trip.offerExpiresAt = null;
      return ok(next);
    }
    case "DECLINE_OFFER":
    case "EXPIRE_OFFER": {
      if (state.trip.phase !== "offered") return fail(state, "Não há oferta ativa.");
      const next = clone(state);
      next.trip.phase = "idle";
      next.trip.offerConsumed = true;
      next.trip.offerExpiresAt = null;
      next.nav = "map";
      return ok(next);
    }
    case "ARRIVE": {
      if (state.trip.phase !== "accepted") return fail(state, "O embarque ainda não está a caminho.");
      const next = clone(state);
      next.trip.phase = "arrived";
      return ok(next);
    }
    case "START_TRIP": {
      if (state.trip.phase !== "arrived") return fail(state, "Confirme a chegada antes de iniciar a corrida.");
      const next = clone(state);
      next.trip.phase = "in_progress";
      return ok(next);
    }
    case "CONFIRM_FINISH": {
      if (state.trip.phase !== "in_progress") return fail(state, "A corrida ainda não começou.");
      if (state.trip.settled || state.finances.history.some((item) => item.id === TRIP.id)) {
        return fail(state, "Esta corrida já foi contabilizada.");
      }
      const next = clone(state);
      next.trip.phase = "completed";
      next.trip.settled = true;
      next.trip.offerConsumed = true;
      next.trip.offerExpiresAt = null;
      next.trip.rating = null;
      next.finances.dayNetCents += TRIP_NET_CENTS;
      next.finances.dayTrips += 1;
      next.finances.history.unshift({
        id: TRIP.id,
        cents: TRIP_NET_CENTS,
        demonstrative: false,
        passenger: TRIP.passenger,
        origin: TRIP.origin,
        destination: TRIP.destination,
        payment: TRIP.payment,
      });
      return ok(next);
    }
    case "SET_RATING": {
      if (state.trip.phase !== "completed") return fail(state, "A avaliação fica disponível ao encerrar a corrida.");
      if (!Number.isInteger(action.rating) || action.rating < 1 || action.rating > 5) {
        return fail(state, "Escolha de 1 a 5 estrelas.");
      }
      if (state.trip.rating === action.rating) return same(state);
      const next = clone(state);
      next.trip.rating = action.rating;
      return ok(next);
    }
    case "FINISH_REVIEW": {
      if (state.trip.phase !== "completed") return fail(state, "A corrida ainda não foi encerrada.");
      const next = clone(state);
      next.trip.phase = "idle";
      next.trip.rating = null;
      next.trip.offerConsumed = true;
      next.nav = "map";
      return ok(next);
    }
    case "RESET":
      return ok(createInitialState());
    default:
      return fail(state, "Ação indisponível.");
  }
}

export function serialize(state) {
  return JSON.stringify({ version: 1, state });
}

export function deserialize(raw, now = Date.now()) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1) return createInitialState();
    const valid = validateState(parsed.state);
    if (!valid) return createInitialState();
    if (valid.trip.phase === "offered" && !(valid.trip.offerExpiresAt > now)) {
      return reduce(valid, { type: "EXPIRE_OFFER" }, now).state;
    }
    return valid;
  } catch {
    return createInitialState();
  }
}
