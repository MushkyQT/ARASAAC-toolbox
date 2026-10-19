interface Props {
  title: string;
  onTitle: (title: string) => void;
  /** Nombre de mots du texte. */
  words: number;
  onEdit: () => void;
  onNew: () => void;
}

/** Le texte une fois analysé : son titre (qui nomme aussi les fichiers), sa longueur, et comment le changer. */
export function SourceSummary({ title, onTitle, words, onEdit, onNew }: Props) {
  return (
    <div className="sheet flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:px-6 sm:py-5">
      <div className="flex min-w-[14rem] flex-1 flex-col gap-0.5">
        <input
          id="doc-title"
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Sans titre"
          className="inline-field font-display text-keyword font-bold"
        />
        <label htmlFor="doc-title" className="px-1 text-sm text-ink-soft">
          Titre du document, qui nomme aussi les fichiers téléchargés · <span className="tabular-nums">{words.toLocaleString("fr-FR")} mots</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={onEdit} className="btn-secondary btn-sm">
          <span>Modifier<span className="hidden sm:inline"> le texte</span></span>
        </button>
        <button onClick={onNew} className="btn-secondary btn-sm">
          <span>Nouveau<span className="hidden sm:inline"> document</span></span>
        </button>
      </div>
    </div>
  );
}
