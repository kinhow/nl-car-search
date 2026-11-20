// Generates src/data/listings.json: 2,000 synthetic Malaysian used-car listings.
// Seeded, so every run produces the same file. Run: npm run data:generate
import { writeFileSync } from "node:fs";
import { CATALOG, STATES, type Trait } from "../src/data/catalog";
import type { Listing } from "../src/lib/types";

const COUNT = 2000;
const THIS_YEAR = 2026;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261117);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

// Weighted towards the states where most listings are.
const STATE_WEIGHTS: Record<string, number> = {
  Selangor: 30, "Kuala Lumpur": 20, Johor: 12, Penang: 9, Perak: 6, "Negeri Sembilan": 4,
  Melaka: 3, Pahang: 3, Kedah: 3, Kelantan: 2, Terengganu: 2, Sabah: 3, Sarawak: 3,
};
const AREAS: Record<string, string[]> = {
  Selangor: ["Petaling Jaya", "Shah Alam", "Subang Jaya", "Klang", "Puchong", "Cyberjaya", "Rawang"],
  "Kuala Lumpur": ["Cheras", "Kepong", "Setapak", "Bangsar", "Wangsa Maju", "Sri Petaling"],
  Johor: ["Johor Bahru", "Skudai", "Batu Pahat", "Muar", "Kluang"],
  Penang: ["George Town", "Bayan Lepas", "Butterworth", "Bukit Mertajam"],
  Perak: ["Ipoh", "Taiping", "Teluk Intan"],
  "Negeri Sembilan": ["Seremban", "Nilai", "Port Dickson"],
  Melaka: ["Melaka Tengah", "Ayer Keroh"],
  Pahang: ["Kuantan", "Temerloh", "Bentong"],
  Kedah: ["Alor Setar", "Sungai Petani"],
  Kelantan: ["Kota Bharu"],
  Terengganu: ["Kuala Terengganu"],
  Sabah: ["Kota Kinabalu", "Sandakan"],
  Sarawak: ["Kuching", "Miri"],
};
function pickState() {
  const total = Object.values(STATE_WEIGHTS).reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (const s of STATES) {
    r -= STATE_WEIGHTS[s];
    if (r <= 0) return s;
  }
  return "Selangor";
}

// Phrases that imply a trait without naming it.
const TRAIT_PHRASES: Record<Trait, string[]> = {
  family: [
    "Plenty of legroom at the back, kids' seats fit easily.",
    "We used it for school runs and balik kampung trips with the whole family.",
    "ISOFIX points at the rear, spacious cabin for parents and children.",
  ],
  ehailing: [
    "Previously registered for ride-hailing, all e-hailing inspections passed.",
    "Rear passengers stay comfortable on long city trips, popular with drivers doing passenger pickups.",
    "Meets the age requirement for ride-sharing platforms, cheap to run all day.",
  ],
  "first-car": [
    "Easy to drive and park, perfect for a fresh graduate or new driver.",
    "Light steering, small turning circle, great for someone just got their P licence.",
    "Affordable to insure, ideal as a starter vehicle.",
  ],
  "fuel-saver": [
    "Very economical, a full tank lasts me more than a week of commuting.",
    "Sips fuel, around 20 km per litre on mixed driving.",
    "Low running costs, petrol bill is really small every month.",
  ],
  "big-boot": [
    "Huge boot, fits a stroller, golf bag and groceries together.",
    "Cargo space is massive, rear seats fold flat for moving house.",
    "Loads of luggage room for airport runs.",
  ],
  highway: [
    "Stable and quiet at highway speeds, great for KL to Penang drives.",
    "Cruise control and lane keep make outstation trips relaxing.",
    "Smooth on the North-South Expressway, very little wind noise.",
  ],
  offroad: [
    "High ground clearance, handles flooded roads and estate tracks.",
    "Taken to plantation roads and camping sites without any problem.",
    "Tough suspension, 4x4 capable for rough terrain.",
  ],
  luxury: [
    "Premium leather interior, ambient lighting, feels like a five-star hotel.",
    "Executive comfort, soft ride and very refined cabin.",
    "Full spec with premium sound system and soft-close features.",
  ],
  "low-maintenance": [
    "Spare parts are cheap and every workshop can service it.",
    "Simple mechanicals, servicing costs are very low.",
    "Reliable engine, never broke down, only routine servicing.",
  ],
  performance: [
    "Turbo engine pulls strongly, overtaking is effortless.",
    "Sporty handling and quick acceleration, fun on winding roads.",
    "Responsive throttle and firm suspension, a driver's car.",
  ],
};
const CONDITION = [
  "Full service record at authorised service centre.",
  "Single owner, accident free, no flood.",
  "Tyres changed last year, battery new.",
  "Minor scratches on rear bumper, otherwise good condition.",
  "Non-smoker car, interior very clean.",
  "Puspakom inspection can be arranged.",
];
const COLOURS = ["White", "Silver", "Grey", "Black", "Red", "Blue", "Brown"];

const listings: Listing[] = [];
for (let i = 0; i < COUNT; i++) {
  const car = pick(CATALOG);
  const year = between(car.years[0], Math.min(car.years[1], THIS_YEAR));
  const age = THIS_YEAR - year;
  const mileage = Math.max(1000, Math.round((age * between(12000, 28000) + between(0, 9000)) / 100) * 100);
  const depreciation = Math.pow(0.88, Math.max(0, age - 1));
  const mileagePenalty = 1 - Math.min(0.15, mileage / 2_000_000);
  const price = Math.round((car.price1yr * depreciation * mileagePenalty * (0.92 + rand() * 0.16)) / 100) * 100;
  const transmission = car.manualAvailable && rand() < 0.18 ? "manual" : "auto";
  const state = pickState();
  const area = pick(AREAS[state]);

  // Each listing shows 1-2 of its model's traits, so "family car" is not just a model lookup.
  const shown = [...car.traits].sort(() => rand() - 0.5).slice(0, between(1, 2));
  const traitText = shown.map((t) => pick(TRAIT_PHRASES[t])).join(" ");
  const description = `${year} ${car.make} ${car.model}, ${transmission === "auto" ? "automatic" : "manual"}, ${mileage.toLocaleString("en-MY")} km. ${traitText} ${pick(CONDITION)}`;

  listings.push({
    id: `L${String(i + 1).padStart(4, "0")}`,
    title: `${year} ${car.make} ${car.model}${car.cc ? ` ${(car.cc / 1000).toFixed(1)}` : " EV"}`,
    make: car.make,
    model: car.model,
    year,
    price,
    mileage,
    transmission,
    fuel: car.fuel,
    body: car.body,
    seats: car.seats,
    cc: car.cc,
    colour: pick(COLOURS),
    state,
    area,
    description,
    traits: shown,
  });
}

writeFileSync("src/data/listings.json", JSON.stringify(listings));
console.log(`Wrote ${listings.length} listings to src/data/listings.json`);
