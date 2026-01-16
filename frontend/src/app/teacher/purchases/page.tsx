"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Check, Loader2, Package } from "lucide-react";
import { motion } from "framer-motion";

interface PurchaseWithDetails {
    id: number;
    timestamp: string;
    is_delivered: boolean;
    student: { name: string; grade: number };
    item: { name: string; cost: number };
}

export default function PurchasesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [purchases, setPurchases] = useState<PurchaseWithDetails[]>([]);
    const [filter, setFilter] = useState<"all" | "pending" | "delivered">("pending");

    useEffect(() => {
        const auth = localStorage.getItem("teacherAuth");
        if (!auth) {
            router.push("/teacher");
            return;
        }
        loadPurchases();
    }, [router]);

    const loadPurchases = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("market_purchase")
            .select(`
                id,
                timestamp,
                is_delivered,
                market_student (name, grade),
                market_item (name, cost)
            `)
            .order("timestamp", { ascending: false });

        if (error) {
            console.error("Failed to load purchases:", error);
        } else {
            const transformed = (data || []).map((p: any) => ({
                id: p.id,
                timestamp: p.timestamp,
                is_delivered: p.is_delivered,
                student: p.market_student,
                item: p.market_item,
            }));
            setPurchases(transformed);
        }
        setLoading(false);
    };

    const toggleDelivered = async (purchaseId: number, currentStatus: boolean) => {
        const { error } = await supabase
            .from("market_purchase")
            .update({ is_delivered: !currentStatus })
            .eq("id", purchaseId);

        if (error) {
            alert("상태 변경 실패: " + error.message);
        } else {
            loadPurchases();
        }
    };

    const filteredPurchases = purchases.filter((p) => {
        if (filter === "pending") return !p.is_delivered;
        if (filter === "delivered") return p.is_delivered;
        return true;
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/teacher/dashboard"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-2xl font-bold text-indigo-600">구매 내역 관리</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filter Tabs */}
                <div className="flex gap-2 mb-6">
                    {[
                        { key: "pending", label: "배송 대기", color: "orange" },
                        { key: "delivered", label: "배송 완료", color: "green" },
                        { key: "all", label: "전체", color: "gray" },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key as any)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${filter === tab.key
                                    ? tab.key === "pending"
                                        ? "bg-orange-500 text-white"
                                        : tab.key === "delivered"
                                            ? "bg-green-500 text-white"
                                            : "bg-gray-600 text-white"
                                    : "bg-white text-gray-600 hover:bg-gray-100"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {filteredPurchases.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>해당하는 구매 내역이 없습니다.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">학생</th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">상품</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">가격</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">구매일시</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">배송 상태</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {filteredPurchases.map((purchase, index) => (
                                    <motion.tr
                                        key={purchase.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="hover:bg-gray-50"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-medium">{purchase.student?.name}</span>
                                            <span className="text-gray-400 text-sm ml-2">
                                                ({purchase.student?.grade}학년)
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">{purchase.item?.name}</td>
                                        <td className="px-6 py-4 text-center text-purple-600 font-semibold">
                                            {purchase.item?.cost}장
                                        </td>
                                        <td className="px-6 py-4 text-center text-gray-500 text-sm">
                                            {new Date(purchase.timestamp).toLocaleString("ko-KR")}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => toggleDelivered(purchase.id, purchase.is_delivered)}
                                                className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${purchase.is_delivered
                                                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                                                        : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                                                    }`}
                                            >
                                                {purchase.is_delivered ? (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        배송 완료
                                                    </>
                                                ) : (
                                                    "배송 대기"
                                                )}
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>
        </div>
    );
}
