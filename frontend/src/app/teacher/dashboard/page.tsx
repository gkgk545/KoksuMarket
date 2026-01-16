"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { LogOut, Users, Package, ShoppingBag, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

interface GradeStats {
    grade: number;
    studentCount: number;
    totalTickets: number;
}

export default function TeacherDashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [gradeStats, setGradeStats] = useState<GradeStats[]>([]);
    const [totalPurchases, setTotalPurchases] = useState(0);
    const [pendingDeliveries, setPendingDeliveries] = useState(0);

    useEffect(() => {
        // Check auth
        const auth = localStorage.getItem("teacherAuth");
        if (!auth) {
            router.push("/teacher");
            return;
        }

        loadDashboardData();
    }, [router]);

    const loadDashboardData = async () => {
        try {
            // Get students grouped by grade
            const { data: students, error: studentsError } = await supabase
                .from("market_student")
                .select("grade, ticket_count");

            if (studentsError) throw studentsError;

            // Calculate stats per grade
            const statsMap = new Map<number, GradeStats>();
            [3, 4, 5, 6].forEach(grade => {
                statsMap.set(grade, { grade, studentCount: 0, totalTickets: 0 });
            });

            students?.forEach(s => {
                const stat = statsMap.get(s.grade);
                if (stat) {
                    stat.studentCount++;
                    stat.totalTickets += s.ticket_count;
                }
            });

            setGradeStats(Array.from(statsMap.values()));

            // Get purchase stats
            const { count: totalCount } = await supabase
                .from("market_purchase")
                .select("*", { count: "exact", head: true });

            const { count: pendingCount } = await supabase
                .from("market_purchase")
                .select("*", { count: "exact", head: true })
                .eq("is_delivered", false);

            setTotalPurchases(totalCount || 0);
            setPendingDeliveries(pendingCount || 0);

        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("teacherAuth");
        router.push("/teacher");
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
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
                        곡수마켓 교사 대시보드
                    </h1>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-gray-500 hover:text-red-500 transition-colors"
                    >
                        <LogOut className="w-5 h-5" />
                        <span>로그아웃</span>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Quick Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl shadow-sm p-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-indigo-100 rounded-lg">
                                <Users className="w-6 h-6 text-indigo-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">총 학생 수</p>
                                <p className="text-2xl font-bold">
                                    {gradeStats.reduce((sum, s) => sum + s.studentCount, 0)}명
                                </p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-xl shadow-sm p-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-100 rounded-lg">
                                <ShoppingBag className="w-6 h-6 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">총 구매 건수</p>
                                <p className="text-2xl font-bold">{totalPurchases}건</p>
                            </div>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-xl shadow-sm p-6"
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <Package className="w-6 h-6 text-orange-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500">배송 대기</p>
                                <p className="text-2xl font-bold text-orange-600">{pendingDeliveries}건</p>
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Grade Cards */}
                <h2 className="text-xl font-bold mb-4">학년별 관리</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {gradeStats.map((stat, index) => (
                        <motion.div
                            key={stat.grade}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * index }}
                        >
                            <Link
                                href={`/teacher/students/${stat.grade}`}
                                className="block bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow border-2 border-transparent hover:border-indigo-200"
                            >
                                <h3 className="text-lg font-bold text-indigo-600 mb-4">
                                    {stat.grade}학년
                                </h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">학생 수</span>
                                        <span className="font-semibold">{stat.studentCount}명</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">총 티켓</span>
                                        <span className="font-semibold text-purple-600">{stat.totalTickets}장</span>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    ))}
                </div>

                {/* Quick Links */}
                <h2 className="text-xl font-bold mb-4">빠른 메뉴</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Link
                        href="/teacher/purchases"
                        className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow flex items-center gap-4 border-2 border-transparent hover:border-green-200"
                    >
                        <div className="p-3 bg-green-100 rounded-lg">
                            <ShoppingBag className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <h3 className="font-bold">구매 내역 관리</h3>
                            <p className="text-sm text-gray-500">배송 상태 변경</p>
                        </div>
                    </Link>

                    <Link
                        href="/teacher/items"
                        className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow flex items-center gap-4 border-2 border-transparent hover:border-purple-200"
                    >
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <Package className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <h3 className="font-bold">상품 관리</h3>
                            <p className="text-sm text-gray-500">상품 추가/수정/삭제</p>
                        </div>
                    </Link>

                    <a
                        href="/"
                        className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow flex items-center gap-4 border-2 border-transparent hover:border-indigo-200"
                    >
                        <div className="p-3 bg-indigo-100 rounded-lg">
                            <Users className="w-6 h-6 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-bold">학생 페이지</h3>
                            <p className="text-sm text-gray-500">학생 화면 확인</p>
                        </div>
                    </a>
                </div>
            </main>
        </div>
    );
}
