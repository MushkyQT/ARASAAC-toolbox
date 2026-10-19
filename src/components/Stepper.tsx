import { IconCheck } from "./icons";

export interface StepState {
  href: string;
  title: string;
  /** Titre court pour les petits écrans (« Impression »). */
  short: string;
  /** État de l'étape en quelques mots (« 18 cartes · 4 à vérifier »). */
  detail: string;
  status: "done" | "current" | "todo";
}

/** Les trois étapes du parcours, toujours visibles en haut de l'écran : où l'on en est, et y aller d'un clic. */
export function Stepper({ steps }: { steps: StepState[] }) {
  return (
    <nav aria-label="Étapes" className="sticky top-0 z-20">
      <ol className="strip flex items-stretch gap-1 rounded-t-none p-1.5 sm:p-2">
        {steps.map((s, i) => (
          <li key={s.href} className="flex min-w-0 flex-auto items-center gap-1 sm:flex-1">
            <a
              href={s.href}
              aria-current={s.status === "current" ? "step" : undefined}
              className="group flex min-w-0 flex-1 items-center gap-2 rounded-control px-1.5 py-1.5 transition-colors duration-(--duration-swap) ease-out hover:bg-tack sm:gap-3 sm:px-2"
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums sm:h-7 sm:w-7 sm:text-sm ${
                  s.status === "done"
                    ? "border-ink-blue bg-ink-blue text-sheet"
                    : s.status === "current"
                      ? "border-ink-blue bg-sheet text-ink-blue"
                      : "border-line bg-sheet text-ink-soft"
                }`}
              >
                {s.status === "done" ? <IconCheck size={16} strokeWidth={2.5} /> : i + 1}
                <span className="sr-only">{s.status === "done" ? " (fait)" : s.status === "current" ? " (en cours)" : ""}</span>
              </span>
              <span className="min-w-0">
                <span
                  className={`block truncate font-display text-sm font-bold leading-tight sm:text-base ${
                    s.status === "todo" ? "text-ink-soft" : "text-ink"
                  }`}
                >
                  <span className="sm:hidden">{s.short}</span>
                  <span className="hidden sm:inline">{s.title}</span>
                </span>
                <span className="hidden truncate text-xs leading-snug text-ink-soft tabular-nums sm:block">{s.detail}</span>
              </span>
            </a>
            {i < steps.length - 1 && <span aria-hidden className="hidden h-0.5 w-6 shrink-0 rounded-full bg-rule md:block lg:w-10" />}
          </li>
        ))}
      </ol>
    </nav>
  );
}
