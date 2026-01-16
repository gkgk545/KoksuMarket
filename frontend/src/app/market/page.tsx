"use client";

import { useEffect, useState } from "react";
import { api, Item, Student } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { Loader2 } from "lucide-react";

export default function MarketPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [user, setUser] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Get user from localStorage (it should be fresh from layout sync, but layout syncs async)
        // Actually layout fetches fresh data. We can read from localStorage for render speed
        // or re-fetch. Since Layout passes children, children remount? No.
        // Let's just read localStorage.
        const stored = localStorage.getItem("user");
        if (stored) setUser(JSON.parse(stored));

        api.getItems()
            .then(setItems)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold mb-6">판매 중인 물건</h1>

            {items.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-dashed">
                    <p className="text-gray-500">등록된 물건이 없습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {items.map((item) => (
                        <ProductCard
                            key={item.id}
                            item={item}
                            canBuy={user ? user.ticket_count >= item.cost : false}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
