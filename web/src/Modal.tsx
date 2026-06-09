import { useEffect, useRef } from "react";
import { lstr } from "./localization";
import { IoClose } from "react-icons/io5";

export function Modal({
  showCloseButton,
  locale,
  closeModal,
  children,
  height,
}: {
  showCloseButton: boolean;
  locale: string;
  closeModal: () => void;
  children: React.ReactNode;
  height?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  // Run once on mount: calling showModal() on an already-open dialog throws
  // an InvalidStateError, so this must not re-run on re-renders.
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      className={`flex flex-col rounded-2xl max-w-[90%] w-[600px] bg-surface border border-border shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm ${height}`}
      ref={ref}
      onCancel={closeModal}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          closeModal();
        }
      }}
    >
      <div className="flex-grow p-5">{children}</div>
      {showCloseButton && (
        <div className="flex justify-center border-t border-border">
          <button
            className="p-4 text-sm font-medium text-secondary-text hover:text-main-text flex items-center gap-1 transition-colors"
            onClick={closeModal}
          >
            <IoClose className="text-lg" />
            {lstr(locale).close_button_caption}
          </button>
        </div>
      )}
    </dialog>
  );
}
