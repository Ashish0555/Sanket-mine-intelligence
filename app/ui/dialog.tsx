import { useEffect, useRef, type ReactNode, type RefObject } from "react";

export function useModalFocus(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    const shellChild = dialog.closest(".app-shell > *");
    const siblings = Array.from(
      shellChild?.parentElement?.children || [],
    ).filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && element !== shellChild,
    );
    const originalInert = siblings.map((element) => element.inert);
    siblings.forEach((element) => {
      element.inert = true;
    });
    document.body.style.overflow = "hidden";
    const candidates = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ),
      ).filter(
        (element) =>
          element.getClientRects().length && !element.closest("[inert]"),
      );
    (candidates()[0] || dialog).focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== "Tab") return;
      const elements = candidates();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first) {
        event.preventDefault();
        dialog.focus();
      } else if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      siblings.forEach((element, index) => {
        element.inert = originalInert[index];
      });
      if (previousFocus?.isConnected && !previousFocus.closest("[inert]"))
        previousFocus.focus();
    };
  }, [open, ref, onClose]);
}

export function Dialog({
  children,
  label,
  labelledBy,
  onClose,
  drawer = false,
}: {
  children: ReactNode;
  label?: string;
  labelledBy?: string;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useModalFocus(ref, true, onClose);
  return (
    <div
      className={drawer ? "drawer-backdrop" : "modal-backdrop"}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className={drawer ? "source-drawer" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>
  );
}
