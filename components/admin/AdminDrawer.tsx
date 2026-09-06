"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useToast } from "./Toast";

/** Native modal semantics keep focus inside, make the background inert,
 * and return focus to the opener, including nested confirmation dialogs. */
export default function AdminDrawer({ children, labelledBy, onClose }: {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { setToastHost } = useToast();
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="adm-drawer"
      aria-labelledby={labelledBy}
      onCancel={(e) => { e.preventDefault(); close.current(); }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
          close.current();
        }
      }}
    >
      {children}
      <div ref={setToastHost} className="adm-toast-host" />
    </dialog>
  );
}
