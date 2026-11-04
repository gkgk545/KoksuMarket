"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { api, Student } from "@/lib/api";
import { cn } from "@/lib/utils";
import styles from "@/app/market/market.module.css";

interface PaidReceipt {
    lines: { id: number; name: string; cost: number; quantity: number }[];
    total: number;
    remaining: number;
}

function todayLabel() {
    const d = new Date();
    const day = "일월화수목금토"[d.getDay()];
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${day})`;
}

// Checkout state shared by the drawer (small screens) and the side panel (wide screens).
function useCheckout(currentUser: Student | null, onPurchaseComplete: () => void) {
    const { items, totalCost, clearCart } = useCart();
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [paid, setPaid] = useState<PaidReceipt | null>(null);

    const balance = currentUser?.ticket_count ?? 0;
    const left = balance - totalCost;

    const reset = () => {
        setPaid(null);
        setConfirming(false);
        setError(null);
    };

    const checkout = async () => {
        if (!currentUser) return;
        if (left < 0) {
            setError(`티켓이 ${-left}장 모자라요.`);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const cartItems = items.map(item => ({
                id: item.id,
                quantity: item.quantity,
                cost: item.cost
            }));

            // Call single atomic RPC
            const result = await api.purchaseCartItems(currentUser.id, cartItems);

            // Update user in localStorage
            localStorage.setItem("user", JSON.stringify(result.student));

            // Refresh user tickets and trigger items refresh hook
            onPurchaseComplete();
            window.dispatchEvent(new Event("purchase_complete"));
            window.dispatchEvent(new Event("auth_refreshed"));

            setPaid({
                lines: items.map(({ id, name, cost, quantity }) => ({ id, name, cost, quantity })),
                total: totalCost,
                remaining: result.student?.ticket_count ?? result.remaining_tickets ?? left,
            });
            clearCart();
        } catch (err) {
            setError((err instanceof Error && err.message) || "구매 중 문제가 생겼어요. 다시 눌러 주세요.");
        }

        setConfirming(false);
        setLoading(false);
    };

    return { balance, left, loading, confirming, setConfirming, error, paid, reset, checkout };
}

type Checkout = ReturnType<typeof useCheckout>;

interface CartContentsProps {
    checkout: Checkout;
    currentUser: Student | null;
    /** "drawer" is the full receipt; "panel" is the compact one that sits beside the shelf. */
    variant: "drawer" | "panel";
    /** Drawer: close it. Panel: clear the paid receipt. */
    onDone: () => void;
}

// The receipt and its footer: the cart lines, the totals and the buy button.
function CartContents({ checkout, currentUser, variant, onDone }: CartContentsProps) {
    const { items, addItem, removeItem, removeLine, totalCost } = useCart();
    const { balance, left, loading, confirming, setConfirming, error, paid } = checkout;
    const isPanel = variant === "panel";

    const head = isPanel ? null : (
        <div className={styles.rTop}>
            <b>곡수마켓</b>
            <span>
                {currentUser ? `${currentUser.grade}학년 ${currentUser.name} · ` : ""}
                {todayLabel()}
            </span>
        </div>
    );

    let receipt: React.ReactNode;
    let foot: React.ReactNode;

    if (paid) {
        receipt = (
            <>
                {head}
                <ul className={styles.lines}>
                    {paid.lines.map((l) => (
                        <li key={l.id} className={styles.line}>
                            <div>
                                <div className={styles.lineName}>{l.name}</div>
                                <div className={styles.lineUnit}>{l.cost}장 × {l.quantity}</div>
                            </div>
                            <div className={styles.lineSub}>{l.cost * l.quantity}<small>장</small></div>
                        </li>
                    ))}
                </ul>
                <dl className={styles.sum}>
                    <div className={styles.total}><dt>합계</dt><dd>{paid.total}장</dd></div>
                    <div className={styles.after}><dt>남은 티켓</dt><dd>{paid.remaining}장</dd></div>
                </dl>
                <span className={styles.paid} role="img" aria-label="구매 완료 도장">구매 완료</span>
            </>
        );
        foot = (
            <>
                <p className={styles.dDone} role="status">
                    <b>구매가 끝났어요.</b> 선생님이 물건을 건네주면 구매 기록에 ‘전달 완료’로 바뀌어요.
                </p>
                <button className={styles.btn} type="button" onClick={onDone}>
                    {isPanel ? "확인" : "상품 목록으로"}
                </button>
            </>
        );
    } else if (items.length === 0) {
        receipt = (
            <>
                {head}
                <div className={styles.empty}>
                    <b>{isPanel ? "아직 담은 물건이 없어요" : "장바구니가 비었어요"}</b>
                    <p>상품 아래쪽 ‘담기’를 누르면<br />여기에 담겨요.</p>
                </div>
            </>
        );
        foot = isPanel ? null : <button className={styles.btn} type="button" onClick={onDone}>물건 고르러 가기</button>;
    } else {
        receipt = (
            <>
                {head}
                <ul className={styles.lines}>
                    {items.map((item) => (
                        <li key={item.id} className={styles.line}>
                            <div>
                                <div className={styles.lineName}>{item.name}</div>
                                <div className={styles.lineUnit}>{item.cost}장 × {item.quantity}</div>
                            </div>
                            <div className={styles.lineSub}>{item.cost * item.quantity}<small>장</small></div>
                            <div className={styles.lineRow}>
                                <div className={styles.stepper} role="group" aria-label={`${item.name} 개수`}>
                                    <button type="button" onClick={() => removeItem(item.id)} aria-label="하나 빼기" disabled={loading}>
                                        <Minus aria-hidden="true" />
                                    </button>
                                    <output>{item.quantity}</output>
                                    <button
                                        type="button"
                                        onClick={() => addItem({ ...item, quantity: item.stock })}
                                        aria-label="하나 더"
                                        disabled={loading || item.quantity >= item.stock || left < item.cost}
                                    >
                                        <Plus aria-hidden="true" />
                                    </button>
                                </div>
                                <button className={styles.rm} type="button" onClick={() => removeLine(item.id)} disabled={loading}>
                                    빼기
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
                <dl className={styles.sum}>
                    <div className={styles.total}><dt>합계</dt><dd>{totalCost}장</dd></div>
                    <div><dt>보유 티켓</dt><dd>{balance}장</dd></div>
                    <div className={cn(styles.after, left < 0 && styles.neg)}>
                        <dt>구매 후 남는 티켓</dt>
                        <dd>{left < 0 ? `모자라요 (${-left}장)` : `${left}장`}</dd>
                    </div>
                </dl>
            </>
        );
        foot = confirming ? (
            <>
                <p className={styles.dConfirm}>티켓 {totalCost}장을 쓸까요? 산 뒤에는 취소할 수 없어요.</p>
                <div className={styles.confirmRow}>
                    <button className={cn(styles.btn, styles.ghost)} type="button" onClick={() => setConfirming(false)} disabled={loading}>
                        취소
                    </button>
                    <button className={styles.btn} type="button" onClick={checkout.checkout} disabled={loading}>
                        {loading ? "사는 중…" : "네, 살게요"}
                    </button>
                </div>
            </>
        ) : (
            <>
                <button className={styles.btn} type="button" onClick={() => setConfirming(true)} disabled={left < 0}>
                    {totalCost}장으로 구매하기
                </button>
                {left < 0 ? (
                    <p className={cn(styles.dNote, styles.bad)}>티켓이 {-left}장 모자라요. 물건을 조금 빼 주세요.</p>
                ) : (
                    <p className={styles.dNote}>구매하면 선생님께 전달 요청이 가요.</p>
                )}
            </>
        );
    }

    return (
        <>
            <div className={styles.dBody}>
                <div className={styles.receipt}>{receipt}</div>
            </div>
            {(error || foot) && (
                <div className={styles.dFoot}>
                    {error && <p className={styles.dError} role="alert">{error}</p>}
                    {foot}
                </div>
            )}
        </>
    );
}

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: Student | null;
    onPurchaseComplete: () => void;
}

export function CartDrawer({ isOpen, onClose, currentUser, onPurchaseComplete }: CartDrawerProps) {
    const checkout = useCheckout(currentUser, onPurchaseComplete);
    const drawerRef = useRef<HTMLElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    const handleClose = () => {
        checkout.reset();
        onClose();
    };

    // Focus, scroll lock, Escape and a simple focus trap while open
    useEffect(() => {
        if (!isOpen) return;
        const lastFocus = document.activeElement as HTMLElement | null;
        document.body.style.overflow = "hidden";
        closeRef.current?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handleClose();
                return;
            }
            if (e.key !== "Tab" || !drawerRef.current) return;
            const focusable = drawerRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
            lastFocus?.focus();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            <div className={styles.scrim} onClick={handleClose} />
            <aside ref={drawerRef} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="cart-title">
                <div className={styles.dHead}>
                    <h2 id="cart-title">장바구니</h2>
                    <button ref={closeRef} className={styles.x} type="button" onClick={handleClose} aria-label="장바구니 닫기">
                        <X aria-hidden="true" />
                    </button>
                </div>
                <CartContents checkout={checkout} currentUser={currentUser} variant="drawer" onDone={handleClose} />
            </aside>
        </>
    );
}

interface CartPanelProps {
    currentUser: Student | null;
    onPurchaseComplete: () => void;
}

// Wide screens: the cart stays open beside the shelf, so what is in it is always in view.
export const CartPanel = forwardRef<HTMLElement, CartPanelProps>(function CartPanel({ currentUser, onPurchaseComplete }, ref) {
    const checkout = useCheckout(currentUser, onPurchaseComplete);
    const { itemCount } = useCart();

    return (
        <aside ref={ref} className={styles.cartPanel} aria-labelledby="cart-panel-title" tabIndex={-1}>
            <div className={styles.dHead}>
                <h2 id="cart-panel-title">장바구니</h2>
                {itemCount > 0 && <span className={styles.panelCount}>{itemCount}개</span>}
            </div>
            <CartContents checkout={checkout} currentUser={currentUser} variant="panel" onDone={checkout.reset} />
        </aside>
    );
});
