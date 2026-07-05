import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CancelledError,
  DisallowedContentError,
  NoTargetLanguageError,
  useUploadMutation,
} from "./queries";
import { useLoggedIn } from "./firebase";
import { lstr } from "./localization";
import { ProgressOverlay } from "./ProgressOverlay";
import { FaPenToSquare } from "react-icons/fa6";

// MAX_CHARS mirrors upload.MaxInputChars on the Go side; the backend
// re-validates with utf8.RuneCountInString so any client-side bypass is
// caught.
const MAX_CHARS = 10_000;

export function UploadView({ l, r }: { l: string; r: string }) {
  const [text, setText] = useState<string>("");
  const navigate = useNavigate();
  const upload = useUploadMutation();
  const loggedIn = useLoggedIn();
  const abortRef = useRef<AbortController | null>(null);

  // UI chrome is rendered in the user's mother tongue (`l`), same convention
  // as the rest of the app. `r` is only used for the actual upload request.
  const strings = lstr(l);

  const handleSubmit = () => {
    if (!loggedIn) {
      navigate("/login");
      return;
    }
    // Allow submitting from the error state (retry); block only while a
    // request is in flight or when we're about to navigate after success.
    if (upload.isPending || upload.isSuccess) return;
    const trimmed = text.trim();
    if (trimmed === "") return;
    abortRef.current = new AbortController();
    upload.mutate({ text: trimmed, r, signal: abortRef.current.signal });
  };

  const cancelUpload = () => {
    abortRef.current?.abort();
  };

  useEffect(() => {
    if (upload.isSuccess) {
      navigate(`/generated/${upload.data.id}`);
    }
  }, [upload.isSuccess, upload.data, navigate]);

  // Treat cancellation as a silent reset - same pattern as generate/scan -
  // so the textarea stays editable and the button label returns to "Upload"
  // instead of an error state.
  useEffect(() => {
    if (upload.isError && upload.error instanceof CancelledError) {
      upload.reset();
    }
  }, [upload.isError, upload.error, upload]);

  const sectionLabel =
    "text-xs font-semibold uppercase tracking-[0.2em] leading-none text-secondary-text";

  // Errors are shown in a red line above the submit button; the button
  // itself always keeps its action label so it stays tappable for a retry.
  // CancelledError is excluded: the reset effect above clears it, and this
  // guard prevents a one-frame flash of the generic message before that
  // effect runs.
  const errorMessage = (() => {
    if (!upload.isError || upload.error instanceof CancelledError) return null;
    const err = upload.error;
    if (err instanceof DisallowedContentError)
      return strings.upload_error_disallowed;
    if (err instanceof NoTargetLanguageError)
      return strings.upload_error_no_target_text;
    return strings.upload_error_generic;
  })();

  const buttonLabel = !loggedIn
    ? strings.upload_login_prompt
    : upload.isPending
      ? strings.upload_in_progress
      : strings.upload_submit;

  const trimmedEmpty = text.trim() === "";
  const tooLong = text.length > MAX_CHARS;
  const canSubmit = !loggedIn || (!upload.isPending && !trimmedEmpty && !tooLong);

  const counter = (
    <span
      className={
        tooLong
          ? "text-xs font-semibold text-red-500"
          : "text-xs text-muted-text"
      }
    >
      {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()}
    </span>
  );

  return (
    <div className="flex flex-col gap-8">
      {upload.isPending && (
        <ProgressOverlay
          l={l}
          message={strings.upload_overlay_message}
          icon={<FaPenToSquare />}
          onCancel={cancelUpload}
        />
      )}
      <header>
        <h1 className="font-literata text-3xl md:text-4xl font-bold tracking-tight text-main-text leading-tight">
          {strings.upload_title_pre}{" "}
          <span className="text-primary">{strings.upload_title_post}</span>
        </h1>
      </header>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className={sectionLabel}>{strings.upload_textarea_heading}</h2>
          {counter}
        </div>
        <textarea
          value={text}
          onChange={(e) => {
            if (upload.isError) upload.reset();
            setText(e.target.value);
          }}
          maxLength={MAX_CHARS}
          rows={14}
          placeholder={strings.upload_textarea_placeholder}
          disabled={upload.isPending}
          className="w-full p-4 rounded-xl border border-border bg-surface text-main-text placeholder:text-muted-text focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y disabled:opacity-60"
        />
        {tooLong && (
          <div className="mt-2 text-sm font-semibold text-red-500">
            {strings.upload_too_long}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        {errorMessage && (
          <div
            role="alert"
            className="text-sm font-semibold text-red-500 text-center"
          >
            {errorMessage}
          </div>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full py-4 rounded-xl bg-primary text-white text-lg font-bold transition-colors hover:bg-primary-hover disabled:opacity-50"
          disabled={!canSubmit}
        >
          {buttonLabel}
        </button>
      </section>
    </div>
  );
}
