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

  useEffect(() => {
    ref.current?.showModal();
  });

  return (
    <dialog
      className={`flex flex-col rounded-xl max-w-[90%] w-[600px] bg-white shadow-lg backdrop:bg-black/70 backdrop:backdrop-blur-md ${height}`}
      ref={ref}
      onCancel={closeModal}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        // If click is outside the dialog’s rectangle, close the modal
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
      <div className="flex-grow p-4">{children}</div>
      {showCloseButton && (
        <div className="flex justify-center">
          <button
            className="p-4 text-lg font-semibold text-gray-800 flex items-center"
            onClick={closeModal}
          >
            <IoClose className="inline mt-[2px]" />
            {lstr(locale).close_button_caption}
          </button>
        </div>
      )}
    </dialog>
  );
}
