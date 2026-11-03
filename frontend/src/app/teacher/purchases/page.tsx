"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAuthenticated, generateCSV, downloadCSV } from "@/lib/teacherAuth";
import { Check, Download, Trash2, Undo2, X } from "lucide-react";
import { TeacherShell } from "@/components/TeacherShell";
import { useConfirm, useToast } from "@/components/feedback";
import { cn } from "@/lib/utils";
import t from "../teacher.module.css";

interface PurchaseWithDetails {
    id: number;
    timestamp: string;
    is_delivered: boolean;
    student_id: number;
    item_id: number;
    student: { name: string; grade: number } | null;
    item: { name: string; cost: number } | null;
}

type Status = "all" | "pending" | "delivered";

const GRADES = [3, 4, 5, 6];

function stamp(iso: string) {
    const d = new Date(iso);
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}`;
}

export default function PurchasesPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [purchases, setPurchases] = useState<PurchaseWithDetails[]>([]);
    const [status, setStatus] = useState<Status>("pending");
    const [grade, setGrade] = useState(0);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [confirm, confirmDialog] = useConfirm();
    const [toast, toastElement] = useToast();

    const loadPurchases = async () => {
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
            toast("구매 내역을 불러오지 못했어요. 새로고침해 주세요.", "error");
        } else {
            // Supabase types the joined rows loosely; each join is a single row here
            const rows = (data || []) as unknown as (Omit<PurchaseWithDetails, "student" | "item"> & {
                market_student: PurchaseWithDetails["student"];
                market_item: PurchaseWithDetails["item"];
            })[];
            setPurchases(rows.map((p) => ({
                id: p.id,
                timestamp: p.timestamp,
                is_delivered: p.is_delivered,
                student_id: p.student_id,
                item_id: p.item_id,
                student: p.market_student,
                item: p.market_item,
            })));
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/teacher");
            return;
        }
        loadPurchases();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const toggleDelivered = async (purchase: PurchaseWithDetails) => {
        setBusyId(purchase.id);
        const { error } = await supabase
            .from("market_purchase")
            .update({ is_delivered: !purchase.is_delivered })
            .eq("id", purchase.id);
        setBusyId(null);

        if (error) {
            toast(`전달 상태를 바꾸지 못했어요: ${error.message}`, "error");
        } else {
            setPurchases((prev) => prev.map((p) => (p.id === purchase.id ? { ...p, is_delivered: !p.is_delivered } : p)));
        }
    };

    // 구매 취소 (전달 대기 상태인 경우만) - 티켓과 수량 복구
    const cancelPurchase = async (purchase: PurchaseWithDetails) => {
        const ok = await confirm({
            title: "구매를 취소할까요?",
            message: `${purchase.student?.name}의 ‘${purchase.item?.name}’ 구매를 취소해요.\n학생에게 티켓 ${purchase.item?.cost ?? 0}장이 돌아가고, 상품 재고도 1개 늘어나요.`,
            confirmLabel: "구매 취소",
            danger: true,
        });
        if (!ok) return;

        const { error } = await supabase.rpc("cancel_purchase_rpc", { p_purchase_id: purchase.id });
        if (error) {
            toast(`취소하지 못했어요: ${error.message}`, "error");
            return;
        }
        toast("구매를 취소했어요. 티켓과 재고가 돌아갔어요.");
        loadPurchases();
    };

    // 전달 완료 내역 삭제 (데이터베이스 정리용)
    const deletePurchase = async (purchase: PurchaseWithDetails) => {
        const ok = await confirm({
            title: "구매 기록을 지울까요?",
            message: `${purchase.student?.name}의 ‘${purchase.item?.name}’ 기록을 지워요.\n이미 전달한 물건이라 티켓과 재고는 돌아가지 않아요.`,
            confirmLabel: "기록 지우기",
            danger: true,
        });
        if (!ok) return;

        const { error } = await supabase.from("market_purchase").delete().eq("id", purchase.id);
        if (error) {
            toast(`지우지 못했어요: ${error.message}`, "error");
            return;
        }
        toast("구매 기록을 지웠어요.");
        setPurchases((prev) => prev.filter((p) => p.id !== purchase.id));
    };

    const byGrade = purchases.filter((p) => !grade || p.student?.grade === grade);
    const counts = {
        all: byGrade.length,
        pending: byGrade.filter((p) => !p.is_delivered).length,
        delivered: byGrade.filter((p) => p.is_delivered).length,
    };
    const shown = byGrade.filter((p) => (status === "pending" ? !p.is_delivered : status === "delivered" ? p.is_delivered : true));

    // CSV Export
    const handleExport = () => {
        const headers = ["학생이름", "학년", "상품명", "가격", "구매일시", "전달상태"];
        const rows = shown.map(p => [
            p.student?.name || "",
            p.student?.grade?.toString() || "",
            p.item?.name || "",
            p.item?.cost?.toString() || "",
            new Date(p.timestamp).toLocaleString("ko-KR"),
            p.is_delivered ? "완료" : "대기",
        ]);
        const csv = generateCSV(headers, rows);
        const filterName = status === "all" ? "전체" : status === "pending" ? "전달대기" : "전달완료";
        downloadCSV(`구매내역_${filterName}.csv`, csv);
    };

    const statuses: { key: Status; label: string }[] = [
        { key: "pending", label: "전달 대기" },
        { key: "delivered", label: "전달 완료" },
        { key: "all", label: "전체" },
    ];

    return (
        <TeacherShell pendingCount={purchases.filter((p) => !p.is_delivered).length}>
            <div className={t.pageHead}>
                <h1>구매 내역</h1>
                <div className={t.actions}>
                    <button type="button" className={cn(t.btn, t.ghost)} onClick={handleExport} disabled={shown.length === 0}>
                        <Download aria-hidden="true" />
                        보이는 목록 내보내기
                    </button>
                </div>
            </div>

            <div className={t.panel}>
                <div className={t.pHead}>
                    <div className={t.seg} role="group" aria-label="전달 상태">
                        {statuses.map((s) => (
                            <button key={s.key} type="button" aria-pressed={status === s.key} onClick={() => setStatus(s.key)}>
                                {s.label}<span className={t.segCount}>{counts[s.key]}</span>
                            </button>
                        ))}
                    </div>
                    <div className={cn(t.seg, t.push)} role="group" aria-label="학년">
                        {[0, ...GRADES].map((g) => (
                            <button key={g} type="button" aria-pressed={grade === g} onClick={() => setGrade(g)}>
                                {g ? `${g}학년` : "전체 학년"}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <p className={t.loadingPage}>구매 내역을 불러오는 중…</p>
                ) : shown.length === 0 ? (
                    <div className={t.empty}>
                        <b>{status === "pending" ? "전달할 물건이 없어요" : "해당하는 구매 내역이 없어요"}</b>
                        <p>{status === "pending" ? "학생이 새로 사면 여기에 올라와요." : "다른 상태나 학년을 골라 보세요."}</p>
                    </div>
                ) : (
                    <div className={t.scroll}>
                        <table className={t.table}>
                            <thead>
                                <tr>
                                    <th scope="col">학생</th>
                                    <th scope="col">상품</th>
                                    <th scope="col" className={t.num}>가격</th>
                                    <th scope="col">산 시각</th>
                                    <th scope="col">전달</th>
                                    <th scope="col" className={t.end}><span className="sr-only">작업</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((p) => (
                                    <tr key={p.id}>
                                        <td>
                                            <span className={t.strong}>{p.student?.name ?? "알 수 없음"}</span>{" "}
                                            <span className={t.muted}>{p.student?.grade}학년</span>
                                        </td>
                                        <td>{p.item?.name ?? "삭제된 상품"}</td>
                                        <td className={t.num}><span className={t.price}>{p.item?.cost ?? 0}<small>장</small></span></td>
                                        <td className={cn(t.muted, t.nowrap)}>{stamp(p.timestamp)}</td>
                                        <td>
                                            {p.is_delivered ? (
                                                <span className={t.mark}>전달 완료</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={cn(t.btn, t.sm)}
                                                    onClick={() => toggleDelivered(p)}
                                                    disabled={busyId === p.id}
                                                >
                                                    <Check aria-hidden="true" />
                                                    전달 완료
                                                </button>
                                            )}
                                        </td>
                                        <td className={t.end}>
                                            {p.is_delivered ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className={cn(t.btn, t.quiet, t.sm)}
                                                        onClick={() => toggleDelivered(p)}
                                                        disabled={busyId === p.id}
                                                    >
                                                        <Undo2 aria-hidden="true" />
                                                        대기로
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={cn(t.btn, t.quiet, t.sm, t.dangerText)}
                                                        onClick={() => deletePurchase(p)}
                                                        aria-label="기록 지우기"
                                                    >
                                                        <Trash2 aria-hidden="true" />
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className={cn(t.btn, t.quiet, t.sm, t.dangerText)}
                                                    onClick={() => cancelPurchase(p)}
                                                >
                                                    <X aria-hidden="true" />
                                                    구매 취소
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            {confirmDialog}
            {toastElement}
        </TeacherShell>
    );
}
