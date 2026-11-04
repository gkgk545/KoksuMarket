"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAuthenticated } from "@/lib/teacherAuth";
import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { Funding, FundingParticipation, api, fundingGrade } from "@/lib/api";
import { TeacherShell } from "@/components/TeacherShell";
import { Dialog } from "@/components/Dialog";
import { FundingStrip } from "@/components/FundingStrip";
import { useConfirm, useToast } from "@/components/feedback";
import { cn } from "@/lib/utils";
import t from "../teacher.module.css";
import styles from "./funding.module.css";

type FundingForm = {
    id?: number;
    title: string;
    description: string;
    target_amount: number;
    image_url: string;
    is_completed: boolean;
    grade: number | "all" | null; // null = 아직 고르지 않음
};

const EMPTY_FORM: FundingForm = { title: "", description: "", target_amount: 100, image_url: "", is_completed: false, grade: null };

const GRADES = [3, 4, 5, 6];
const gradeLabel = (g: number | null) => (g === null ? "전체 학년" : `${g}학년`);

function stamp(iso: string) {
    const d = new Date(iso);
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}`;
}

export default function TeacherFundingPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [fundings, setFundings] = useState<Funding[]>([]);
    const [form, setForm] = useState<FundingForm | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [viewingDetail, setViewingDetail] = useState<{ funding: Funding; participations: FundingParticipation[] } | null>(null);
    const [confirm, confirmDialog] = useConfirm();
    const [toast, toastElement] = useToast();

    const loadFundings = async () => {
        try {
            const data = await api.getFundings();
            setFundings(data);
        } catch (err) {
            console.error(err);
            toast("펀딩을 불러오지 못했어요. 새로고침해 주세요.", "error");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/teacher");
            return;
        }
        loadFundings();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const openAdd = () => {
        setFormError(null);
        setForm({ ...EMPTY_FORM });
    };

    const openEdit = (f: Funding) => {
        setFormError(null);
        setForm({
            id: f.id,
            title: f.title,
            description: f.description ?? "",
            target_amount: f.target_amount,
            image_url: f.image_url ?? "",
            is_completed: f.is_completed,
            grade: fundingGrade(f) ?? "all",
        });
    };

    const saveFunding = async () => {
        if (!form) return;
        if (!form.title.trim()) {
            setFormError("펀딩 이름을 적어 주세요.");
            return;
        }
        if (form.target_amount < 1) {
            setFormError("목표는 1장 이상이어야 해요.");
            return;
        }
        if (form.grade === null) {
            setFormError("어느 학년 펀딩인지 골라 주세요.");
            return;
        }

        setSaving(true);
        const payload = {
            grade: form.grade === "all" ? null : form.grade,
            title: form.title.trim(),
            description: form.description.trim() || null,
            target_amount: form.target_amount,
            image_url: form.image_url.trim() || null,
        };
        const { error } = form.id
            ? await supabase.from("market_funding").update({ ...payload, is_completed: form.is_completed }).eq("id", form.id)
            : await supabase.from("market_funding").insert(payload);
        setSaving(false);

        if (error) {
            setFormError(`저장하지 못했어요: ${error.message}`);
            return;
        }
        toast(form.id ? `‘${payload.title}’을(를) 고쳤어요.` : `‘${payload.title}’ 펀딩을 열었어요.`);
        setForm(null);
        loadFundings();
    };

    const deleteFunding = async (f: Funding) => {
        const ok = await confirm({
            title: `‘${f.title}’ 펀딩을 지울까요?`,
            message: "참여 기록도 모두 지워지고, 학생들이 낸 티켓은 자동으로 돌려주지 않아요.\n돌려줘야 한다면 학생·티켓 화면에서 직접 더해 주세요.",
            confirmLabel: "펀딩 지우기",
            danger: true,
        });
        if (!ok) return;

        const { error } = await supabase.from("market_funding").delete().eq("id", f.id);

        if (error) {
            toast(`지우지 못했어요: ${error.message}`, "error");
        } else {
            toast(`‘${f.title}’ 펀딩을 지웠어요.`);
            loadFundings();
        }
    };

    const viewDetails = async (funding: Funding) => {
        try {
            const detail = await api.getFundingDetail(funding.id);
            setViewingDetail(detail);
        } catch (err) {
            toast(`참여 내역을 불러오지 못했어요: ${(err as Error).message}`, "error");
        }
    };

    const isClosed = (f: Funding) => f.is_completed;
    const openCount = fundings.filter((f) => !isClosed(f)).length;

    return (
        <TeacherShell>
            <div className={t.pageHead}>
                <h1>공동 펀딩</h1>
                {!loading && <p>모으는 중 {openCount}개 · 마감 {fundings.length - openCount}개</p>}
                <div className={t.actions}>
                    <button type="button" className={t.btn} onClick={openAdd}>
                        <Plus aria-hidden="true" />
                        새 펀딩 열기
                    </button>
                </div>
            </div>

            <div className={t.panel}>
                {loading ? (
                    <p className={t.loadingPage}>펀딩을 불러오는 중…</p>
                ) : fundings.length === 0 ? (
                    <div className={t.empty}>
                        <b>아직 연 펀딩이 없어요</b>
                        <p>반 전체가 티켓을 모아 살 물건이 있다면 ‘새 펀딩 열기’를 눌러 보세요.</p>
                    </div>
                ) : (
                    <ul className={styles.list}>
                        {fundings.map((f) => {
                            const closed = isClosed(f);
                            const reached = f.current_amount >= f.target_amount;
                            return (
                                <li key={f.id} className={cn(styles.row, closed && styles.closed)}>
                                    <div>
                                        <div className={styles.titleLine}>
                                            <span className={t.tag}>{gradeLabel(fundingGrade(f))}</span>
                                            <span className={styles.title}>{f.title}</span>
                                            {closed ? (
                                                <span className={t.tag}>마감</span>
                                            ) : reached ? (
                                                <span className={cn(t.tag, t.tagWait)}>목표 달성 · 마감 처리 전</span>
                                            ) : (
                                                <span className={cn(t.tag, t.tagWait)}>모으는 중</span>
                                            )}
                                        </div>
                                        {f.description && <p className={styles.desc}>{f.description}</p>}
                                    </div>
                                    <FundingStrip current={f.current_amount} target={f.target_amount} done={closed || reached} onPaper compact />
                                    <span className={styles.rowActions}>
                                        <button type="button" className={cn(t.btn, t.quiet, t.sm)} onClick={() => viewDetails(f)}>
                                            <Users aria-hidden="true" />
                                            참여 내역
                                        </button>
                                        <button type="button" className={cn(t.btn, t.quiet, t.sm)} onClick={() => openEdit(f)}>
                                            <Pencil aria-hidden="true" />
                                            고치기
                                        </button>
                                        <button
                                            type="button"
                                            className={cn(t.btn, t.quiet, t.sm, t.dangerText)}
                                            onClick={() => deleteFunding(f)}
                                            aria-label={`${f.title} 지우기`}
                                        >
                                            <Trash2 aria-hidden="true" />
                                        </button>
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {viewingDetail && (
                <Dialog
                    title={`${viewingDetail.funding.title} 참여 내역`}
                    description={`참여 ${viewingDetail.participations.length}번`}
                    onClose={() => setViewingDetail(null)}
                    width={480}
                >
                    <div className={styles.detailTop}>
                        <FundingStrip
                            current={viewingDetail.funding.current_amount}
                            target={viewingDetail.funding.target_amount}
                            done={viewingDetail.funding.is_completed}
                            onPaper
                            compact
                        />
                    </div>
                    {viewingDetail.participations.length === 0 ? (
                        <p className={t.muted}>아직 참여한 학생이 없어요.</p>
                    ) : (
                        <ul className={styles.people}>
                            {viewingDetail.participations.map((part) => (
                                <li key={part.id} className={styles.person}>
                                    <span className={styles.personName}>{part.student_name}</span>
                                    <span className={styles.amount}>+{part.amount}<small>장</small></span>
                                    <span className={styles.personTime}>{stamp(part.timestamp)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Dialog>
            )}

            {form && (
                <Dialog
                    title={form.id ? "펀딩 고치기" : "새 펀딩 열기"}
                    onClose={() => setForm(null)}
                    footer={
                        <>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={() => setForm(null)}>취소</button>
                            <button type="button" className={t.btn} onClick={saveFunding} disabled={saving}>
                                {saving ? "저장하는 중…" : form.id ? "고친 내용 저장" : "펀딩 열기"}
                            </button>
                        </>
                    }
                >
                    <form className={t.form} onSubmit={(e) => { e.preventDefault(); saveFunding(); }}>
                        {formError && <p className={t.error} role="alert">{formError}</p>}
                        <div>
                            <span className={t.label} id="fund-grade">대상 학년</span>
                            <div className={t.choice} role="group" aria-labelledby="fund-grade">
                                {GRADES.map((g) => (
                                    <button key={g} type="button" aria-pressed={form.grade === g} onClick={() => setForm({ ...form, grade: g })}>
                                        {g}학년
                                    </button>
                                ))}
                                <button type="button" aria-pressed={form.grade === "all"} onClick={() => setForm({ ...form, grade: "all" })}>
                                    전체 학년
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className={t.label} htmlFor="fund-title">펀딩 이름</label>
                            <input
                                id="fund-title"
                                className={t.input}
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="예: 우리 반 피자 파티"
                            />
                        </div>
                        <div>
                            <label className={t.label} htmlFor="fund-target">목표 티켓 수</label>
                            <input
                                id="fund-target"
                                className={t.input}
                                type="number"
                                inputMode="numeric"
                                min={1}
                                value={form.target_amount}
                                onChange={(e) => setForm({ ...form, target_amount: Number(e.target.value) })}
                            />
                        </div>
                        <div>
                            <label className={t.label} htmlFor="fund-desc">설명 (선택)</label>
                            <textarea
                                id="fund-desc"
                                className={t.input}
                                rows={3}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="무엇을 사는지, 언제까지 모으는지 적어 주세요."
                            />
                        </div>
                        <div>
                            <label className={t.label} htmlFor="fund-image">사진 주소 (선택)</label>
                            <input
                                id="fund-image"
                                className={t.input}
                                value={form.image_url}
                                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                                placeholder="https://"
                            />
                        </div>
                        {form.id && (
                            <label className={t.switchRow}>
                                펀딩 마감하기 (학생이 더 낼 수 없어요)
                                <input
                                    type="checkbox"
                                    className={t.check}
                                    checked={form.is_completed}
                                    onChange={(e) => setForm({ ...form, is_completed: e.target.checked })}
                                />
                            </label>
                        )}
                        <button type="submit" hidden />
                    </form>
                </Dialog>
            )}

            {confirmDialog}
            {toastElement}
        </TeacherShell>
    );
}
