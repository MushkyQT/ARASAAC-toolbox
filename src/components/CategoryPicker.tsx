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
            className={`rounded-full border-2 transition ${size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"} ${
              active ? "font-semibold" : "opacity-60 hover:opacity-100"
            }`}
            style={{
              borderColor: c.color,
              background: active ? c.color : "white",
              color: active ? c.onColor : "#44403c",
            }}
          >
            {c.short}
          </button>
        );
      })}
    </div>
  );
}
