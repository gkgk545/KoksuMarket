"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, CircleAlert } from "lucide-react";
import { Dialog } from "./Dialog";
import { cn } from "@/lib/utils";
import styles from "./kit.module.css";

interface ConfirmOptions {
    title: string;
    message?: string;
    confirmLabel?: string;
    danger?: boolean;
}

// Replaces window.confirm with a dialog in the market's own style.
// Usage: const [confirm, confirmDialog] = useConfirm(); if (await confirm({...})) ...; render {confirmDialog}.
export function useConfirm() {
    const [pending, setPending] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

    const confirm = useCallback((options: ConfirmOptions) => {
        return new Promise<boolean>((resolve) => setPending({ ...options, resolve }));
    }, []);

    const settle = (ok: boolean) => {
        pending?.resolve(ok);
        setPending(null);
    };

    const element = pending ? (
        <Dialog
            title={pending.title}
            onClose={() => settle(false)}
            footer={
                <>
                    <button type="button" className={cn(styles.btn, styles.ghost)} onClick={() => settle(false)}>
                        그만두기
                    </button>
                    <button
                        type="button"
                        className={cn(styles.btn, pending.danger && styles.danger)}
                        onClick={() => settle(true)}
                        data-autofocus
                    >
                        {pending.confirmLabel ?? "확인"}
                    </button>
                </>
            }
        >
            {pending.message && <p className={styles.message}>{pending.message}</p>}
        </Dialog>
    ) : null;

    return [confirm, element] as const;
}

type Tone = "ok" | "error";

// Replaces window.alert for results: a short note at the bottom of the screen.
export function useToast() {
    const [toast, setToast] = useState<{ text: string; tone: Tone; key: number } | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

    const show = useCallback((text: string, tone: Tone = "ok") => {
        clearTimeout(timer.current);
        setToast({ text, tone, key: Date.now() });
        timer.current = setTimeout(() => setToast(null), tone === "error" ? 4500 : 2600);
    }, []);

    useEffect(() => () => clearTimeout(timer.current), []);

    const element = toast
        ? createPortal(
            <div
                key={toast.key}
                className={cn(styles.toast, toast.tone === "error" && styles.toastError)}
                role={toast.tone === "error" ? "alert" : "status"}
            >
                {toast.tone === "error" ? <CircleAlert aria-hidden="true" /> : <Check aria-hidden="true" />}
                {toast.text}
            </div>,
            document.body
        )
        : null;

    return [show, element] as const;
}
