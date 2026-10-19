import { ARASAAC_CREDIT } from "@/lib/arasaac";
import { Workbench } from "@/components/Workbench";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-8 px-4 py-8 sm:px-8">
      <header>
        <h1 className="font-display text-title font-bold text-ink">Atelier Pictos</h1>
      </header>

      <main className="flex-1">
        <Workbench />
      </main>

      <footer className="border-t border-ink/20 pt-6 text-xs text-ink">
        <p>{ARASAAC_CREDIT}</p>
      </footer>
    </div>
  );
}
