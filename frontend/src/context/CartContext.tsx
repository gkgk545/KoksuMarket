"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, Item } from "@/lib/api";
import { useToast } from "@/components/feedback";

export interface CartItem extends Item {
    quantity: number; // how many are in the cart
    stock: number; // item.quantity the last time we saw it
}

interface CartContextType {
    items: CartItem[];
    addItem: (item: Item) => void;
    removeItem: (itemId: number) => void;
    removeLine: (itemId: number) => void;
    clearCart: () => void;
    totalCost: number;
    itemCount: number;
    /** Tickets left after paying for everything in the cart (can be negative). */
    remaining: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// The cart lives in localStorage per student, so it survives a refresh, the ranking page
// (which sits outside the market layout) and logging out and back in on a shared Chromebook.
const storageKey = (studentId: number) => `koksu-cart:${studentId}`;

function readStored(studentId: number): CartItem[] {
    try {
        const raw = localStorage.getItem(storageKey(studentId));
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.id === "number" && i.quantity > 0) : [];
    } catch {
        return [];
    }
}

function writeStored(studentId: number, items: CartItem[]) {
    try {
        if (items.length) localStorage.setItem(storageKey(studentId), JSON.stringify(items));
        else localStorage.removeItem(storageKey(studentId));
    } catch {
        // Storage full or blocked: the cart still works for this visit.
    }
}

// Bring a saved cart in line with the shelf as it is now: new price, new stock,
// sold-out or removed items taken out. Returns what changed so we can tell the student.
function reconcile(cart: CartItem[], shelf: Item[]) {
    const byId = new Map(shelf.map((i) => [i.id, i]));
    const gone: string[] = [];
    let trimmed = false;
    const next: CartItem[] = [];
    for (const line of cart) {
        const fresh = byId.get(line.id);
        if (!fresh || fresh.quantity <= 0) {
            gone.push(line.name);
            continue;
        }
        const quantity = Math.min(line.quantity, fresh.quantity);
        if (quantity < line.quantity) trimmed = true;
        next.push({ ...fresh, quantity, stock: fresh.quantity });
    }
    return { next, gone, trimmed };
}

interface CartProviderProps {
    studentId: number;
    balance: number;
    children: React.ReactNode;
}

export function CartProvider({ studentId, balance, children }: CartProviderProps) {
    // The market layout only mounts this after it has read the student on the client,
    // so reading localStorage while creating the state is safe (no server render).
    const [items, setItems] = useState<CartItem[]>(() => readStored(studentId));
    const [toast, toastElement] = useToast();

    // Check the saved cart against today's shelf.
    useEffect(() => {
        const saved = readStored(studentId);
        if (!saved.length) return;

        let cancelled = false;
        api.getItems()
            .then((shelf) => {
                if (cancelled) return;
                const { next, gone, trimmed } = reconcile(saved, shelf);
                setItems(next);
                if (gone.length) {
                    toast(`${gone.join(", ")}은(는) 그새 다 팔려서 장바구니에서 뺐어요.`, "error");
                } else if (trimmed) {
                    toast("남은 재고만큼만 장바구니에 남겼어요.", "error");
                }
            })
            .catch((e) => console.error("Failed to check saved cart", e));
        return () => {
            cancelled = true;
        };
    }, [studentId, toast]);

    useEffect(() => {
        writeStored(studentId, items);
    }, [studentId, items]);

    const totalCost = items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    const remaining = balance - totalCost;

    const addItem = useCallback((item: Item) => {
        // item.quantity is the stock as the caller last saw it (the shelf, or the cart line's own stock).
        const existing = items.find((i) => i.id === item.id);
        const stock = item.quantity;
        if (stock <= 0) {
            toast("품절된 상품이에요.", "error");
            return;
        }
        if (existing && existing.quantity >= stock) {
            toast(`재고가 ${stock}개뿐이라 더 담을 수 없어요.`, "error");
            return;
        }
        if (remaining < item.cost) {
            toast(`티켓이 ${item.cost - remaining}장 모자라서 더 담을 수 없어요.`, "error");
            return;
        }
        setItems((prev) =>
            prev.some((i) => i.id === item.id)
                ? prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1, stock } : i))
                : [...prev, { ...item, quantity: 1, stock: item.quantity }]
        );
    }, [items, remaining, toast]);

    const removeItem = (itemId: number) => {
        setItems((prev) => {
            const existing = prev.find((i) => i.id === itemId);
            if (existing && existing.quantity > 1) {
                return prev.map((i) =>
                    i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i
                );
            }
            return prev.filter((i) => i.id !== itemId);
        });
    };

    const removeLine = (itemId: number) => {
        setItems((prev) => prev.filter((i) => i.id !== itemId));
    };

    const clearCart = () => setItems([]);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, removeLine, clearCart, totalCost, itemCount, remaining }}>
            {children}
            {toastElement}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
}
