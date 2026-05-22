import { ReactNode } from "react";
import { lstr } from "./localization";

// ProgressOverlay is the shared in-flight modal used by generate, scan, and
// upload. It is intentionally not dismissable by clicking outside or pressing
// escape - the only way to leave it is to wait for the request to finish or
// to press Cancel. Cancel aborts the in-flight HTTP request via the
// AbortController the caller passes into the mutation; the backend may
// continue processing for a few seconds (current LLM calls are not yet
// cancellable from the client), but the user-visible flow ends immediately.
//
// Visual design notes:
// - Backdrop is a blurred dark scrim, focusing attention on the modal.
// - The animation has three layered elements: a soft pulsing halo, a slow
//   orbital ring with a single bright dot, and a central icon that breathes.
//   Layered motion at three different frequencies reads as more alive than
//   any single animation.
// - The status message is followed by an ellipsis whose three dots animate
//   in sequence to hint that work is ongoing even if the visual loop is
//   subtle.
export function ProgressOverlay({
  l,
  message,
  icon,
  onCancel,
}: {
  l: string;
  message: string;
  icon: ReactNode;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
    >
      <div className="bg-surface border border-border rounded-2xl px-8 py-7 shadow-2xl flex flex-col items-center gap-6 min-w-[280px] max-w-[90vw]">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <span
            aria-hidden
            className="absolute inset-0 rounded-full bg-primary/15 animate-progress-halo"
          />
          <span
            aria-hidden
            className="absolute inset-0 animate-progress-orbit"
            style={{ transformOrigin: "50% 50%" }}
          >
            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_12px_2px_rgb(var(--primary-rgb,_0_0_0)/0.6)]" />
            <span className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary/60" />
            <span className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary/40" />
            <span className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-primary/30" />
          </span>
          <span className="text-primary text-3xl animate-progress-breathe">
            {icon}
          </span>
        </div>

        <div className="flex items-baseline justify-center">
          <span className="font-semibold text-main-text text-base text-center">
            {message}
          </span>
          <span aria-hidden className="inline-flex ml-0.5">
            <span className="animate-progress-dot-1 font-semibold text-main-text">
              .
            </span>
            <span className="animate-progress-dot-2 font-semibold text-main-text">
              .
            </span>
            <span className="animate-progress-dot-3 font-semibold text-main-text">
              .
            </span>
          </span>
        </div>

        <button
          type="button"
          onClick={onCancel}
          className="mt-1 px-6 py-2.5 rounded-xl font-semibold border border-border bg-surface hover:bg-cream-dark text-main-text transition-colors min-w-[140px]"
        >
          {lstr(l).cancel_button}
        </button>
      </div>
    </div>
  );
}
