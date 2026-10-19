"use client";

import { CATEGORIES, CATEGORY_ORDER, type CategoryCode } from "@/lib/categories";

interface Props {
  value: CategoryCode;
  onChange: (c: CategoryCode) => void;
  label: string;
  size?: "sm" | "md";
}

/** Choix de la couleur / nature du mot. */
export function CategoryPicker({ value, onChange, label, size = "sm" }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {CATEGORY_ORDER.map((code) => {
        const c = CATEGORIES[code];
        const active = code === value;
        return (
          <button
            key={code}
            role="radio"
            aria-checked={active}
            title={c.label}
            onClick={() => onChange(code)}
            className={`cursor-pointer rounded-control border-2 font-bold transition-colors duration-(--duration-swap) ease-out ${
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-xs"
            } ${active ? "" : "bg-sheet text-ink-soft hover:bg-tack hover:text-ink"}`}
            style={{ borderColor: c.color, ...(active ? { background: c.color, color: c.onColor } : {}) }}
          >
            {c.short}
          </button>
        );
      })}
    </div>
  );
}
