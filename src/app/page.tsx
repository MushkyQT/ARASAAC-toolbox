import { ARASAAC_CREDIT } from "@/lib/arasaac";
import { Workbench } from "@/components/Workbench";

/** Le bord de la règle du tapis de découpe, numéroté en centimètres. */
function Ruler() {
  return (
    <div className="ruler" aria-hidden>
      {Array.from({ length: 60 }, (_, i) => (
        <span key={i} style={{ left: `${i + 1}cm` }}>
          {i + 1}
        </span>
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <>
      <Ruler />
      <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-10 px-4 pb-10 pt-8 sm:px-8">
        <header>
          <h1 className="font-display text-title font-extrabold text-ink">Atelier Pictos</h1>
        </header>

        <main className="flex-1">
          <Workbench />
        </main>

        <footer className="text-xs text-kraft-ink">
          <p>{ARASAAC_CREDIT}</p>
        </footer>
      </div>
    </>
  );
}
