"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase, Student } from "@/lib/supabase";
import { teacherApi } from "@/lib/teacherApi";
import { isAuthenticated, parseCSV, generateCSV, downloadCSV } from "@/lib/teacherAuth";
import { Check, Download, FileDown, KeyRound, Minus, Plus, Search, Ticket, Trash2, Upload, UserPlus, X } from "lucide-react";
import { TeacherShell } from "@/components/TeacherShell";
import { Dialog } from "@/components/Dialog";
import { useConfirm, useToast } from "@/components/feedback";
import { cn } from "@/lib/utils";
import t from "../../teacher.module.css";
import styles from "./students.module.css";

const GRADES = [3, 4, 5, 6];

export default function GradeStudentsPage() {
    const router = useRouter();
    const params = useParams();
    const grade = Number(params.grade);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState<Student[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editTickets, setEditTickets] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [confirm, confirmDialog] = useConfirm();
    const [toast, toastElement] = useToast();

    // Add student
    const [showAddModal, setShowAddModal] = useState(false);
    const [newStudent, setNewStudent] = useState({ name: "", password: "1234", ticket_count: 0 });

    // Bulk selection
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showBulkTicketModal, setShowBulkTicketModal] = useState(false);
    const [bulkTicketAmount, setBulkTicketAmount] = useState(1);
    const [bulkTicketAction, setBulkTicketAction] = useState<"add" | "subtract">("add");
    const [bulkSaving, setBulkSaving] = useState(false);

    // Password change
    const [passwordTarget, setPasswordTarget] = useState<{ id: number; name: string } | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [dialogError, setDialogError] = useState<string | null>(null);

    const filteredStudents = students.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const loadStudents = async () => {
        const { data, error } = await teacherApi.listStudents(grade);

        if (error) {
            console.error("Failed to load students:", error);
            toast("학생 목록을 불러오지 못했어요. 새로고침해 주세요.", "error");
        } else {
            setStudents(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/teacher");
            return;
        }
        loadStudents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, grade]);

    const startEdit = (student: Student) => {
        setEditingId(student.id);
        setEditTickets(student.ticket_count);
    };

    const saveTickets = async (student: Student) => {
        const { error } = await teacherApi.setTickets([student.id], "set", editTickets);

        if (error) {
            toast(`저장하지 못했어요: ${error.message}`, "error");
        } else {
            setEditingId(null);
            setStudents((prev) => prev.map((s) => (s.id === student.id ? { ...s, ticket_count: editTickets } : s)));
            toast(`${student.name}의 티켓을 ${editTickets}장으로 바꿨어요.`);
        }
    };

    const deleteStudent = async (student: Student) => {
        // 먼저 구매 기록이 있는지 확인
        const { count } = await supabase
            .from("market_purchase")
            .select("*", { count: "exact", head: true })
            .eq("student_id", student.id);

        const ok = await confirm({
            title: `${student.name} 학생을 지울까요?`,
            message: count && count > 0
                ? `구매 기록 ${count}건도 함께 지워져요. 지운 학생은 되살릴 수 없어요.`
                : "지운 학생은 되살릴 수 없어요.",
            confirmLabel: "학생 지우기",
            danger: true,
        });
        if (!ok) return;

        // 구매 기록과 함께 지우기 (서버 함수에서 한 번에)
        const { error } = await teacherApi.deleteStudent(student.id);

        if (error) {
            toast(`지우지 못했어요: ${error.message}`, "error");
        } else {
            toast(`${student.name} 학생을 지웠어요.`);
            loadStudents();
        }
    };

    const changePassword = async () => {
        if (!passwordTarget) return;
        if (!newPassword.trim()) {
            setDialogError("새 비밀번호를 적어 주세요.");
            return;
        }

        const { error } = await teacherApi.setStudentPassword(passwordTarget.id, newPassword.trim());

        if (error) {
            setDialogError(`바꾸지 못했어요: ${error.message}`);
        } else {
            toast(`${passwordTarget.name}의 비밀번호를 바꿨어요.`);
            setPasswordTarget(null);
            setNewPassword("");
        }
    };

    const addStudent = async () => {
        if (!newStudent.name.trim()) {
            setDialogError("이름을 적어 주세요.");
            return;
        }

        const { error } = await teacherApi.addStudents([{
            name: newStudent.name.trim(),
            grade,
            password: newStudent.password,
            ticket_count: newStudent.ticket_count,
        }]);

        if (error) {
            setDialogError(`추가하지 못했어요: ${error.message}`);
        } else {
            toast(`${newStudent.name.trim()} 학생을 추가했어요.`);
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

        if (fileInputRef.current) fileInputRef.current.value = "";

        if (studentsToAdd.length === 0) {
            toast("추가할 학생이 없어요. 양식(이름,비밀번호,티켓수)을 확인해 주세요.", "error");
            return;
        }

        const { error } = await teacherApi.addStudents(studentsToAdd);

        if (error) {
            toast(`올리지 못했어요: ${error.message}`, "error");
        } else {
            toast(`학생 ${studentsToAdd.length}명을 추가했어요.`);
            loadStudents();
        }
    };

    // CSV Export
    const handleExport = () => {
        const headers = ["이름", "비밀번호", "티켓수"];
        const rows = students.map(s => [s.name, s.password, s.ticket_count.toString()]);
        const csv = generateCSV(headers, rows);
        downloadCSV(`${grade}학년_학생목록.csv`, csv);
    };

    // CSV Template Download
    const handleDownloadTemplate = () => {
        const headers = ["이름", "비밀번호", "티켓수"];
        const exampleRows = [
            ["홍길동", "1234", "5"],
            ["김철수", "0000", "10"],
        ];
        const csv = generateCSV(headers, exampleRows);
        downloadCSV("학생_업로드_양식.csv", csv);
    };

    // Selection
    const toggleSelect = (id: number) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    };

    const allShownSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedIds.has(s.id));
    const selectAll = () => {
        const next = new Set(selectedIds);
        filteredStudents.forEach((s) => (allShownSelected ? next.delete(s.id) : next.add(s.id)));
        setSelectedIds(next);
    };

    // Bulk ticket management
    const applyBulkTickets = async () => {
        if (selectedIds.size === 0 || bulkTicketAmount < 1) return;

        setBulkSaving(true);
        const ids = students.filter((s) => selectedIds.has(s.id)).map((s) => s.id);
        const { error } = await teacherApi.setTickets(ids, bulkTicketAction, bulkTicketAmount);
        setBulkSaving(false);
        if (error) {
            toast(`티켓을 바꾸지 못했어요: ${error.message}`, "error");
            return;
        }

        setShowBulkTicketModal(false);
        setSelectedIds(new Set());
        loadStudents();
        toast(bulkTicketAction === "add"
            ? `${ids.length}명에게 티켓 ${bulkTicketAmount}장씩 주었어요.`
            : `${ids.length}명에게서 티켓 ${bulkTicketAmount}장씩 거둬들였어요.`);
    };

    const ticketTotal = students.reduce((sum, s) => sum + s.ticket_count, 0);

    return (
        <TeacherShell>
            <input type="file" ref={fileInputRef} accept=".csv" onChange={handleCSVUpload} hidden />

            <div className={t.pageHead}>
                <h1>{grade}학년 학생·티켓</h1>
                <nav className={t.seg} aria-label="학년 바꾸기">
                    {GRADES.map((g) => (
                        <Link key={g} href={`/teacher/students/${g}`} aria-current={g === grade ? "page" : undefined}>
                            {g}학년
                        </Link>
                    ))}
                </nav>
                <div className={t.actions}>
                    <button type="button" className={cn(t.btn, t.quiet)} onClick={handleDownloadTemplate}>
                        <FileDown aria-hidden="true" />
                        CSV 양식
                    </button>
                    <button type="button" className={cn(t.btn, t.ghost)} onClick={() => fileInputRef.current?.click()}>
                        <Upload aria-hidden="true" />
                        CSV로 추가
                    </button>
                    <button type="button" className={cn(t.btn, t.ghost)} onClick={handleExport} disabled={students.length === 0}>
                        <Download aria-hidden="true" />
                        내보내기
                    </button>
                    <button type="button" className={t.btn} onClick={() => { setDialogError(null); setShowAddModal(true); }}>
                        <UserPlus aria-hidden="true" />
                        학생 추가
                    </button>
                </div>
            </div>

            <div className={t.panel}>
                <div className={cn(t.pHead, styles.toolbar)}>
                    <label className={t.search}>
                        <Search aria-hidden="true" />
                        <span className="sr-only">학생 이름으로 찾기</span>
                        <input
                            className={t.input}
                            type="search"
                            placeholder="학생 이름으로 찾기"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </label>
                    {!loading && (
                        <p className={styles.summary}>
                            <b>{students.length}명</b> · 티켓 합계 <b>{ticketTotal}장</b>
                        </p>
                    )}
                </div>

                {loading ? (
                    <p className={t.loadingPage}>학생 목록을 불러오는 중…</p>
                ) : students.length === 0 ? (
                    <div className={t.empty}>
                        <b>{grade}학년에 등록된 학생이 없어요</b>
                        <p>‘학생 추가’로 한 명씩 넣거나, CSV 양식으로 반 전체를 한 번에 올릴 수 있어요.</p>
                    </div>
                ) : filteredStudents.length === 0 ? (
                    <div className={t.empty}>
                        <b>‘{searchQuery}’과(와) 맞는 학생이 없어요</b>
                        <p>이름을 다시 확인해 주세요.</p>
                    </div>
                ) : (
                    <div className={t.scroll}>
                        <table className={t.table}>
                            <thead>
                                <tr>
                                    <th scope="col" className={styles.checkCell}>
                                        <input
                                            type="checkbox"
                                            className={t.check}
                                            checked={allShownSelected}
                                            onChange={selectAll}
                                            aria-label="보이는 학생 모두 고르기"
                                        />
                                    </th>
                                    <th scope="col">이름</th>
                                    <th scope="col">보유 티켓</th>
                                    <th scope="col" className={t.end}><span className="sr-only">작업</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((student) => (
                                    <tr key={student.id} className={cn(selectedIds.has(student.id) && t.selected)}>
                                        <td className={styles.checkCell}>
                                            <input
                                                type="checkbox"
                                                className={t.check}
                                                checked={selectedIds.has(student.id)}
                                                onChange={() => toggleSelect(student.id)}
                                                aria-label={`${student.name} 고르기`}
                                            />
                                        </td>
                                        <td className={t.strong}>{student.name}</td>
                                        <td>
                                            {editingId === student.id ? (
                                                <span className={styles.editor}>
                                                    <span className={styles.stepper}>
                                                        <button type="button" onClick={() => setEditTickets(Math.max(0, editTickets - 1))} aria-label="1장 빼기">
                                                            <Minus aria-hidden="true" />
                                                        </button>
                                                        <input
                                                            type="number"
                                                            inputMode="numeric"
                                                            min={0}
                                                            value={editTickets}
                                                            onChange={(e) => setEditTickets(Math.max(0, Number(e.target.value)))}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") saveTickets(student);
                                                                if (e.key === "Escape") setEditingId(null);
                                                            }}
                                                            aria-label={`${student.name} 티켓 수`}
                                                            autoFocus
                                                        />
                                                        <button type="button" onClick={() => setEditTickets(editTickets + 1)} aria-label="1장 더하기">
                                                            <Plus aria-hidden="true" />
                                                        </button>
                                                    </span>
                                                    <button type="button" className={cn(t.btn, t.sm)} onClick={() => saveTickets(student)}>
                                                        <Check aria-hidden="true" />
                                                        저장
                                                    </button>
                                                    <button type="button" className={cn(t.btn, t.quiet, t.sm)} onClick={() => setEditingId(null)} aria-label="취소">
                                                        <X aria-hidden="true" />
                                                    </button>
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={styles.ticketBtn}
                                                    onClick={() => startEdit(student)}
                                                    aria-label={`${student.name} 티켓 ${student.ticket_count}장, 눌러서 고치기`}
                                                >
                                                    <b>{student.ticket_count}</b>
                                                    <span className={t.u}>장</span>
                                                </button>
                                            )}
                                        </td>
                                        <td className={t.end}>
                                            <button
                                                type="button"
                                                className={cn(t.btn, t.quiet, t.sm)}
                                                onClick={() => {
                                                    setDialogError(null);
                                                    setNewPassword("");
                                                    setPasswordTarget({ id: student.id, name: student.name });
                                                }}
                                            >
                                                <KeyRound aria-hidden="true" />
                                                비밀번호
                                            </button>
                                            <button
                                                type="button"
                                                className={cn(t.btn, t.quiet, t.sm, t.dangerText)}
                                                onClick={() => deleteStudent(student)}
                                                aria-label={`${student.name} 지우기`}
                                            >
                                                <Trash2 aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {selectedIds.size > 0 && (
                <div className={styles.bulk} role="region" aria-label="고른 학생">
                    <p>{selectedIds.size}명 골랐어요</p>
                    <button
                        type="button"
                        className={styles.bulkBtn}
                        onClick={() => { setBulkTicketAction("add"); setBulkTicketAmount(1); setShowBulkTicketModal(true); }}
                    >
                        <Ticket aria-hidden="true" />
                        티켓 주기
                    </button>
                    <button
                        type="button"
                        className={styles.clear}
                        onClick={() => { setBulkTicketAction("subtract"); setBulkTicketAmount(1); setShowBulkTicketModal(true); }}
                    >
                        티켓 거둬들이기
                    </button>
                    <button type="button" className={styles.clear} onClick={() => setSelectedIds(new Set())}>
                        고르기 취소
                    </button>
                </div>
            )}

            {showAddModal && (
                <Dialog
                    title={`${grade}학년 학생 추가`}
                    onClose={() => setShowAddModal(false)}
                    footer={
                        <>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={() => setShowAddModal(false)}>취소</button>
                            <button type="button" className={t.btn} onClick={addStudent}>추가하기</button>
                        </>
                    }
                >
                    <form className={t.form} onSubmit={(e) => { e.preventDefault(); addStudent(); }}>
                        {dialogError && <p className={t.error} role="alert">{dialogError}</p>}
                        <div>
                            <label className={t.label} htmlFor="new-name">이름</label>
                            <input
                                id="new-name"
                                className={t.input}
                                value={newStudent.name}
                                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                                placeholder="학생 이름"
                            />
                        </div>
                        <div className={t.row2}>
                            <div>
                                <label className={t.label} htmlFor="new-pw">비밀번호</label>
                                <input
                                    id="new-pw"
                                    className={t.input}
                                    value={newStudent.password}
                                    onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                                />
                                <p className={t.hint}>학생이 로그인할 때 써요.</p>
                            </div>
                            <div>
                                <label className={t.label} htmlFor="new-tickets">처음 티켓</label>
                                <input
                                    id="new-tickets"
                                    className={t.input}
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    value={newStudent.ticket_count}
                                    onChange={(e) => setNewStudent({ ...newStudent, ticket_count: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <button type="submit" hidden />
                    </form>
                </Dialog>
            )}

            {showBulkTicketModal && (
                <Dialog
                    title={bulkTicketAction === "add" ? "티켓 주기" : "티켓 거둬들이기"}
                    description={`고른 학생 ${selectedIds.size}명`}
                    onClose={() => setShowBulkTicketModal(false)}
                    footer={
                        <>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={() => setShowBulkTicketModal(false)}>취소</button>
                            <button type="button" className={t.btn} onClick={applyBulkTickets} disabled={bulkSaving || bulkTicketAmount < 1}>
                                {bulkSaving ? "바꾸는 중…" : bulkTicketAction === "add" ? `${bulkTicketAmount}장씩 주기` : `${bulkTicketAmount}장씩 거둬들이기`}
                            </button>
                        </>
                    }
                >
                    <div className={t.form}>
                        <div className={t.choice} role="group" aria-label="주기 또는 거둬들이기">
                            <button type="button" aria-pressed={bulkTicketAction === "add"} onClick={() => setBulkTicketAction("add")}>주기</button>
                            <button type="button" aria-pressed={bulkTicketAction === "subtract"} onClick={() => setBulkTicketAction("subtract")}>거둬들이기</button>
                        </div>
                        <div>
                            <label className={t.label} htmlFor="bulk-amount">한 명당 티켓 수</label>
                            <input
                                id="bulk-amount"
                                className={t.input}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={bulkTicketAmount}
                                onChange={(e) => setBulkTicketAmount(Math.max(0, Number(e.target.value)))}
                            />
                        </div>
                        <p className={styles.preview}>
                            {bulkTicketAction === "add"
                                ? <>모두 합쳐 <b>{bulkTicketAmount * selectedIds.size}장</b>을 줘요.</>
                                : <>한 명당 <b>{bulkTicketAmount}장</b>씩 빼요. 티켓이 모자란 학생은 0장이 돼요.</>}
                        </p>
                    </div>
                </Dialog>
            )}

            {passwordTarget && (
                <Dialog
                    title="비밀번호 바꾸기"
                    description={`${passwordTarget.name} 학생`}
                    onClose={() => setPasswordTarget(null)}
                    footer={
                        <>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={() => setPasswordTarget(null)}>취소</button>
                            <button type="button" className={t.btn} onClick={changePassword}>바꾸기</button>
                        </>
                    }
                >
                    <form className={t.form} onSubmit={(e) => { e.preventDefault(); changePassword(); }}>
                        {dialogError && <p className={t.error} role="alert">{dialogError}</p>}
                        <div>
                            <label className={t.label} htmlFor="new-password">새 비밀번호</label>
                            <input
                                id="new-password"
                                className={t.input}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="새 비밀번호"
                            />
                            <p className={t.hint}>학생에게 바뀐 비밀번호를 알려 주세요.</p>
                        </div>
                        <button type="submit" hidden />
                    </form>
                </Dialog>
            )}

            {confirmDialog}
            {toastElement}
        </TeacherShell>
    );
}
