"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import styles from "./kit.module.css";

interface DialogProps {
    title: string;
    description?: React.ReactNode;
    onClose: () => void;
    children?: React.ReactNode;
    footer?: React.ReactNode;
    width?: number;
}

// A sheet of receipt paper over the page. Escape and the scrim close it; Tab stays inside.
export function Dialog({ title, description, onClose, children, footer, width }: DialogProps) {
    const ref = useRef<HTMLDivElement>(null);
    const titleId = useId();
    const closeRef = useRef(onClose);

    useEffect(() => {
        closeRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const lastFocus = document.activeElement as HTMLElement | null;
        const node = ref.current;
        const first = node?.querySelector<HTMLElement>("input, textarea, select, [data-autofocus]");
        (first ?? node?.querySelector<HTMLElement>("button"))?.focus();
        document.body.style.overflow = "hidden";

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeRef.current();
                return;
            }
            if (e.key !== "Tab" || !node) return;
            const focusable = node.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea, select, a[href]");
            if (!focusable.length) return;
            const head = focusable[0];
            const tail = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === head) {
                e.preventDefault();
                tail.focus();
            } else if (!e.shiftKey && document.activeElement === tail) {
                e.preventDefault();
                head.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
            lastFocus?.focus();
        };
    }, []);

    return createPortal(
        <div className={styles.scrim} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div
                ref={ref}
                className={styles.dialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                style={width ? ({ "--dialog-w": `${width}px` } as React.CSSProperties) : undefined}
            >
                <div className={styles.dHead}>
                    <div>
                        <h2 id={titleId}>{title}</h2>
                        {description && <p>{description}</p>}
                    </div>
                    <button type="button" className={styles.x} onClick={onClose} aria-label="닫기">
                        <X aria-hidden="true" />
                    </button>
                </div>
                {children && <div className={styles.dBody}>{children}</div>}
                {footer && <div className={styles.dFoot}>{footer}</div>}
            </div>
        </div>,
        document.body
    );
}
