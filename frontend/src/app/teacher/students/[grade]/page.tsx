"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase, Student } from "@/lib/supabase";
import { isAuthenticated, parseCSV, generateCSV, downloadCSV } from "@/lib/teacherAuth";
import { ArrowLeft, Plus, Minus, Save, Trash2, UserPlus, Loader2, Upload, Download, Check, X } from "lucide-react";
import { motion } from "framer-motion";

export default function GradeStudentsPage() {
    const router = useRouter();
    const params = useParams();
    const grade = Number(params.grade);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTickets, setEditTickets] = useState(0);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: "", password: "1234", ticket_count: 0 });

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showBulkTicketModal, setShowBulkTicketModal] = useState(false);
    const [bulkTicketAmount, setBulkTicketAmount] = useState(0);
    const [bulkTicketAction, setBulkTicketAction] = useState<"add" | "subtract">("add");

    useEffect(() => {
        if (!isAuthenticated()) {
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

    // CSV Upload
    const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const rows = parseCSV(text);

        // Skip header if first row looks like headers
        const startIndex = rows[0]?.[0]?.toLowerCase().includes('이름') ? 1 : 0;

        const studentsToAdd = rows.slice(startIndex).filter(row => row[0]?.trim()).map(row => ({
            name: row[0]?.trim() || "",
            password: row[1]?.trim() || "1234",
            ticket_count: parseInt(row[2]) || 0,
            grade,
        }));

        if (studentsToAdd.length === 0) {
            alert("추가할 학생이 없습니다. CSV 형식을 확인해주세요.\n형식: 이름,비밀번호,티켓수");
            return;
        }

        const { error } = await supabase.from("market_student").insert(studentsToAdd);

        if (error) {
            alert("업로드 실패: " + error.message);
        } else {
            alert(`${studentsToAdd.length}명의 학생이 추가되었습니다.`);
            loadStudents();
        }

        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // CSV Export
    const handleExport = () => {
        const headers = ["이름", "비밀번호", "티켓수"];
        const rows = students.map(s => [s.name, s.password, s.ticket_count.toString()]);
        const csv = generateCSV(headers, rows);
        downloadCSV(`${grade}학년_학생목록.csv`, csv);
    };

    // Selection
    const toggleSelect = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        if (selectedIds.size === students.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(students.map(s => s.id)));
        }
    };

    // Bulk ticket management
    const applyBulkTickets = async () => {
        if (selectedIds.size === 0) {
            alert("선택된 학생이 없습니다.");
            return;
        }

        const updates = students
            .filter(s => selectedIds.has(s.id))
            .map(s => ({
                id: s.id,
                ticket_count: bulkTicketAction === "add"
                    ? s.ticket_count + bulkTicketAmount
                    : Math.max(0, s.ticket_count - bulkTicketAmount),
            }));

        for (const update of updates) {
            await supabase
                .from("market_student")
                .update({ ticket_count: update.ticket_count })
                .eq("id", update.id);
        }

        setShowBulkTicketModal(false);
        setSelectedIds(new Set());
        setBulkTicketAmount(0);
        loadStudents();
        alert(`${updates.length}명의 티켓이 ${bulkTicketAction === "add" ? "부여" : "회수"}되었습니다.`);
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
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
            />

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
                            <h1 className="text-2xl font-bold text-indigo-600">{grade}학년 학생 관리</h1>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            {selectedIds.size > 0 && (
                                <button
                                    onClick={() => setShowBulkTicketModal(true)}
                                    className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>선택 학생 티켓 관리 ({selectedIds.size}명)</span>
                                </button>
                            )}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                                <Upload className="w-4 h-4" />
                                <span>CSV 업로드</span>
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={students.length === 0}
                                className="flex items-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                <span>내보내기</span>
                            </button>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                            >
                                <UserPlus className="w-4 h-4" />
                                <span>학생 추가</span>
                            </button>
                        </div>
                    </div>

                    {/* CSV Format Hint */}
                    <div className="mt-2 text-xs text-gray-500">
                        CSV 형식: 이름,비밀번호,초기티켓수 (예: 홍길동,1234,5)
                    </div>
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
                                    <th className="px-4 py-4 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === students.length && students.length > 0}
                                            onChange={selectAll}
                                            className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                                        />
                                    </th>
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
                                        transition={{ delay: index * 0.02 }}
                                        className={`hover:bg-gray-50 ${selectedIds.has(student.id) ? "bg-indigo-50" : ""}`}
                                    >
                                        <td className="px-4 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(student.id)}
                                                onChange={() => toggleSelect(student.id)}
                                                className="w-4 h-4 text-indigo-600 border-gray-300 rounded"
                                            />
                                        </td>
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

            {/* Bulk Ticket Modal */}
            {showBulkTicketModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
                    >
                        <h2 className="text-xl font-bold mb-4">일괄 티켓 관리</h2>
                        <p className="text-gray-600 mb-4">선택된 학생: {selectedIds.size}명</p>

                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setBulkTicketAction("add")}
                                    className={`flex-1 py-2 rounded-lg border ${bulkTicketAction === "add" ? "bg-green-600 text-white border-green-600" : "hover:bg-gray-50"}`}
                                >
                                    티켓 부여
                                </button>
                                <button
                                    onClick={() => setBulkTicketAction("subtract")}
                                    className={`flex-1 py-2 rounded-lg border ${bulkTicketAction === "subtract" ? "bg-red-600 text-white border-red-600" : "hover:bg-gray-50"}`}
                                >
                                    티켓 회수
                                </button>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">티켓 수</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={bulkTicketAmount}
                                    onChange={(e) => setBulkTicketAmount(Number(e.target.value))}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowBulkTicketModal(false)}
                                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={applyBulkTickets}
                                className={`flex-1 py-2 text-white rounded-lg ${bulkTicketAction === "add" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                            >
                                {bulkTicketAction === "add" ? "부여하기" : "회수하기"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
