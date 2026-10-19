"use client";

import { useEffect, useRef } from "react";
import type { Project } from "@/lib/store";
import { IconClose, IconUndo } from "./icons";

export interface ToastMessage {
  id: number;
  text: string;
  /** État à rétablir si l'on clique sur « Annuler ». */
  undo?: Project;
}

const DURATION_MS = 10_000;

/** Confirmation discrète d'une action, avec « Annuler » plutôt qu'une demande de confirmation. */
export function Toast({
  message,
  onUndo,
  onDismiss,
}: {
  message: ToastMessage | null;
  onUndo: (snapshot: Project) => void;
  onDismiss: () => void;
}) {
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => dismiss.current(), DURATION_MS);
    return () => clearTimeout(t);
  }, [message]);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      {message && (
        <div
          key={message.id}
          className="toast pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-control bg-ink py-2 pl-4 pr-2 text-sm text-sheet shadow-dialog"
        >
          <p className="min-w-0 flex-1 py-1">{message.text}</p>
          {message.undo && (
            <button
              onClick={() => onUndo(message.undo!)}
              className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-control px-3 font-bold text-sheet transition-colors duration-(--duration-swap) ease-out hover:bg-sheet/15"
            >
              <IconUndo size={16} />
              Annuler
            </button>
          )}
          <button
            onClick={onDismiss}
            aria-label="Fermer le message"
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-control text-sheet/80 transition-colors duration-(--duration-swap) ease-out hover:bg-sheet/15 hover:text-sheet"
          >
            <IconClose size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
