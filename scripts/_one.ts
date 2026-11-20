import { parseQueryDetailed } from "../src/lib/parse-query";
try { console.log(JSON.stringify(await parseQueryDetailed("Myvi auto bawah 40k"), null, 1)); } catch (e) { console.log((e as Error).message); }
