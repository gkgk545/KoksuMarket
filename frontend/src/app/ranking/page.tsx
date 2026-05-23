"use client";

import { useEffect, useState } from "react";
import { api, Student } from "@/lib/api";
import { Trophy, Coins, Target, Medal, Award, Loader2, Users, PiggyBank, Crown, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

interface RankingItem {
    id: number;
    name: string;
    grade: number;
    current_tickets: number;
    total_spent: number;
    total_funded: number;
    total_tickets: number;
}

type TabType = "total" | "spent" | "savings" | "funded";

export default function RankingPage() {
    const [rankings, setRankings] = useState<RankingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>("total");
    const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
    const [currentUser, setCurrentUser] = useState<Student | null>(null);

    useEffect(() => {
        // Load current user (optional - might not be logged in)
        const stored = localStorage.getItem("user");
        if (stored) {
            try {
                setCurrentUser(JSON.parse(stored));
            } catch {}
        }

        // Fetch rankings (no login required)
        api.getStudentRankings()
            .then((data) => {
                setRankings(data as RankingItem[]);
            })
            .catch((err) => {
                console.error("Failed to load rankings:", err);
            })
            .finally(() => setLoading(false));
    }, []);

    // Filter rankings based on grade filter
    const filteredRankings = rankings.filter((item) => {
        if (gradeFilter === "all") return true;
        return item.grade === gradeFilter;
    });

    // Get the value for the active tab
    const getValue = (item: RankingItem) => {
        switch (activeTab) {
            case "total": return item.total_tickets;
            case "spent": return item.total_spent;
            case "savings": return item.current_tickets;
            case "funded": return item.total_funded;
        }
    };

    // Sort rankings based on active tab
    const sortedRankings = [...filteredRankings].sort((a, b) => getValue(b) - getValue(a));

    // Find current user's rank
    const getCurrentUserRank = () => {
        if (!currentUser) return null;
        const allSorted = [...rankings].sort((a, b) => getValue(b) - getValue(a));
        const index = allSorted.findIndex((item) => item.id === currentUser.id);
        if (index === -1) return null;
        return {
            rank: index + 1,
            item: allSorted[index]
        };
    };

    const userRankInfo = getCurrentUserRank();

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1:
                return <Trophy className="w-6 h-6 text-yellow-500 animate-bounce" />;
            case 2:
                return <Medal className="w-6 h-6 text-slate-400" />;
            case 3:
                return <Medal className="w-6 h-6 text-amber-600" />;
            default:
                return <span className="font-bold text-gray-500 w-6 text-center">{rank}</span>;
        }
    };

    const tabs = [
        { type: "total" as TabType, label: "🎫 티켓 왕", emoji: "🎫", description: "지금까지 받은 모든 티켓의 합계 (잔여 + 소비 + 기부)" },
        { type: "spent" as TabType, label: "🛍️ 소비 왕", emoji: "🛍️", description: "마켓에서 상품을 구매하는 데 사용한 티켓의 합계" },
        { type: "savings" as TabType, label: "🏦 저축 왕", emoji: "🏦", description: "사용하지 않고 현재 보유 중인 잔여 티켓" },
        { type: "funded" as TabType, label: "💗 기부 왕", emoji: "💗", description: "공동 펀딩에 기부한 티켓의 합계" },
    ];

    const getTabTitle = () => {
        const tab = tabs.find(t => t.type === activeTab);
        return tab ? `${tab.emoji} ${tab.label.replace(tab.emoji + " ", "")}` : "";
    };

    const getValueLabel = (item: RankingItem) => {
        return `${getValue(item)}장`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
                {/* Back to home link */}
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-purple-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" />
                    곡수마켓 홈으로
                </Link>

                {/* Header */}
                <div className="text-center py-6">
                    <motion.h1 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-600 mb-2"
                    >
                        🏆 곡수마켓 명예의 전당
                    </motion.h1>
                    <p className="text-gray-500 dark:text-gray-400">곡수 어린이들의 멋진 활동 랭킹을 확인해보세요!</p>
                </div>

                {/* Filter and Tab Controls */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-xl border dark:border-slate-800 space-y-4">
                    {/* Tabs - 4 columns */}
                    <div className="grid grid-cols-4 gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab.type}
                                onClick={() => setActiveTab(tab.type)}
                                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl font-bold transition-all text-sm ${
                                    activeTab === tab.type
                                        ? "bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow-lg shadow-purple-500/20 scale-[1.02]"
                                        : "bg-gray-50 hover:bg-gray-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300"
                                }`}
                            >
                                <span className="text-lg">{tab.emoji}</span>
                                <span className="text-xs">{tab.label.replace(tab.emoji + " ", "")}</span>
                            </button>
                        ))}
                    </div>

                    {/* Tab Description Banner */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            transition={{ duration: 0.2 }}
                            className="bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 rounded-2xl px-4 py-3 flex items-start gap-3"
                        >
                            <span className="text-xl mt-0.5">{tabs.find(t => t.type === activeTab)?.emoji}</span>
                            <div>
                                <p className="font-bold text-sm text-purple-800 dark:text-purple-300">
                                    {tabs.find(t => t.type === activeTab)?.label.replace((tabs.find(t => t.type === activeTab)?.emoji || "") + " ", "")}
                                </p>
                                <p className="text-xs text-purple-600/80 dark:text-purple-400/80 mt-0.5">
                                    {tabs.find(t => t.type === activeTab)?.description}
                                </p>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Grade filter */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-500 dark:text-gray-400 mr-2">학년 필터:</span>
                        {["all", 3, 4, 5, 6].map((grade) => (
                            <button
                                key={grade}
                                onClick={() => setGradeFilter(grade === "all" ? "all" : Number(grade))}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    (grade === "all" ? gradeFilter === "all" : gradeFilter === grade)
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                        : "bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-600 dark:text-gray-300"
                                }`}
                            >
                                {grade === "all" ? "전체 학년" : `${grade}학년`}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Top 3 Podium */}
                {sortedRankings.length > 0 && (
                    <div className="grid grid-cols-3 gap-4 items-end max-w-xl mx-auto py-8">
                        {/* 2nd Place */}
                        {sortedRankings[1] && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.1 }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 border-4 border-slate-300 flex items-center justify-center shadow-lg mb-2 relative">
                                    <Medal className="w-8 h-8 text-slate-400" />
                                </div>
                                <span className="font-bold text-sm">{sortedRankings[1].name}</span>
                                <span className="text-xs text-gray-400 mb-2">{sortedRankings[1].grade}학년</span>
                                <div className="w-full bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 h-28 rounded-t-2xl flex flex-col items-center justify-center p-2 shadow-inner">
                                    <span className="font-extrabold text-slate-500 text-lg">2등</span>
                                    <span className="font-bold text-purple-600 text-xs mt-1">
                                        {getValueLabel(sortedRankings[1])}
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {/* 1st Place */}
                        {sortedRankings[0] && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center z-10"
                            >
                                <div className="w-20 h-20 rounded-full bg-yellow-50 dark:bg-slate-800 border-4 border-yellow-400 flex items-center justify-center shadow-xl mb-2 relative">
                                    <Trophy className="w-10 h-10 text-yellow-500" />
                                    <span className="absolute -top-3 text-2xl">👑</span>
                                </div>
                                <span className="font-extrabold text-base">{sortedRankings[0].name}</span>
                                <span className="text-xs text-gray-400 mb-2">{sortedRankings[0].grade}학년</span>
                                <div className="w-full bg-gradient-to-t from-yellow-100 to-yellow-50 dark:from-amber-950/40 dark:to-amber-900/20 h-36 rounded-t-2xl flex flex-col items-center justify-center p-2 shadow-lg border-t-2 border-yellow-300">
                                    <span className="font-black text-yellow-600 dark:text-yellow-400 text-xl">1등</span>
                                    <span className="font-extrabold text-purple-700 dark:text-purple-400 text-sm mt-1">
                                        {getValueLabel(sortedRankings[0])}
                                    </span>
                                </div>
                            </motion.div>
                        )}

                        {/* 3rd Place */}
                        {sortedRankings[2] && (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-16 h-16 rounded-full bg-amber-50 dark:bg-slate-800 border-4 border-amber-500/50 flex items-center justify-center shadow-lg mb-2 relative">
                                    <Medal className="w-8 h-8 text-amber-600" />
                                </div>
                                <span className="font-bold text-sm">{sortedRankings[2].name}</span>
                                <span className="text-xs text-gray-400 mb-2">{sortedRankings[2].grade}학년</span>
                                <div className="w-full bg-gradient-to-t from-amber-100/80 to-amber-50/50 dark:from-slate-800 dark:to-slate-700 h-24 rounded-t-2xl flex flex-col items-center justify-center p-2 shadow-inner">
                                    <span className="font-extrabold text-amber-700 dark:text-amber-500 text-lg">3등</span>
                                    <span className="font-bold text-purple-600 text-xs mt-1">
                                        {getValueLabel(sortedRankings[2])}
                                    </span>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

                {/* List Table */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border dark:border-slate-800 overflow-hidden">
                    <div className="px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-b dark:border-slate-800 flex justify-between items-center">
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <span>{getTabTitle()}</span>
                        </h3>
                        <span className="text-xs text-gray-400">전체 학년 통합 랭킹</span>
                    </div>

                    <div className="divide-y dark:divide-slate-800">
                        <AnimatePresence mode="popLayout">
                            {sortedRankings.slice(3).map((item, idx) => {
                                const actualRank = idx + 4;
                                const isCurrentUser = currentUser?.id === item.id;
                                return (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                                        className={`flex items-center justify-between px-6 py-4 transition-colors ${
                                            isCurrentUser 
                                                ? "bg-purple-50/60 dark:bg-purple-950/20 font-semibold" 
                                                : "hover:bg-gray-50/50 dark:hover:bg-slate-800/30"
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-8 flex justify-center">
                                                {getRankIcon(actualRank)}
                                            </div>
                                            <div>
                                                <span className="font-bold">{item.name}</span>
                                                {isCurrentUser && (
                                                    <span className="ml-2 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] rounded-full font-bold">
                                                        나
                                                    </span>
                                                )}
                                                <p className="text-xs text-gray-400">{item.grade}학년</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-extrabold text-purple-600 dark:text-purple-400">
                                                {getValueLabel(item)}
                                            </span>
                                        </div>
                                    </motion.div>
                                );
                            })}

                            {sortedRankings.length === 0 && (
                                <div className="text-center py-12 text-gray-500">
                                    <Users className="w-12 h-12 mx-auto opacity-30 mb-2" />
                                    랭킹 데이터가 없습니다.
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Current User Fixed Bottom Sticky Card (if logged in and not in top 3) */}
                {userRankInfo && userRankInfo.rank > 3 && (
                    <motion.div 
                        initial={{ y: 50, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        className="sticky bottom-4 mx-auto max-w-xl bg-gradient-to-r from-purple-600 to-pink-600 rounded-3xl p-4 text-white shadow-2xl flex items-center justify-between z-20"
                    >
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold">
                                {userRankInfo.rank}
                            </div>
                            <div>
                                <span className="font-extrabold text-base">{userRankInfo.item.name} (나)</span>
                                <p className="text-[10px] opacity-80">{userRankInfo.item.grade}학년</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs opacity-80 block">나의 기록</span>
                            <span className="font-black text-lg">
                                {getValueLabel(userRankInfo.item)}
                            </span>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
