export const DAY_START_CENTS = 14280;
export const DAY_START_TRIPS = 8;
export const TRIP_NET_CENTS = 1280;
export const OFFER_MS = 12000;
export const STORAGE_KEY = "move-ijui-driver-v1";

export const TRIP = {
  id: "mariana-silva",
  category: "Move Pop",
  passenger: "Mariana Silva",
  rating: "4,98",
  detail: "Estudante UNIJUÍ · Usuária frequente",
  origin: "Praça da República, 340",
  originNote: "Centro Histórico · Em frente ao coreto",
  pickupDistance: "1,1 km",
  pickupTime: "3 min",
  destination: "Campus UNIJUÍ — Portão 01",
  destinationNote: "Bairro Universitário · Acesso Principal",
  tripDistance: "4,2 km",
  tripTime: "~9 min",
  payment: "Move Card / Cresol",
  vehicle: "Onix Prata",
  cooperative: "Cooperativa Municipal de Ijuí",
  approach: "Virando a esquina da Praça da República",
};

export const DEMO_HISTORY = [
  { id: "d1", cents: 1680, demonstrative: true },
  { id: "d2", cents: 1520, demonstrative: true },
  { id: "d3", cents: 2100, demonstrative: true },
  { id: "d4", cents: 1890, demonstrative: true },
  { id: "d5", cents: 1740, demonstrative: true },
  { id: "d6", cents: 1960, demonstrative: true },
  { id: "d7", cents: 1630, demonstrative: true },
  { id: "d8", cents: 1760, demonstrative: true },
];

const demoSum = DEMO_HISTORY.reduce((sum, item) => sum + item.cents, 0);
if (demoSum !== DAY_START_CENTS) {
  throw new Error("O histórico demonstrativo não fecha o total do dia.");
}

export const ALERTS = [
  {
    id: "closure",
    severity: "danger",
    kicker: "Interdição",
    title: "Av. 21 de Abril",
    text: "Trecho fechado no mapa ilustrativo. A ida ao campus não usa essa avenida.",
  },
  {
    id: "flood",
    severity: "info",
    kicker: "Alagamento",
    title: "Praça dos Imigrantes",
    text: "Área alagada no mapa ilustrativo, ao sul da avenida interditada.",
  },
  {
    id: "detour",
    severity: "route",
    kicker: "Desvio",
    title: "Av. Getúlio Vargas",
    text: "Caminho ilustrado até o Campus UNIJUÍ, Portão 01.",
  },
];

export function grossFromNet(netCents) {
  const gross = Math.round(netCents / 0.9);
  return { gross, fee: gross - netCents };
}

export function formatBRL(cents) {
  const value = (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `R$ ${value}`;
}
