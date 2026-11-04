"use client";

import { Item } from "@/lib/api";
import { Minus, Plus, TriangleAlert } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";
import styles from "@/app/market/market.module.css";

interface ProductCardProps {
    item: Item;
    balance: number; // student's current tickets
}

// Coloured paper behind the stamped word when an item has no photo
const FACE_COLORS = [styles.sky, styles.apricot, styles.mint, styles.sand];

function faceWord(name: string) {
    const first = name.trim().split(/\s+/)[0] ?? name;
    return first.length > 5 ? first.slice(0, 4) : first;
}

export function ProductCard({ item, balance }: ProductCardProps) {
    const { items: cart, addItem, removeItem, remaining } = useCart();
    const inCart = cart.find((c) => c.id === item.id)?.quantity ?? 0;
    const isSoldOut = item.quantity <= 0;
    const isLowStock = !isSoldOut && item.quantity <= 3;
    const isShort = !isSoldOut && balance < item.cost;
    // Affordable on its own, but not on top of what is already in the cart.
    const cartFull = !isSoldOut && !isShort && remaining < item.cost;

    let action: React.ReactNode;
    if (isSoldOut) {
        action = <button className={styles.btn} type="button" disabled>품절</button>;
    } else if (inCart > 0) {
        action = (
            <div className={styles.stepper} role="group" aria-label={`${item.name} 개수`}>
                <button type="button" onClick={() => removeItem(item.id)} aria-label="하나 빼기">
                    <Minus aria-hidden="true" />
                </button>
                <output>{inCart}</output>
                <button
                    type="button"
                    onClick={() => addItem(item)}
                    disabled={inCart >= item.quantity || remaining < item.cost}
                    aria-label="하나 더 담기"
                    title={remaining < item.cost ? "남은 티켓이 모자라요" : undefined}
                >
                    <Plus aria-hidden="true" />
                </button>
            </div>
        );
    } else if (isShort) {
        action = <button className={styles.btn} type="button" disabled>티켓 {item.cost - balance}장 부족</button>;
    } else if (cartFull) {
        action = (
            <button className={styles.btn} type="button" disabled title="장바구니에 담은 물건을 빼면 담을 수 있어요">
                남은 티켓 부족
            </button>
        );
    } else {
        action = <button className={styles.btn} type="button" onClick={() => addItem(item)}>담기</button>;
    }

    return (
        <div className={styles.tw}>
            <article
                className={cn(styles.tk, isSoldOut && styles.out, (isShort || cartFull) && styles.short)}
                aria-label={`${item.name}, ${item.cost}장`}
            >
                <div className={cn(styles.face, !item.image_url && FACE_COLORS[item.id % FACE_COLORS.length])}>
                    {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt="" />
                    ) : (
                        <span className={styles.word} aria-hidden="true">{faceWord(item.name)}</span>
                    )}
                    {isSoldOut && <span className={styles.stampMark}>품절</span>}
                    {isLowStock && (
                        <span className={styles.lowTag}>
                            <TriangleAlert aria-hidden="true" />
                            품절 임박
                        </span>
                    )}
                </div>
                <div className={styles.info}>
                    <h3>{item.name}</h3>
                    <p className={styles.meta}>
                        {isSoldOut ? (
                            <span>다음 입고를 기다려요</span>
                        ) : isLowStock ? (
                            <span className={styles.warn}>{item.quantity}개 남음</span>
                        ) : (
                            <span>재고 {item.quantity}개</span>
                        )}
                    </p>
                    {item.link && (
                        <a className={styles.more} href={item.link} target="_blank" rel="noopener noreferrer">
                            자세히 보기
                        </a>
                    )}
                </div>
                <div className={styles.stub}>
                    <p className={styles.price}>
                        <b>{item.cost}</b>
                        <span>장</span>
                    </p>
                    {action}
                </div>
            </article>
        </div>
    );
}
