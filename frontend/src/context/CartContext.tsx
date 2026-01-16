"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { Item } from "@/lib/api";

interface CartItem extends Item {
    quantity: number;
}

interface CartContextType {
    items: CartItem[];
    addItem: (item: Item) => void;
    removeItem: (itemId: number) => void;
    clearCart: () => void;
    totalCost: number;
    itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<CartItem[]>([]);

    // Calculate totals
    const totalCost = items.reduce((sum, item) => sum + item.cost * item.quantity, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

    const addItem = (item: Item) => {
        setItems((prev) => {
            const existing = prev.find((i) => i.id === item.id);
            if (existing) {
                if (existing.quantity >= item.quantity) {
                    alert(`재고가 ${item.quantity}개만 남아있어 더 담을 수 없습니다.`);
                    return prev;
                }
                return prev.map((i) =>
                    i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                );
            }
            if (item.quantity <= 0) {
                alert('품절된 상품입니다.');
                return prev;
            }
            return [...prev, { ...item, quantity: 1 }];
        });
    };

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

    const clearCart = () => setItems([]);

    return (
        <CartContext.Provider value={{ items, addItem, removeItem, clearCart, totalCost, itemCount }}>
            {children}
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
