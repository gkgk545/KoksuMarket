"use client";

import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import styles from "@/app/market/market.module.css";

// Narrow screens (and market pages without the side panel): a strip pinned to the bottom
// while something is in the cart, so an unpaid cart is never out of sight.
export function CartBar({ onOpen }: { onOpen: () => void }) {
    const { itemCount, totalCost, remaining } = useCart();
    if (itemCount === 0) return null;

    return (
        <div className={styles.cartBar} role="region" aria-label="장바구니 요약">
            <div className={styles.cartBarIn}>
                <ShoppingCart className={styles.icon} aria-hidden="true" />
                <p className={styles.cartBarText}>
                    <span>
                        <b>{itemCount}개</b> 담음 · 합계 <b>{totalCost}장</b>
                    </span>
                    <small className={cn(remaining < 0 && styles.cartBarBad)}>
                        {remaining < 0 ? `티켓이 ${-remaining}장 모자라요` : "아직 구매하지 않았어요"}
                    </small>
                </p>
                <button type="button" className={cn(styles.btn, styles.cartBarBtn)} onClick={onOpen}>
                    구매하러 가기
                </button>
            </div>
        </div>
    );
}
