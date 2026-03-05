"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/teacherAuth";
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, Loader2, Users, Target } from "lucide-react";
import { motion } from "framer-motion";
import { Funding, FundingParticipation, api } from "@/lib/api";

export default function TeacherFundingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [fundings, setFundings] = useState<Funding[]>([]);
    
    // Form and modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingFunding, setEditingFunding] = useState<Funding | null>(null);
    const [newFunding, setNewFunding] = useState({
        title: "",
        description: "",
        target_amount: 100,
        image_url: "",
    });

    // Detail View
    const [viewingDetail, setViewingDetail] = useState<{ funding: Funding; participations: FundingParticipation[] } | null>(null);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/teacher");
            return;
        }
        loadFundings();
    }, [router]);

    const loadFundings = async () => {
        setLoading(true);
        try {
            const data = await api.getFundings();
            setFundings(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const addFunding = async () => {
        if (!newFunding.title.trim()) {
            alert("제목을 입력해주세요.");
            return;
        }

        const { error } = await supabase.from("market_funding").insert({
            title: newFunding.title.trim(),
            description: newFunding.description || null,
            target_amount: newFunding.target_amount,
            image_url: newFunding.image_url || null,
        });

        if (error) {
            alert("펀딩 추가 실패: " + error.message);
        } else {
            setShowAddModal(false);
            setNewFunding({ title: "", description: "", target_amount: 100, image_url: "" });
            loadFundings();
        }
    };

    const updateFunding = async () => {
        if (!editingFunding) return;

        const { error } = await supabase
            .from("market_funding")
            .update({
                title: editingFunding.title,
                description: editingFunding.description,
                target_amount: editingFunding.target_amount,
                image_url: editingFunding.image_url,
                is_completed: editingFunding.is_completed,
            })
            .eq("id", editingFunding.id);

        if (error) {
            alert("펀딩 수정 실패: " + error.message);
        } else {
            setEditingFunding(null);
            loadFundings();
        }
    };

    const deleteFunding = async (fundingId: number, title: string) => {
        if (!confirm(`정말 "${title}" 펀딩을 삭제하시겠습니까? 참여 기록도 모두 사라지며 환불되지 않습니다 (환불이 필요하면 개별 메뉴에서 수동 처리 필요).`)) return;

        const { error } = await supabase.from("market_funding").delete().eq("id", fundingId);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            loadFundings();
        }
    };

    const viewDetails = async (funding: Funding) => {
        try {
            const detail = await api.getFundingDetail(funding.id);
            setViewingDetail(detail);
        } catch (err: any) {
            alert("상세 정보 로드 실패: " + err.message);
        }
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/teacher/dashboard"
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-2xl font-bold text-pink-600">공동 펀딩 관리</h1>
                        </div>
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 bg-pink-600 text-white px-3 py-2 rounded-lg hover:bg-pink-700 transition-colors text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            <span>새 펀딩 만들기</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {fundings.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        등록된 펀딩이 없습니다.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {fundings.map((funding, index) => {
                            const progress = Math.min(100, Math.round((funding.current_amount / funding.target_amount) * 100));
                            return (
                                <motion.div
                                    key={funding.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className={`bg-white rounded-xl shadow-sm border overflow-hidden ${funding.is_completed ? 'opacity-70 grayscale border-gray-300' : 'border-pink-200'}`}
                                >
                                    <div className="p-5">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-xl">{funding.title}</h3>
                                            <span className={`text-xs px-2 py-1 rounded-full ${funding.is_completed ? 'bg-gray-200 text-gray-600' : 'bg-pink-100 text-pink-700'}`}>
                                                {funding.is_completed ? "완료됨" : "진행중"}
                                            </span>
                                        </div>
                                        <div className="mt-4 mb-4">
                                            <div className="flex justify-between text-sm text-gray-600 mb-1">
                                                <span>현재 {funding.current_amount}티켓</span>
                                                <span>목표 {funding.target_amount}티켓</span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                <div className="bg-pink-500 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                                            </div>
                                            <div className="text-right text-xs mt-1 text-gray-400">{progress}%</div>
                                        </div>

                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => viewDetails(funding)}
                                                className="flex-1 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-1 text-sm font-medium"
                                            >
                                                <Users className="w-4 h-4" /> 내역
                                            </button>
                                            <button
                                                onClick={() => setEditingFunding(funding)}
                                                className="p-1.5 text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => deleteFunding(funding.id, funding.title)}
                                                className="p-1.5 text-red-600 bg-red-50 rounded-lg hover:bg-red-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* View Details Modal */}
            {viewingDetail && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
                    >
                        <div className="flex items-center justify-between border-b pb-4 mb-4">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Target className="w-5 h-5 text-pink-600" />
                                    {viewingDetail.funding.title} 참여 내역
                                </h2>
                                <p className="text-sm text-gray-500 mt-1">
                                    총 {viewingDetail.funding.current_amount} / {viewingDetail.funding.target_amount} 모금
                                </p>
                            </div>
                            <button onClick={() => setViewingDetail(null)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto pr-2">
                            {viewingDetail.participations.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">아직 참여한 학생이 없습니다.</div>
                            ) : (
                                <div className="space-y-3">
                                    {viewingDetail.participations.map((part) => (
                                        <div key={part.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                                            <div>
                                                <div className="font-bold">{part.student_name}</div>
                                                <div className="text-xs text-gray-400">{new Date(part.timestamp).toLocaleString("ko-KR")}</div>
                                            </div>
                                            <div className="text-lg font-bold text-pink-600">+{part.amount} 장</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Add/Edit Modal */}
            {(showAddModal || editingFunding) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">
                                {editingFunding ? "펀딩 수정" : "새 펀딩 만들기"}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingFunding(null);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">펀딩명</label>
                                <input
                                    type="text"
                                    value={editingFunding ? editingFunding.title : newFunding.title}
                                    onChange={(e) =>
                                        editingFunding
                                            ? setEditingFunding({ ...editingFunding, title: e.target.value })
                                            : setNewFunding({ ...newFunding, title: e.target.value })
                                    }
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500"
                                    placeholder="예: 우리 반 피자 파티"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">목표 티켓 수</label>
                                <input
                                    type="number"
                                    min="1"
                                    value={editingFunding ? editingFunding.target_amount : newFunding.target_amount}
                                    onChange={(e) =>
                                        editingFunding
                                            ? setEditingFunding({ ...editingFunding, target_amount: Number(e.target.value) })
                                            : setNewFunding({ ...newFunding, target_amount: Number(e.target.value) })
                                    }
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">설명 (선택)</label>
                                <textarea
                                    value={editingFunding ? editingFunding.description || "" : newFunding.description}
                                    onChange={(e) =>
                                        editingFunding
                                            ? setEditingFunding({ ...editingFunding, description: e.target.value })
                                            : setNewFunding({ ...newFunding, description: e.target.value })
                                    }
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500"
                                    rows={2}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL (선택)</label>
                                <input
                                    type="text"
                                    value={editingFunding ? editingFunding.image_url || "" : newFunding.image_url}
                                    onChange={(e) =>
                                        editingFunding
                                            ? setEditingFunding({ ...editingFunding, image_url: e.target.value })
                                            : setNewFunding({ ...newFunding, image_url: e.target.value })
                                    }
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-pink-500"
                                    placeholder="https://"
                                />
                            </div>
                            
                            {editingFunding && (
                                <div className="mt-4 p-3 bg-gray-50 border rounded-lg flex items-center justify-between">
                                    <span className="text-sm font-medium">펀딩 성공/종료 처리</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="sr-only peer" 
                                            checked={editingFunding.is_completed}
                                            onChange={(e) => setEditingFunding({ ...editingFunding, is_completed: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                                    </label>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingFunding(null);
                                }}
                                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={editingFunding ? updateFunding : addFunding}
                                className="flex-1 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {editingFunding ? "수정" : "생성"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
