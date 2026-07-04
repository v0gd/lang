import { ReactNode, useEffect, useState } from "react";
import { lstr } from "./localization";

const ROTATE_INTERVAL_MS = 5000;

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
  headline,
  rotatingMessages,
}: {
  l: string;
  message: string;
  icon: ReactNode;
  onCancel: () => void;
  // Optional one-line echo of what was requested ("Your B1 story is on its
  // way — Scary · Cooking"), shown above the animation.
  headline?: string;
  // Optional playful status lines rotated in place of the static message.
  // The static message is always shown first, so the overlay works the same
  // while the lines are still loading (or failed to load).
  rotatingMessages?: string[];
}) {
  const [messageIdx, setMessageIdx] = useState(0);
  const messages = [message, ...(rotatingMessages ?? [])];
  const haveRotation = messages.length > 1;

  useEffect(() => {
    if (!haveRotation) return;
    const interval = setInterval(
      () => setMessageIdx((idx) => idx + 1),
      ROTATE_INTERVAL_MS,
    );
    return () => clearInterval(interval);
  }, [haveRotation]);

  const currentMessage = messages[messageIdx % messages.length];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-live="polite"
    >
      <div className="bg-surface border border-border rounded-2xl px-8 py-7 shadow-2xl flex flex-col items-center gap-6 min-w-[280px] max-w-[90vw]">
        {headline && (
          <div className="text-sm text-secondary-text text-center max-w-[320px]">
            {headline}
          </div>
        )}
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

        <div className="flex items-baseline justify-center min-h-[3rem] max-w-[320px]">
          {/* Keyed by index so each line change remounts the span and replays
              the fade-in animation. min-h above keeps the card from jumping
              when lines wrap to a different number of rows. */}
          <span
            key={messageIdx}
            className="font-semibold text-main-text text-base text-center animate-progress-line"
          >
            {currentMessage}
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
          className="btn-secondary mt-1 px-6 py-2.5 font-semibold min-w-[140px]"
        >
          {lstr(l).cancel_button}
        </button>
      </div>
    </div>
  );
}
