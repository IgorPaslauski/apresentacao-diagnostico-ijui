const VARGAS = [
  [146, 586],
  [160, 512],
  [172, 444],
  [184, 376],
  [198, 314],
  [214, 252],
  [234, 196],
  [262, 142],
  [298, 102],
  [326, 78],
];

const PICKUP = 5;
const VEHICLE_START = 2;
const VEHICLE_MID = 7;
const DESTINATION = 9;

const LABELS = {
  idle: "Mapa ilustrativo de Ijuí, com o veículo disponível no centro.",
  offered: "Mapa ilustrativo com a oferta da Praça da República ao Campus UNIJUÍ pela Av. Getúlio Vargas.",
  accepted: "Mapa ilustrativo a caminho da Praça da República.",
  arrived: "Mapa ilustrativo com o veículo no embarque, em frente ao coreto.",
  in_progress: "Mapa ilustrativo da viagem ao Portão 01, com desvio pela Av. Getúlio Vargas.",
  completed: "Mapa ilustrativo com a corrida concluída no Campus UNIJUÍ.",
};

function pathOf(points) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point[0]} ${point[1]}`).join(" ");
}

function blocks() {
  const xs = [8, 86, 164, 242, 320, 392];
  const ys = [10, 88, 166, 244, 322, 400, 478, 556, 628];
  const items = [];
  for (let row = 0; row < ys.length - 1; row += 1) {
    for (let col = 0; col < xs.length - 1; col += 1) {
      const pad = 8 + ((row + col) % 3 === 0 ? 2 : 0);
      items.push({
        x: xs[col] + pad,
        y: ys[row] + pad,
        w: xs[col + 1] - xs[col] - pad * 2,
        h: ys[row + 1] - ys[row] - pad * 2,
        tone: (row + col) % 2,
      });
    }
  }
  return items;
}

function trees(cx, cy, seed) {
  const spots = [
    [-28, -18],
    [-8, -26],
    [16, -16],
    [30, 4],
    [-22, 10],
    [4, 14],
    [22, 22],
    [-6, 28],
  ];
  return spots
    .map((spot, index) => {
      const radius = 4 + ((seed + index) % 3);
      return `<circle cx="${cx + spot[0]}" cy="${cy + spot[1]}" r="${radius}" fill="${index % 2 ? "#6ea56a" : "#86b582"}"/>`;
    })
    .join("");
}

function markerPickup(active) {
  return `<g class="marker marker-pickup" transform="translate(214 252)" filter="url(#pin-shadow)" opacity="${active ? 1 : 0.45}">
    <path d="M0 16 C0 16 -13 2 -13 -6 a13 13 0 1 1 26 0 C13 2 0 16 0 16Z" fill="#00522f"/>
    <circle cy="-6" r="4.5" fill="#f7f4ee"/>
  </g>`;
}

function markerDestination(active) {
  return `<g class="marker marker-destination" transform="translate(326 78)" filter="url(#pin-shadow)" opacity="${active ? 1 : 0.5}">
    <rect x="-13" y="-28" width="26" height="26" rx="7" fill="#14241c"/>
    <path d="M-4 -20 h8 v7 h4 v3 h-12z" fill="#a5f4c0"/>
    <path d="M-5 8 h10" stroke="#14241c" stroke-width="2" stroke-linecap="round"/>
  </g>`;
}

function vehicleAt(point, waiting) {
  return `<g class="vehicle" transform="translate(${point[0]} ${point[1]})" filter="url(#pin-shadow)">
    <circle class="vehicle-pulse" r="16" fill="#a5f4c0" opacity="${waiting ? 0.7 : 0}"/>
    <circle r="18" fill="#ffffff"/>
    <circle r="13" fill="#00522f"/>
    <path d="M-6 1.5 h12 l-1.2 2.4 h-9.6z M-4.2 -2 h8.4 l1 3.2 h-10.4z" fill="#f7f4ee"/>
  </g>`;
}

export function renderMap(phase) {
  const showRoute = phase !== "idle";
  const showPickup = showRoute;
  const showDestination = phase === "offered" || phase === "in_progress" || phase === "completed";
  const destinationDim = phase === "offered";
  const routePoints =
    phase === "accepted" ? VARGAS.slice(VEHICLE_START, PICKUP + 1) : phase === "idle" || phase === "arrived" ? [] : phase === "offered" ? VARGAS : VARGAS.slice(PICKUP);
  const vehiclePoint =
    phase === "arrived" ? VARGAS[PICKUP] : phase === "in_progress" ? VARGAS[VEHICLE_MID] : phase === "completed" ? VARGAS[DESTINATION] : VARGAS[VEHICLE_START];
  const hazards = phase === "offered" || phase === "in_progress" || phase === "completed";
  const hazardsStrong = phase === "in_progress" || phase === "completed";
  const dashed = phase === "offered";

  const blockMarkup = blocks()
    .map(
      (block) =>
        `<rect x="${block.x}" y="${block.y}" width="${block.w}" height="${block.h}" rx="7" fill="${block.tone ? "#f3efe6" : "#f7f4ee"}" stroke="#e6e0d4" stroke-width="1"/>`,
    )
    .join("");

  return `<svg class="city-map" viewBox="0 0 400 640" role="img" aria-label="${LABELS[phase] || LABELS.idle}">
    <defs>
      <filter id="pin-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="1.2" stdDeviation="1.2" flood-color="#14241c" flood-opacity="0.2"/>
      </filter>
    </defs>
    <rect width="400" height="640" fill="#e5e0d5"/>
    ${blockMarkup}
    <g class="parks">
      <rect x="108" y="186" width="96" height="86" rx="18" fill="#c5dcc0"/>
      ${trees(156, 228, 3)}
      <g transform="translate(156 226)">
        <circle r="9" fill="#f7f4ee" stroke="#00522f" stroke-width="1.6"/>
        <path d="M-4 0 H4 M0 -4 V4" stroke="#00522f" stroke-width="1.4" stroke-linecap="round"/>
      </g>
      <rect x="22" y="368" width="118" height="96" rx="20" fill="#d5e6cf"/>
      ${trees(78, 416, 9)}
      <g class="flood" opacity="${hazardsStrong ? 0.95 : 0}">
        <ellipse cx="78" cy="430" rx="34" ry="14" fill="#3755c3" opacity="0.28"/>
        <path d="M52 428 q8 -8 16 0 t16 0 t16 0" fill="none" stroke="#3755c3" stroke-width="2" stroke-linecap="round"/>
      </g>
      <g class="campus">
        <rect x="250" y="18" width="132" height="78" rx="12" fill="#e7f2e6" stroke="#1b6b43" stroke-width="1.5"/>
        <rect x="268" y="32" width="28" height="18" rx="2" fill="#ffffff" stroke="#8fb596"/>
        <rect x="304" y="32" width="28" height="18" rx="2" fill="#ffffff" stroke="#8fb596"/>
        <rect x="340" y="32" width="24" height="18" rx="2" fill="#ffffff" stroke="#8fb596"/>
        <path d="M308 96 v-16 h20 v16" fill="none" stroke="#00522f" stroke-width="2"/>
      </g>
    </g>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 348 H384" stroke="#d9d3c7" stroke-width="26"/>
      <path d="M16 348 H384" stroke="#fbfaf7" stroke-width="16"/>
      <path d="${pathOf(VARGAS)}" stroke="#d9d3c7" stroke-width="28"/>
      <path d="${pathOf(VARGAS)}" stroke="#fbfaf7" stroke-width="18"/>
      <path d="M228 150 V430" stroke="#efeae2" stroke-width="12"/>
    </g>
    <g class="hazards" opacity="${hazards ? (hazardsStrong ? 1 : 0.75) : 0}">
      <path d="M252 348 H360" stroke="#ba1a1a" stroke-width="8" stroke-linecap="round"/>
      <path d="M268 338 v20 M300 338 v20 M332 338 v20" stroke="#f7f4ee" stroke-width="3" stroke-linecap="round"/>
      <g transform="translate(308 324)">
        <rect x="-11" y="-11" width="22" height="22" rx="6" fill="#ba1a1a"/>
        <path d="M-5 -1 h10 M0 -6 v5" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
      </g>
    </g>
    <g class="route" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${routePoints.length ? 1 : 0}">
      <path d="${pathOf(routePoints.length ? routePoints : VARGAS)}" stroke="#a5f4c0" stroke-width="12"/>
      <path d="${pathOf(routePoints.length ? routePoints : VARGAS)}" stroke="#00522f" stroke-width="5" ${dashed ? 'stroke-dasharray="2 9"' : ""}/>
    </g>
    <g class="map-labels" fill="#24362d" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="700" stroke="#f7f4ee" stroke-width="3" paint-order="stroke" stroke-linejoin="round">
      <text x="18" y="334">Av. 21 de Abril</text>
      <text x="250" y="188" transform="rotate(-46 250 188)">Getúlio Vargas</text>
      <text x="112" y="284" font-size="10">Praça da República</text>
      <text x="26" y="478" font-size="10">Praça dos Imigrantes</text>
      <text x="262" y="48" fill="#00522f">Campus UNIJUÍ</text>
      <text x="286" y="128" font-size="10" font-weight="600">Portão 01</text>
    </g>
    ${showPickup ? markerPickup(phase !== "completed") : ""}
    ${showDestination ? markerDestination(!destinationDim) : ""}
    ${vehicleAt(vehiclePoint, phase === "arrived" || phase === "in_progress")}
  </svg>`;
}
