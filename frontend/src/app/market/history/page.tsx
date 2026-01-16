"use client";

import { useEffect, useState } from "react";
import { api, Student, Purchase } from "@/lib/api";
import { Loader2, Package, Clock, CheckCircle2 } from "lucide-react";

export default function HistoryPage() {
    const [user, setUser] = useState<Student | null>(null);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const stored = localStorage.getItem("user");
        if (stored) {
            const parsedUser = JSON.parse(stored);
            setUser(parsedUser);

            // Fetch detailed user data including purchases
            api.getStudentDetail(parsedUser.id)
                .then((data) => {
                    // Sorting purchases by timestamp descending (newest first)
                    const sorted = data.purchases.sort((a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );
                    setPurchases(sorted);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Package className="w-6 h-6 text-purple-600" />
                구매 기록
            </h1>

            {purchases.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-dashed dark:border-slate-700">
                    <p className="text-gray-500">아직 구매한 물건이 없습니다.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {purchases.map((purchase) => {
                        const date = new Date(purchase.timestamp).toLocaleString('ko-KR', {
                            year: '2-digit', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        });

                        return (
                            <div key={purchase.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">{purchase.item_name}</h3>
                                    <p className="text-gray-500 text-sm flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {date}
                                    </p>
                                </div>

                                <div className="flex items-center justify-between md:justify-end gap-6">
                                    <div className="text-right">
                                        <div className="font-bold text-purple-600">{purchase.item_cost} Tickets</div>
                                    </div>

                                    <div className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 ${purchase.is_delivered
                                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                            : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 animate-pulse"
                                        }`}>
                                        {purchase.is_delivered ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4" />
                                                전달 완료
                                            </>
                                        ) : (
                                            <>
                                                <Package className="w-4 h-4" />
                                                준비 중
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
