"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase, Student } from "@/lib/supabase";
import { ArrowLeft, Plus, Minus, Save, Trash2, UserPlus, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function GradeStudentsPage() {
    const router = useRouter();
    const params = useParams();
    const grade = Number(params.grade);

    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTickets, setEditTickets] = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: "", password: "1234", ticket_count: 0 });

    useEffect(() => {
        const auth = localStorage.getItem("teacherAuth");
        if (!auth) {
            router.push("/teacher");
            return;
        }
        loadStudents();
    }, [router, grade]);

    const loadStudents = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("market_student")
            .select("*")
            .eq("grade", grade)
            .order("name");

        if (error) {
            console.error("Failed to load students:", error);
        } else {
            setStudents(data || []);
        }
        setLoading(false);
    };

    const startEdit = (student: Student) => {
        setEditingId(student.id);
        setEditTickets(student.ticket_count);
    };

    const saveTickets = async (studentId: number) => {
        const { error } = await supabase
            .from("market_student")
            .update({ ticket_count: editTickets })
            .eq("id", studentId);

        if (error) {
            alert("저장 실패: " + error.message);
        } else {
            setEditingId(null);
            loadStudents();
        }
    };

    const deleteStudent = async (studentId: number, studentName: string) => {
        if (!confirm(`정말 ${studentName} 학생을 삭제하시겠습니까?`)) return;

        const { error } = await supabase
            .from("market_student")
            .delete()
            .eq("id", studentId);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            loadStudents();
        }
    };

    const addStudent = async () => {
        if (!newStudent.name.trim()) {
            alert("이름을 입력해주세요.");
            return;
        }

        const { error } = await supabase
            .from("market_student")
            .insert({
                name: newStudent.name.trim(),
                grade,
                password: newStudent.password,
                ticket_count: newStudent.ticket_count,
            });

        if (error) {
            alert("학생 추가 실패: " + error.message);
        } else {
            setShowAddModal(false);
            setNewStudent({ name: "", password: "1234", ticket_count: 0 });
            loadStudents();
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/teacher/dashboard"
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-2xl font-bold text-indigo-600">{grade}학년 학생 관리</h1>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                        <UserPlus className="w-5 h-5" />
                        <span>학생 추가</span>
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {students.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        등록된 학생이 없습니다.
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b">
                                <tr>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-600">이름</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">티켓 보유량</th>
                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-600">작업</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {students.map((student, index) => (
                                    <motion.tr
                                        key={student.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="hover:bg-gray-50"
                                    >
                                        <td className="px-6 py-4 font-medium">{student.name}</td>
                                        <td className="px-6 py-4 text-center">
                                            {editingId === student.id ? (
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => setEditTickets(Math.max(0, editTickets - 1))}
                                                        className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                                                    >
                                                        <Minus className="w-4 h-4" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={editTickets}
                                                        onChange={(e) => setEditTickets(Number(e.target.value))}
                                                        className="w-20 text-center border rounded py-1"
                                                    />
                                                    <button
                                                        onClick={() => setEditTickets(editTickets + 1)}
                                                        className="p-1 bg-gray-200 rounded hover:bg-gray-300"
                                                    >
                                                        <Plus className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => saveTickets(student.id)}
                                                        className="p-1 bg-green-500 text-white rounded hover:bg-green-600"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <span
                                                    onClick={() => startEdit(student)}
                                                    className="text-purple-600 font-bold cursor-pointer hover:underline"
                                                >
                                                    {student.ticket_count} 장
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => deleteStudent(student.id, student.name)}
                                                className="text-red-500 hover:text-red-700 p-1"
                                                title="삭제"
                                            >
                                                <Trash2 className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </main>

            {/* Add Student Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
                    >
                        <h2 className="text-xl font-bold mb-4">{grade}학년 학생 추가</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                                <input
                                    type="text"
                                    value={newStudent.name}
                                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="학생 이름"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                                <input
                                    type="text"
                                    value={newStudent.password}
                                    onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="기본: 1234"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">초기 티켓 수</label>
                                <input
                                    type="number"
                                    value={newStudent.ticket_count}
                                    onChange={(e) => setNewStudent({ ...newStudent, ticket_count: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={addStudent}
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                            >
                                추가
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
