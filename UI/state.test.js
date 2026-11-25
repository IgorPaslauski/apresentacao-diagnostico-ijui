import assert from "node:assert/strict";
import test from "node:test";
import { DAY_START_CENTS, DAY_START_TRIPS, OFFER_MS, TRIP_NET_CENTS, grossFromNet } from "./data.js";
import { createInitialState, deserialize, reduce, serialize } from "./state.js";

function step(state, type, now, extra = {}) {
  const result = reduce(state, { type, ...extra }, now);
  assert.equal(result.ok, true, result.reason || type);
  return result.state;
}

function reach(phase, now = 5_000_000) {
  let state = createInitialState();
  if (phase === "idle") return { state, now };
  state = step(state, "SHOW_OFFER", now);
  now += 1000;
  if (phase === "offered") return { state, now };
  state = step(state, "ACCEPT_OFFER", now);
  now += 1000;
  if (phase === "accepted") return { state, now };
  state = step(state, "ARRIVE", now);
  now += 1000;
  if (phase === "arrived") return { state, now };
  state = step(state, "START_TRIP", now);
  now += 1000;
  if (phase === "in_progress") return { state, now };
  state = step(state, "CONFIRM_FINISH", now);
  return { state, now };
}

test("o bruto estimado fecha com a taxa de 10%", () => {
  const money = grossFromNet(TRIP_NET_CENTS);
  assert.equal(money.gross, 1422);
  assert.equal(money.fee, 142);
});

test("recusa e expiração preservam os ganhos", () => {
  for (const type of ["DECLINE_OFFER", "EXPIRE_OFFER"]) {
    const offered = step(createInitialState(), "SHOW_OFFER", 10_000);
    const next = step(offered, type, 11_000);
    assert.equal(next.trip.phase, "idle");
    assert.equal(next.trip.offerConsumed, true);
    assert.equal(next.finances.dayNetCents, DAY_START_CENTS);
    assert.equal(next.finances.dayTrips, DAY_START_TRIPS);
  }
});

test("offline não recebe nem aceita oferta", () => {
  const offline = step(createInitialState(), "SET_AVAILABILITY", 1, { availability: "offline" });
  const blocked = reduce(offline, { type: "SHOW_OFFER", manual: true }, 2);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.state.finances.dayNetCents, DAY_START_CENTS);
});

test("aceite, viagem e pagamento acontecem uma vez", () => {
  const { state } = reach("completed");
  assert.equal(state.finances.dayNetCents, DAY_START_CENTS + TRIP_NET_CENTS);
  assert.equal(state.finances.dayTrips, DAY_START_TRIPS + 1);
  assert.equal(state.finances.history[0].id, "mariana-silva");
  const again = reduce(state, { type: "CONFIRM_FINISH" }, 9);
  assert.equal(again.ok, false);
  assert.equal(again.state.finances.dayNetCents, 15560);
  const reviewed = step(state, "FINISH_REVIEW", 9);
  const replay = reduce(reviewed, { type: "CONFIRM_FINISH" }, 10);
  assert.equal(replay.ok, false);
  assert.equal(replay.state.finances.dayNetCents, 15560);
  assert.equal(replay.state.finances.dayTrips, 9);
});

test("transições fora de ordem não mudam o estado", () => {
  const idle = createInitialState();
  for (const type of ["ARRIVE", "START_TRIP", "CONFIRM_FINISH", "ACCEPT_OFFER"]) {
    const result = reduce(idle, { type }, 1);
    assert.equal(result.ok, false);
    assert.equal(result.state.trip.phase, "idle");
    assert.equal(result.state.finances.dayNetCents, DAY_START_CENTS);
  }
  const accepted = reach("accepted").state;
  assert.equal(reduce(accepted, { type: "START_TRIP" }, 1).ok, false);
  assert.equal(reduce(accepted, { type: "CONFIRM_FINISH" }, 1).ok, false);
});

test("abas só abrem com o motorista livre", () => {
  const idle = createInitialState();
  assert.equal(step(idle, "OPEN_TAB", 1, { tab: "earnings" }).nav, "earnings");
  for (const phase of ["offered", "accepted", "arrived", "in_progress", "completed"]) {
    const current = reach(phase).state;
    const result = reduce(current, { type: "OPEN_TAB", tab: "alerts" }, 1);
    assert.equal(result.ok, false);
    assert.equal(result.state.nav, current.nav);
    assert.equal(result.state.trip.phase, phase);
  }
});

test("a oferta manual repete recusa e não repete corrida paga", () => {
  let state = step(createInitialState(), "SHOW_OFFER", 1000);
  state = step(state, "DECLINE_OFFER", 2000);
  state = step(state, "SHOW_OFFER", 3000, { manual: true });
  assert.equal(state.trip.phase, "offered");
  const paid = step(reach("completed").state, "FINISH_REVIEW", 4000);
  const again = reduce(paid, { type: "SHOW_OFFER", manual: true }, 5000);
  assert.equal(again.ok, false);
  assert.equal(again.state.finances.dayNetCents, 15560);
});

test("recarregar preserva o horário absoluto da oferta", () => {
  const started = 1_000_000;
  const offered = step(createInitialState(), "SHOW_OFFER", started);
  const raw = serialize(offered);
  const loaded = deserialize(raw, started + 5000);
  assert.equal(loaded.trip.phase, "offered");
  assert.equal(loaded.trip.offerExpiresAt, started + OFFER_MS);
});

test("recarregar depois do prazo expira sem pagamento", () => {
  const started = 2_000_000;
  const offered = step(createInitialState(), "SHOW_OFFER", started);
  const loaded = deserialize(serialize(offered), started + OFFER_MS + 1);
  assert.equal(loaded.trip.phase, "idle");
  assert.equal(loaded.trip.offerConsumed, true);
  assert.equal(loaded.finances.dayNetCents, DAY_START_CENTS);
});

test("recarregar no meio da viagem e depois do pagamento", () => {
  const riding = reach("in_progress").state;
  const mid = deserialize(serialize(riding), 8_000_000);
  assert.equal(mid.trip.phase, "in_progress");
  assert.equal(mid.finances.dayNetCents, DAY_START_CENTS);
  const done = reach("completed").state;
  const after = deserialize(serialize(done), 9_000_000);
  assert.equal(after.trip.phase, "completed");
  assert.equal(after.finances.dayNetCents, 15560);
  assert.equal(after.finances.dayTrips, 9);
});

test("armazenamento corrompido volta ao cenário inicial", () => {
  for (const raw of ["{", "null", JSON.stringify({ version: 2 }), JSON.stringify({ version: 1, state: { trip: { phase: "offered" } } })]) {
    const state = deserialize(raw, 1);
    assert.equal(state.trip.phase, "idle");
    assert.equal(state.finances.dayNetCents, DAY_START_CENTS);
    assert.equal(state.finances.dayTrips, DAY_START_TRIPS);
  }
});

test("reiniciar o cenário zera a demonstração", () => {
  const done = reach("completed").state;
  const reset = step(done, "RESET", 1);
  assert.equal(reset.trip.phase, "idle");
  assert.equal(reset.trip.settled, false);
  assert.equal(reset.driver.availability, "online");
  assert.equal(reset.finances.dayNetCents, DAY_START_CENTS);
  assert.equal(reset.finances.history.some((item) => item.id === "mariana-silva"), false);
});
