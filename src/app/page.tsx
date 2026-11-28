import ask from "../../evals/results/ask.json";
import parse from "../../evals/results/parse.json";
import retrieval from "../../evals/results/retrieval.json";
import { SearchApp } from "@/components/search-app";

// Read from the committed eval results, so the page always shows the last real run.
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;
const EVALS = [
  { label: "Queries read into the exact filters", value: pct(parse.summary.exactMatch), detail: `${parse.summary.cases} labelled queries in English, Malay and Manglish` },
  { label: "Right cars in the top 10", value: pct(retrieval.summary.precisionAt10), detail: `${retrieval.summary.lift.toFixed(1)}× better than random` },
  { label: "Answers from the listing and guide only", value: pct(ask.summary.passRate), detail: "Unanswerable questions are declined" },
];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
      <header className="mb-6 max-w-3xl">
        <h1 className="text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">Find a used car the way you&apos;d say it</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">
          Type in English, Malay or Manglish. An LLM reads your words into filters that you can edit, ranks the cars by what you meant,
          and answers questions from the listing and a buyer&apos;s guide. The 2,000 listings are synthetic.
        </p>
      </header>
      <SearchApp evals={EVALS} />
    </main>
  );
}
