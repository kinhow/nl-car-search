import { SearchApp } from "@/components/search-app";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Find a used car the way you&apos;d say it</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Type in English, Malay or Manglish. An LLM turns your words into filters you can edit, ranks results by what you
          meant, and answers questions about a car from its listing and a buyer&apos;s guide. Demo data: 2,000 synthetic
          listings.
        </p>
      </header>
      <SearchApp />
    </main>
  );
}
