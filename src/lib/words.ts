// Nouvelle analyse du même document (passage inclus ou ignoré, texte retouché) : les choix déjà
// faits sur chaque mot sont conservés, seuls les faits tirés du texte sont mis à jour.
import type { WordItem } from "@/lib/types";

interface MergeOptions {
  /** Les mots nouveaux gardent la présélection de l'analyse (sinon ils arrivent décochés). */
  selectNew: boolean;
  /** Garder les mots que la nouvelle analyse ne trouve plus (sinon seuls les mots ajoutés à la main restent). */
  keepMissing?: boolean;
}

export function mergeWords(prev: WordItem[], fresh: WordItem[], { selectNew, keepMissing = false }: MergeOptions): WordItem[] {
  const before = new Map(prev.map((w) => [w.id, w]));
  const found = new Set(fresh.map((w) => w.id));
  const copiesOf = (id: string) => prev.filter((w) => w.copyOf === id);
  const out: WordItem[] = [];

  for (const f of fresh) {
    const p = before.get(f.id);
    out.push(
      p
        ? {
            ...f,
            selected: p.selected,
            candidates: p.candidates,
            pictoId: p.pictoId,
            pictoChosen: p.pictoChosen,
            customImage: p.customImage,
            label: p.label,
            category: p.category,
            categoryLocked: p.categoryLocked,
            plural: p.plural,
            noColor: p.noColor,
          }
        : selectNew
          ? f
          : { ...f, selected: false },
    );
    // Les cartes « autre sens » suivent leur mot.
    for (const c of copiesOf(f.id)) {
      out.push({ ...c, firstIndex: f.firstIndex, spans: f.spans, example: f.example, count: f.count, forms: f.forms });
    }
  }

  for (const p of prev) {
    if (p.copyOf || found.has(p.id) || !(p.manual || keepMissing)) continue;
    out.push(p, ...copiesOf(p.id));
  }
  return out;
}
