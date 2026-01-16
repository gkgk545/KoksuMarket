"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isAuthenticated, generateCSV, downloadCSV } from "@/lib/teacherAuth";
import { ArrowLeft, Check, Loader2, Package, Download, Trash2, X } from "lucide-react";
import { motion } from "framer-motion";

interface PurchaseWithDetails {
    id: number;
    timestamp: string;
    is_delivered: boolean;
    student_id: number;
    item_id: number;
    student: { name: string; grade: number };
    item: { name: string; cost: number };
}

export default function PurchasesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [purchases, setPurchases] = useState<PurchaseWithDetails[]>([]);
    const [filter, setFilter] = useState<"all" | "pending" | "delivered">("pending");

    useEffect(() => {
        if (!isAuthenticated()) {
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
                student_id,
                item_id,
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
                student_id: p.student_id,
                item_id: p.item_id,
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

    // 구매 취소 (전달 대기 상태인 경우만) - 티켓과 수량 복구
    const cancelPurchase = async (purchase: PurchaseWithDetails) => {
        if (!confirm(`정말 ${purchase.student?.name}의 "${purchase.item?.name}" 구매를 취소하시겠습니까?\n학생 티켓과 상품 수량이 복구됩니다.`)) return;

        try {
            // 1. 학생 티켓 복구
            const { data: studentData } = await supabase
                .from("market_student")
                .select("ticket_count")
                .eq("id", purchase.student_id)
                .single();

            if (studentData) {
                await supabase
                    .from("market_student")
                    .update({ ticket_count: studentData.ticket_count + purchase.item.cost })
                    .eq("id", purchase.student_id);
            }

            // 2. 상품 수량 복구
            const { data: itemData } = await supabase
                .from("market_item")
                .select("quantity")
                .eq("id", purchase.item_id)
                .single();

            if (itemData) {
                await supabase
                    .from("market_item")
                    .update({ quantity: itemData.quantity + 1 })
                    .eq("id", purchase.item_id);
            }

            // 3. 구매 기록 삭제
            await supabase.from("market_purchase").delete().eq("id", purchase.id);

            alert("구매가 취소되었습니다. 티켓과 수량이 복구되었습니다.");
            loadPurchases();
        } catch (error) {
            alert("취소 실패: " + (error as Error).message);
        }
    };

    // 전달 완료 내역 삭제 (데이터베이스 정리용)
    const deletePurchase = async (purchase: PurchaseWithDetails) => {
        if (!confirm(`정말 ${purchase.student?.name}의 "${purchase.item?.name}" 구매 기록을 삭제하시겠습니까?\n(이미 전달 완료된 내역이므로 티켓/수량은 복구되지 않습니다.)`)) return;

        const { error } = await supabase
            .from("market_purchase")
            .delete()
            .eq("id", purchase.id);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            loadPurchases();
        }
    };

    const filteredPurchases = purchases.filter((p) => {
        if (filter === "pending") return !p.is_delivered;
        if (filter === "delivered") return p.is_delivered;
        return true;
    });

    // CSV Export
    const handleExport = () => {
        const headers = ["학생이름", "학년", "상품명", "가격", "구매일시", "전달상태"];
        const rows = filteredPurchases.map(p => [
            p.student?.name || "",
            p.student?.grade?.toString() || "",
            p.item?.name || "",
            p.item?.cost?.toString() || "",
            new Date(p.timestamp).toLocaleString("ko-KR"),
            p.is_delivered ? "완료" : "대기",
        ]);
        const csv = generateCSV(headers, rows);
        const filterName = filter === "all" ? "전체" : filter === "pending" ? "전달대기" : "전달완료";
        downloadCSV(`구매내역_${filterName}.csv`, csv);
    };

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
                    <button
                        onClick={handleExport}
                        disabled={filteredPurchases.length === 0}
                        className="flex items-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
                    >
                        <Download className="w-4 h-4" />
                        <span>내보내기</span>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Filter Tabs - 전체가 가장 왼쪽 */}
                <div className="flex gap-2 mb-6">
                    {[
                        { key: "all", label: "전체", color: "gray" },
                        { key: "pending", label: "전달 대기", color: "orange" },
                        { key: "delivered", label: "전달 완료", color: "green" },
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
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">전달 상태</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">작업</th>
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
                                                        전달 완료
                                                    </>
                                                ) : (
                                                    "전달 대기"
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {purchase.is_delivered ? (
                                                // 전달 완료: 삭제 버튼 (데이터베이스 정리용)
                                                <button
                                                    onClick={() => deletePurchase(purchase)}
                                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                                    title="기록 삭제"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    삭제
                                                </button>
                                            ) : (
                                                // 전달 대기: 구매 취소 버튼 (티켓/수량 복구)
                                                <button
                                                    onClick={() => cancelPurchase(purchase)}
                                                    className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                                                    title="구매 취소 (티켓/수량 복구)"
                                                >
                                                    <X className="w-4 h-4" />
                                                    취소
                                                </button>
                                            )}
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
