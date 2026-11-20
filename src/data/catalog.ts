// Synthetic-data catalog. Makes and models are real Malaysian-market cars;
// prices are rough used-market levels for illustration only.

export const BODY_TYPES = ["hatchback", "sedan", "suv", "mpv", "pickup"] as const;
export const FUELS = ["petrol", "diesel", "hybrid", "ev"] as const;
export const TRANSMISSIONS = ["auto", "manual"] as const;
export const STATES = [
  "Kuala Lumpur",
  "Selangor",
  "Johor",
  "Penang",
  "Perak",
  "Negeri Sembilan",
  "Melaka",
  "Pahang",
  "Kedah",
  "Kelantan",
  "Terengganu",
  "Sabah",
  "Sarawak",
] as const;

export type BodyType = (typeof BODY_TYPES)[number];
export type Fuel = (typeof FUELS)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];
export type State = (typeof STATES)[number];

/** Hidden ground-truth traits. Descriptions are written from these, but never
 *  name them directly, so retrieval has to work on meaning, not keywords. */
export const TRAITS = [
  "family",
  "ehailing",
  "first-car",
  "fuel-saver",
  "big-boot",
  "highway",
  "offroad",
  "luxury",
  "low-maintenance",
  "performance",
] as const;
export type Trait = (typeof TRAITS)[number];

export interface CatalogModel {
  make: string;
  model: string;
  body: BodyType;
  seats: number;
  cc: number; // 0 for EV
  fuel: Fuel;
  manualAvailable: boolean;
  /** Used price in RM for a 1-year-old car in good condition. */
  price1yr: number;
  years: [number, number];
  traits: Trait[];
}

export const CATALOG: CatalogModel[] = [
  { make: "Perodua", model: "Axia", body: "hatchback", seats: 5, cc: 1000, fuel: "petrol", manualAvailable: true, price1yr: 36000, years: [2014, 2026], traits: ["first-car", "fuel-saver", "low-maintenance"] },
  { make: "Perodua", model: "Myvi", body: "hatchback", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: true, price1yr: 52000, years: [2012, 2026], traits: ["first-car", "fuel-saver", "low-maintenance", "ehailing"] },
  { make: "Perodua", model: "Bezza", body: "sedan", seats: 5, cc: 1300, fuel: "petrol", manualAvailable: true, price1yr: 42000, years: [2016, 2026], traits: ["ehailing", "fuel-saver", "low-maintenance", "big-boot"] },
  { make: "Perodua", model: "Alza", body: "mpv", seats: 7, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 70000, years: [2014, 2026], traits: ["family", "ehailing", "big-boot"] },
  { make: "Perodua", model: "Aruz", body: "suv", seats: 7, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 68000, years: [2019, 2026], traits: ["family", "offroad"] },
  { make: "Perodua", model: "Ativa", body: "suv", seats: 5, cc: 1000, fuel: "petrol", manualAvailable: false, price1yr: 64000, years: [2021, 2026], traits: ["first-car", "fuel-saver"] },
  { make: "Proton", model: "Saga", body: "sedan", seats: 5, cc: 1300, fuel: "petrol", manualAvailable: true, price1yr: 36000, years: [2016, 2026], traits: ["first-car", "low-maintenance", "big-boot"] },
  { make: "Proton", model: "Persona", body: "sedan", seats: 5, cc: 1600, fuel: "petrol", manualAvailable: true, price1yr: 45000, years: [2016, 2026], traits: ["ehailing", "big-boot", "low-maintenance"] },
  { make: "Proton", model: "Iriz", body: "hatchback", seats: 5, cc: 1600, fuel: "petrol", manualAvailable: true, price1yr: 44000, years: [2014, 2026], traits: ["first-car", "fuel-saver"] },
  { make: "Proton", model: "X50", body: "suv", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 88000, years: [2020, 2026], traits: ["highway", "performance", "family"] },
  { make: "Proton", model: "X70", body: "suv", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 105000, years: [2018, 2026], traits: ["family", "highway", "big-boot"] },
  { make: "Proton", model: "X90", body: "suv", seats: 7, cc: 1500, fuel: "hybrid", manualAvailable: false, price1yr: 125000, years: [2023, 2026], traits: ["family", "highway", "big-boot"] },
  { make: "Proton", model: "S70", body: "sedan", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 78000, years: [2023, 2026], traits: ["highway", "performance"] },
  { make: "Honda", model: "City", body: "sedan", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 85000, years: [2014, 2026], traits: ["ehailing", "fuel-saver", "big-boot", "highway"] },
  { make: "Honda", model: "Civic", body: "sedan", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 140000, years: [2016, 2026], traits: ["performance", "highway"] },
  { make: "Honda", model: "Jazz", body: "hatchback", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 70000, years: [2014, 2021], traits: ["first-car", "fuel-saver", "big-boot"] },
  { make: "Honda", model: "HR-V", body: "suv", seats: 5, cc: 1500, fuel: "hybrid", manualAvailable: false, price1yr: 120000, years: [2015, 2026], traits: ["family", "fuel-saver", "highway"] },
  { make: "Honda", model: "CR-V", body: "suv", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 165000, years: [2013, 2026], traits: ["family", "big-boot", "highway"] },
  { make: "Toyota", model: "Vios", body: "sedan", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 82000, years: [2013, 2026], traits: ["ehailing", "low-maintenance", "big-boot"] },
  { make: "Toyota", model: "Yaris", body: "hatchback", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 76000, years: [2019, 2026], traits: ["first-car", "fuel-saver"] },
  { make: "Toyota", model: "Corolla Cross", body: "suv", seats: 5, cc: 1800, fuel: "hybrid", manualAvailable: false, price1yr: 130000, years: [2020, 2026], traits: ["family", "fuel-saver", "highway"] },
  { make: "Toyota", model: "Camry", body: "sedan", seats: 5, cc: 2500, fuel: "hybrid", manualAvailable: false, price1yr: 190000, years: [2015, 2026], traits: ["luxury", "highway"] },
  { make: "Toyota", model: "Hilux", body: "pickup", seats: 5, cc: 2400, fuel: "diesel", manualAvailable: true, price1yr: 115000, years: [2013, 2026], traits: ["offroad", "big-boot"] },
  { make: "Toyota", model: "Innova", body: "mpv", seats: 8, cc: 2000, fuel: "petrol", manualAvailable: false, price1yr: 120000, years: [2013, 2026], traits: ["family", "big-boot", "ehailing"] },
  { make: "Nissan", model: "Almera", body: "sedan", seats: 5, cc: 1000, fuel: "petrol", manualAvailable: false, price1yr: 72000, years: [2013, 2026], traits: ["ehailing", "fuel-saver", "big-boot"] },
  { make: "Nissan", model: "Navara", body: "pickup", seats: 5, cc: 2500, fuel: "diesel", manualAvailable: true, price1yr: 110000, years: [2015, 2026], traits: ["offroad", "big-boot"] },
  { make: "Mazda", model: "Mazda2", body: "hatchback", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 85000, years: [2015, 2026], traits: ["first-car", "performance"] },
  { make: "Mazda", model: "Mazda3", body: "sedan", seats: 5, cc: 2000, fuel: "petrol", manualAvailable: false, price1yr: 140000, years: [2014, 2026], traits: ["performance", "luxury"] },
  { make: "Mazda", model: "CX-5", body: "suv", seats: 5, cc: 2000, fuel: "petrol", manualAvailable: false, price1yr: 150000, years: [2013, 2026], traits: ["family", "highway", "performance"] },
  { make: "Mitsubishi", model: "Triton", body: "pickup", seats: 5, cc: 2400, fuel: "diesel", manualAvailable: true, price1yr: 105000, years: [2014, 2026], traits: ["offroad", "big-boot"] },
  { make: "BMW", model: "3 Series", body: "sedan", seats: 5, cc: 2000, fuel: "petrol", manualAvailable: false, price1yr: 260000, years: [2013, 2026], traits: ["luxury", "performance", "highway"] },
  { make: "BMW", model: "X3", body: "suv", seats: 5, cc: 2000, fuel: "hybrid", manualAvailable: false, price1yr: 320000, years: [2015, 2026], traits: ["luxury", "family", "highway"] },
  { make: "Mercedes-Benz", model: "C-Class", body: "sedan", seats: 5, cc: 1500, fuel: "petrol", manualAvailable: false, price1yr: 280000, years: [2013, 2026], traits: ["luxury", "highway"] },
  { make: "Mercedes-Benz", model: "E-Class", body: "sedan", seats: 5, cc: 2000, fuel: "petrol", manualAvailable: false, price1yr: 380000, years: [2013, 2026], traits: ["luxury", "highway", "performance"] },
  { make: "BYD", model: "Atto 3", body: "suv", seats: 5, cc: 0, fuel: "ev", manualAvailable: false, price1yr: 120000, years: [2022, 2026], traits: ["fuel-saver", "family", "low-maintenance"] },
  { make: "BYD", model: "Dolphin", body: "hatchback", seats: 5, cc: 0, fuel: "ev", manualAvailable: false, price1yr: 90000, years: [2023, 2026], traits: ["fuel-saver", "first-car", "low-maintenance"] },
  { make: "Tesla", model: "Model 3", body: "sedan", seats: 5, cc: 0, fuel: "ev", manualAvailable: false, price1yr: 170000, years: [2023, 2026], traits: ["performance", "fuel-saver", "luxury"] },
  { make: "Tesla", model: "Model Y", body: "suv", seats: 5, cc: 0, fuel: "ev", manualAvailable: false, price1yr: 185000, years: [2023, 2026], traits: ["family", "performance", "fuel-saver"] },
];

export const MAKES = [...new Set(CATALOG.map((c) => c.make))] as [string, ...string[]];
export const MODELS = CATALOG.map((c) => c.model) as [string, ...string[]];

export function findModel(make: string, model: string) {
  return CATALOG.find((c) => c.make === make && c.model === model);
}
