// Move Ijuí — mapas reais (OpenStreetMap + Leaflet).
// O modo escuro usa os mesmos quadros com um filtro de cor (tema-escuro.css), sem precisar de chave de API.
// Cada tela com <div class="map" data-map="..."> ganha um mapa de verdade de Ijuí, criado só quando
// a tela abre. Nas telas de viagem o veículo anda pela rota real (rotas.js) em tempo acelerado.
(() => {
  if (!window.L) return; // sem internet para carregar o Leaflet: as telas continuam funcionando sem mapa

  const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const ATTR = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
  const P = window.LUGARES, R = window.ROTAS;
  const PRACA = P["Praça da República"], EU = [-28.3895, -53.9162];
  const isDark = () => document.documentElement.classList.contains("dark");
  const lineColor = () => (isDark() ? "#5FD394" : "#00522F");
  const still = () => typeof STILL !== "undefined" && STILL;

  // ---------- Marcadores (reaproveitam os estilos .pin do app) ----------
  const icon = html => L.divIcon({ className: "mi", html, iconSize: [0, 0] });
  const I = {
    me: () => icon('<div class="pin me"><span class="bubble pulse"></span></div>'),
    bus: () => icon('<div class="pin big"><span class="bubble pulse"><span class="ms">directions_bus</span></span></div>'),
    carBig: () => icon('<div class="pin big"><span class="bubble"><span class="ms">directions_car</span></span></div>'),
    car: () => icon('<div class="pin"><span class="bubble"><span class="ms">directions_car</span></span></div>'),
    line: n => icon(`<div class="pin"><span class="bubble line-no">${n}</span></div>`),
    dest: () => icon('<div class="pin"><span class="bubble dest-dot"></span></div>'),
    radar: () => icon('<div class="radar"><i></i><i></i><i></i><div class="pin big" style="left:0;top:0"><span class="bubble"><span class="ms">person_pin_circle</span></span></div></div>'),
  };

  // ---------- Utilidades de rota ----------
  function measure(path) {
    const d = [0];
    for (let i = 1; i < path.length; i++) d.push(d[i - 1] + L.latLng(path[i - 1]).distanceTo(path[i]));
    return d;
  }
  // ponto da rota numa fração (0..1) do comprimento, e o trecho já percorrido
  function along(path, dist, f) {
    const target = dist[dist.length - 1] * Math.min(Math.max(f, 0), 1);
    let i = 1; while (i < dist.length - 1 && dist[i] < target) i++;
    const seg = dist[i] - dist[i - 1] || 1, k = (target - dist[i - 1]) / seg;
    const a = path[i - 1], b = path[i];
    const pt = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    return { pt, done: [...path.slice(0, i), pt], ahead: [pt, ...path.slice(i)] };
  }
  const km = m => (m >= 1000 ? (m / 1000).toFixed(1).replace(".", ",") + " km" : Math.round(m / 10) * 10 + " m");
  const set = (sel, v) => document.querySelectorAll(sel).forEach(el => { el.textContent = v; });

  // anima f de "from" até 1 em "ms" milissegundos; chama step(f) a cada quadro
  function animate(ctx, from, ms, step, end) {
    cancelAnimationFrame(ctx.raf);
    if (still()) { step(from + (1 - from) * 0.15); return; }
    const t0 = performance.now();
    const tick = now => {
      const f = Math.min(1, from + (1 - from) * ((now - t0) / ms));
      step(f);
      if (f < 1) ctx.raf = requestAnimationFrame(tick); else end && end();
    };
    ctx.raf = requestAnimationFrame(tick);
  }

  // Viagem ao longo de uma rota: linha cinza percorrida, verde à frente, veículo no ponto atual
  function trip(ctx, route, vehicleIcon, withDest = true) {
    const path = route.path, dist = measure(path);
    const done = L.polyline([], { color: "#9AA6B5", weight: 5, opacity: .6 }).addTo(ctx.map);
    const ahead = L.polyline(path, { color: lineColor(), weight: 5, opacity: .95, lineCap: "round" }).addTo(ctx.map);
    if (withDest) L.marker(path[path.length - 1], { icon: I.dest(), interactive: false }).addTo(ctx.map);
    const v = L.marker(path[0], { icon: vehicleIcon, interactive: false, zIndexOffset: 500 }).addTo(ctx.map);
    ctx.lines.push(ahead);
    ctx.bounds = L.latLngBounds(path);
    return {
      total: dist[dist.length - 1],
      at(f) { const a = along(path, dist, f); v.setLatLng(a.pt); done.setLatLngs(a.done); ahead.setLatLngs(a.ahead); return a; },
    };
  }

  // ---------- Configuração de cada mapa ----------
  const SETUP = {
    // 04 · Pontos: o ponto da praça, você e os ônibus chegando
    pontos(ctx) {
      const m = ctx.map;
      L.polyline([EU, PRACA], { color: lineColor(), weight: 3, dashArray: "6 8" }).addTo(m);
      L.marker(PRACA, { icon: I.bus(), zIndexOffset: 400 }).addTo(m);
      L.marker(EU, { icon: I.me() }).addTo(m);
      const buses = [["03", R["Campus UNIJUÍ"].path, 0.55], ["01", R["HCI"].path, 0.7], ["05", R["Casa"].path, 0.8]];
      ctx.buses = buses.map(([n, path, f]) => {
        const rev = [...path].reverse(), dist = measure(rev);
        const mk = L.marker(along(rev, dist, f).pt, { icon: I.line(n) }).addTo(m);
        return { mk, rev, dist, f };
      });
      ctx.bounds = L.latLng(PRACA).toBounds(900); // quadrado de ~900 m centrado na praça
      ctx.enter = () => animate(ctx, 0, 40000, k => ctx.buses.forEach(b => b.mk.setLatLng(along(b.rev, b.dist, b.f + (0.97 - b.f) * k).pt)));
    },

    // 05 · Ao vivo: o ônibus anda até o destino; minutos, paradas e barra acompanham
    aovivo(ctx) {
      const STOPS = ["Rua do Comércio", "Hospital Unimed", "Escola Estadual", "Av. Coronel Dico", "Hospital Bom Pastor", "Bairro São Geraldo", "Av. David José Martins", "Entrada do Campus"];
      ctx.enter = () => {
        ctx.reset();
        const t = trip(ctx, R[state.dest] || R["Campus UNIJUÍ"], I.bus());
        ctx.fit();
        animate(ctx, 0.5, 33000, f => {
          const a = t.at(f);
          const stop = Math.min(8, Math.floor(f * 8));
          set("[data-countdown]", Math.max(0, Math.ceil((1 - f) * 22)));
          document.querySelectorAll("[data-live-bar]").forEach(el => { el.style.width = f * 100 + "%"; });
          set("[data-live-stop]", f >= 1 ? "Chegando ao destino" : `Parada ${stop} de 8`);
          const toNext = ((stop + 1) / 8 - f) * t.total;
          set("[data-live-next]", STOPS[Math.min(stop, 7)]);
          set("[data-live-next-d]", f >= 1 ? "Última parada" : `Próxima parada • ${km(toNext)}`);
          if (ctx.follow) ctx.map.panTo(a.pt, { animate: false });
        }, () => toast("Você chegou! Toque em “Cheguei ao destino”."));
      };
    },

    // 06 · Corrida: o carro leva você até o destino escolhido
    corrida(ctx) {
      ctx.enter = () => {
        ctx.reset();
        const t = trip(ctx, R[state.dest] || R["Campus UNIJUÍ"], I.carBig());
        ctx.fit();
        animate(ctx, 0.05, 18000, f => {
          t.at(f);
          set("[data-ride-min]", Math.max(0, Math.ceil((1 - f) * 6)));
          set("[data-ride-km]", km((1 - f) * t.total));
          document.querySelectorAll("[data-ride-bar]").forEach(el => { el.style.width = f * 100 + "%"; });
        }, () => toast("Você chegou ao destino"));
      };
    },

    // 09 · Pedir carro: você e os motoristas por perto
    pedir(ctx) {
      const m = ctx.map;
      L.marker(PRACA, { icon: I.me(), zIndexOffset: 400 }).addTo(m);
      const cars = [[-28.3862, -53.9188], [-28.3913, -53.9175], [-28.3871, -53.9118], [-28.3925, -53.9132], [-28.3849, -53.9149]];
      cars.forEach(c => L.marker(c, { icon: I.car() }).addTo(m));
      ctx.bounds = L.latLngBounds([PRACA, ...cars]);
    },

    // 10 · Categoria: a rota inteira até o destino, como prévia do trajeto
    categoria(ctx) {
      ctx.enter = () => {
        ctx.reset();
        const path = (R[state.dest] || R["Campus UNIJUÍ"]).path;
        ctx.lines.push(L.polyline(path, { color: lineColor(), weight: 5, opacity: .95, lineCap: "round" }).addTo(ctx.map));
        L.marker(path[0], { icon: I.me(), zIndexOffset: 300 }).addTo(ctx.map);
        L.marker(path[path.length - 1], { icon: I.dest(), interactive: false }).addTo(ctx.map);
        ctx.bounds = L.latLngBounds(path);
        ctx.fit();
      };
    },

    // 11 · Buscando: radar sobre a praça
    busca(ctx) {
      const m = ctx.map;
      L.marker(PRACA, { icon: I.radar(), zIndexOffset: 400, interactive: false }).addTo(m);
      [[-28.3862, -53.9188], [-28.3913, -53.9112], [-28.3851, -53.9139]].forEach(c => L.marker(c, { icon: I.car() }).addTo(m));
      ctx.bounds = L.latLngBounds([[-28.3840, -53.9200], [-28.3935, -53.9100]]);
    },

    // 12 · Seu motorista: vem até você pela rota real e, ao chegar, a tela troca para "chegou"
    acaminho(ctx) {
      const near = L.latLngBounds([R._chegada.path.at(-3), PRACA]).pad(1.5);
      const pad = { paddingTopLeft: [36, 104], paddingBottomRight: [36, 64], maxZoom: 17 };
      ctx.enter = () => {
        ctx.reset();
        const t = trip(ctx, R._chegada, I.carBig(), false);
        L.marker(PRACA, { icon: I.me(), zIndexOffset: 300 }).addTo(ctx.map);
        // voltando da corrida: o motorista já está ali
        if (state.arrived) { t.at(0.985); ctx.map.fitBounds(near, { ...pad, animate: false }); return; }
        ctx.fit();
        animate(ctx, 0, 14000, f => {
          t.at(f);
          set("[data-eta]", Math.max(0, Math.ceil((1 - f) * 3)));
          set("[data-eta-m]", km((1 - f) * t.total));
          document.querySelectorAll("[data-eta-bar]").forEach(el => { el.style.width = f * 100 + "%"; });
        }, () => {
          t.at(0.985);
          ctx.map.flyToBounds(near, { ...pad, duration: 0.8 });
          setArrived(true);
          toast("Seu motorista chegou!");
        });
      };
    },
  };

  // ---------- Criação sob demanda ----------
  const maps = {};
  function create(box) {
    const el = document.createElement("div");
    el.className = "leaf";
    box.prepend(el);
    const map = L.map(el, { zoomControl: false, attributionControl: false, zoomSnap: 0.25 });
    L.control.attribution({ prefix: false, position: "bottomright" }).addAttribution(ATTR).addTo(map);
    const tiles = L.tileLayer(TILE_URL, { maxZoom: 19 }).addTo(map);
    const flush = !!box.closest(".content.flush");
    const ctx = {
      map, tiles, lines: [], layers: L.layerGroup().addTo(map), raf: 0, follow: false,
      fit() {
        map.fitBounds(ctx.bounds, { paddingTopLeft: [36, flush ? 104 : 28], paddingBottomRight: [36, flush ? 64 : 28], maxZoom: 17, animate: false });
      },
      reset() { cancelAnimationFrame(ctx.raf); map.eachLayer(l => { if (l !== tiles && l !== ctx.layers) map.removeLayer(l); }); ctx.lines = []; },
    };
    map.setView(PRACA, 15);
    SETUP[box.dataset.map](ctx);
    if (ctx.bounds && !ctx.enter) ctx.fit();
    // centralizar volta a enquadrar; arrastar o mapa para de seguir o veículo
    box.querySelector("[data-recenter]")?.addEventListener("click", e => { e.stopPropagation(); ctx.fit(); });
    map.on("dragstart", () => { ctx.follow = false; });
    return ctx;
  }

  window.mapEnter = id => {
    Object.values(maps).forEach(c => cancelAnimationFrame(c.raf));
    const box = document.querySelector(`#${id} .map[data-map]`);
    if (!box) return;
    const ctx = maps[id] || (maps[id] = create(box));
    ctx.map.invalidateSize();
    ctx.enter ? ctx.enter() : ctx.fit();
    // depois da transição de entrada, o tamanho final já é conhecido
    setTimeout(() => ctx.map.invalidateSize(), 560);
  };

  // Tema: o filtro dos quadros vem do CSS; aqui só a cor das rotas acompanha
  new MutationObserver(() => {
    Object.values(maps).forEach(c => c.lines.forEach(l => l.setStyle({ color: lineColor() })));
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
})();
