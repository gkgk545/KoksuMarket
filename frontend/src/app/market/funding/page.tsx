"use client";

import { useEffect, useState } from "react";
import { api, Funding, Student } from "@/lib/api";
import { Loader2, Users, Target, CheckCircle2, Heart } from "lucide-react";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";

export default function FundingPage() {
    const [fundings, setFundings] = useState<Funding[]>([]);
    const [user, setUser] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [participatingFunding, setParticipatingFunding] = useState<Funding | null>(null);
    const [amount, setAmount] = useState<number | string>(1);
    const [submitting, setSubmitting] = useState(false);

    const loadFundings = () => {
        api.getFundings()
            .then(setFundings)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const loadUserFromStorage = () => {
            const stored = localStorage.getItem("user");
            if (stored) setUser(JSON.parse(stored));
        };

        loadUserFromStorage();
        loadFundings();

        window.addEventListener("auth_refreshed", loadUserFromStorage);
        return () => window.removeEventListener("auth_refreshed", loadUserFromStorage);
    }, []);

    const handleParticipate = async () => {
        if (!user || !participatingFunding) return;
        
        const parsedAmount = Number(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            alert("1장 이상의 티켓을 입력해주세요.");
            return;
        }

        if (user.ticket_count < parsedAmount) {
            alert("보유한 티켓이 부족합니다.");
            return;
        }

        setSubmitting(true);
        try {
            await api.participateFunding(user.id, participatingFunding.id, parsedAmount);
            alert("펀딩에 성공적으로 참여했습니다!");
            
            // Refresh logic
            window.dispatchEvent(new Event("auth_refreshed"));
            loadFundings();
            setParticipatingFunding(null);
            setAmount(1);
        } catch (err: any) {
            alert(err.message || "참여 중 오류가 발생했습니다.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Heart className="w-6 h-6 text-pink-500" />
                다함께 공동 펀딩
            </h1>

            {fundings.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-dashed dark:border-slate-700">
                    <p className="text-gray-500">현재 진행 중인 펀딩이 없습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {fundings.map((funding, i) => {
                        const progress = Math.min(100, Math.round((funding.current_amount / funding.target_amount) * 100));
                        const isSuccess = progress >= 100 || funding.is_completed;
                        
                        return (
                            <motion.div 
                                key={funding.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 overflow-hidden"
                            >
                                {funding.image_url && (
                                    <div className="h-48 overflow-hidden bg-gray-100">
                                        <img src={funding.image_url} alt={funding.title} className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div className="p-5 space-y-4">
                                    <h3 className="font-bold text-lg">{funding.title}</h3>
                                    {funding.description && (
                                        <p className="text-gray-500 text-sm line-clamp-2">{funding.description}</p>
                                    )}

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500 flex items-center gap-1">
                                                <Users className="w-4 h-4" /> 현재 {funding.current_amount}장
                                            </span>
                                            <span className="font-semibold flex items-center gap-1 text-purple-600">
                                                <Target className="w-4 h-4" /> 목표 {funding.target_amount}장
                                            </span>
                                        </div>
                                        <div className="w-full h-3 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div 
                                                className={`h-full rounded-full transition-all duration-1000 ${isSuccess ? 'bg-green-500' : 'bg-gradient-to-r from-purple-500 to-pink-500'}`}
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <div className="text-right text-xs font-bold text-gray-400">
                                            {progress}% 달성
                                        </div>
                                    </div>

                                    {isSuccess ? (
                                        <button disabled className="w-full py-3 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-bold flex items-center justify-center gap-2">
                                            <CheckCircle2 className="w-5 h-5" /> 펀딩 성공!
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={() => {
                                                setParticipatingFunding(funding);
                                                setAmount(1);
                                            }}
                                            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors"
                                        >
                                            참여하기
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Participation Modal */}
            {participatingFunding && createPortal(
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl max-w-sm w-full p-6 shadow-2xl"
                    >
                        <h2 className="text-xl font-bold mb-2">펀딩 참여</h2>
                        <p className="text-gray-500 mb-6 font-medium">"{participatingFunding.title}"에 몇 장의 티켓을 내시겠습니까?</p>
                        
                        <div className="bg-purple-50 dark:bg-slate-800 rounded-xl p-4 mb-6 flex justify-between items-center text-sm">
                            <span className="text-gray-600 dark:text-gray-400">나의 보유 티켓</span>
                            <span className="font-bold text-purple-600 text-lg">{user?.ticket_count}장</span>
                        </div>

                        <div className="space-y-4 mb-6">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                참여할 티켓 수
                            </label>
                            <input
                                type="number"
                                min="1"
                                max={user?.ticket_count}
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none text-lg text-center"
                            />
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setParticipatingFunding(null)}
                                className="flex-1 py-3 text-gray-500 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 rounded-xl font-bold transition-colors"
                            >
                                취소
                            </button>
                            <button
                                disabled={submitting || Number(amount) <= 0 || isNaN(Number(amount)) || (user ? user.ticket_count < Number(amount) : true)}
                                onClick={handleParticipate}
                                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 flex justify-center items-center"
                            >
                                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "내기"}
                            </button>
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}
        </div>
    );
}
