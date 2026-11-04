"use client";

import { useState } from "react";
import { DoorClosed, DoorOpen, Eye } from "lucide-react";
import { teacherApi } from "@/lib/teacherApi";
import { reopenCountdown, reopenSummary, setMarketStatus, useMarketStatus } from "@/lib/marketStatus";
import { Dialog } from "@/components/Dialog";
import { useToast } from "@/components/feedback";
import { cn } from "@/lib/utils";
import t from "@/app/teacher/teacher.module.css";
import styles from "./closurePanel.module.css";

const MESSAGE_MAX = 200;

interface FormState {
    reopen_date: string;
    reopen_time: string;
    message: string;
}

function todayYmd() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 교사 대시보드: 학생 마켓을 리뉴얼 동안 닫고 여는 곳. 닫혀 있어도 마켓 랭킹·교사 페이지는 열려요.
export function MarketClosurePanel() {
    const status = useMarketStatus();
    const [form, setForm] = useState<FormState | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [toast, toastElement] = useToast();

    const closed = !!status?.is_closed;

    const openForm = () => {
        setFormError(null);
        setForm({
            reopen_date: status?.reopen_date ?? "",
            reopen_time: status?.reopen_time?.slice(0, 5) ?? "",
            message: status?.message ?? "",
        });
    };

    const save = async (next: { is_closed: boolean } & FormState) => {
        setSaving(true);
        setFormError(null);
        const { data, error } = await teacherApi.setMarketClosure({
            is_closed: next.is_closed,
            reopen_date: next.reopen_date || null,
            reopen_time: next.reopen_time || null,
            message: next.message.trim() || null,
        });
        setSaving(false);

        if (error || !data) {
            console.error("Failed to save market closure:", error);
            const missing = error && /teacher_set_market_closure|schema cache|does not exist/i.test(error.message);
            const text = missing
                ? "휴업 설정을 저장할 곳이 아직 없어요. Supabase에서 supabase_market_closure.sql 을 먼저 실행해 주세요."
                : "저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.";
            if (form) setFormError(text);
            else toast(text, "error");
            return false;
        }
        setMarketStatus(data);
        return true;
    };

    const submitForm = async () => {
        if (!form) return;
        if (form.message.length > MESSAGE_MAX) {
            setFormError(`한마디는 ${MESSAGE_MAX}자까지 쓸 수 있어요.`);
            return;
        }
        const wasClosed = closed;
        if (await save({ is_closed: true, ...form })) {
            setForm(null);
            toast(wasClosed ? "휴업 안내를 고쳤어요." : "학생 마켓을 닫았어요. 랭킹과 교사 페이지는 열려 있어요.");
        }
    };

    const reopen = async () => {
        // 다시 열 때는 안내 내용을 남겨 두지 않아요 (다음 휴업 때 예전 날짜가 보이지 않게)
        if (await save({ is_closed: false, reopen_date: "", reopen_time: "", message: "" })) {
            toast("학생 마켓을 다시 열었어요.");
        }
    };

    const when = status ? reopenSummary(status) : null;
    const countdown = status?.reopen_date ? reopenCountdown(status.reopen_date) : null;

    return (
        <section className={cn(t.panel, closed && styles.closedPanel)} aria-labelledby="closure-title">
            <div className={t.pHead}>
                <h2 id="closure-title">학생 마켓 문</h2>
                {status && (closed ? (
                    <span className={styles.stamp}>임시 휴업</span>
                ) : (
                    <span className={cn(t.tag, styles.openTag)}>영업 중</span>
                ))}
            </div>

            <div className={styles.body}>
                {!status ? (
                    <p className={t.muted}>확인하는 중…</p>
                ) : closed ? (
                    <>
                        <dl className={styles.facts}>
                            <div>
                                <dt>다시 여는 날</dt>
                                <dd>
                                    {when ?? "정하지 않음"}
                                    {when && (
                                        <span className={styles.when}>{countdown ?? "날짜가 지났어요"}</span>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>학생에게 한마디</dt>
                                <dd className={!status.message ? styles.none : undefined}>{status.message ?? "없음"}</dd>
                            </div>
                        </dl>
                        {countdown === null && when && (
                            <p className={styles.note}>날짜가 지나도 저절로 열리지 않아요. 준비가 끝나면 다시 열어 주세요.</p>
                        )}
                        <div className={styles.acts}>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={openForm} disabled={saving}>
                                안내 고치기
                            </button>
                            <button type="button" className={t.btn} onClick={reopen} disabled={saving}>
                                <DoorOpen aria-hidden="true" />
                                {saving ? "여는 중…" : "지금 다시 열기"}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <p className={styles.lede}>
                            리뉴얼하는 동안 잠시 닫으면 학생은 로그인·구매·펀딩을 할 수 없어요.
                            마켓 랭킹과 교사 페이지는 그대로 열려요.
                        </p>
                        <div className={styles.acts}>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={openForm}>
                                <DoorClosed aria-hidden="true" />
                                임시로 닫기
                            </button>
                        </div>
                    </>
                )}
            </div>

            {closed && (
                <div className={t.pFoot}>
                    <a className={t.link} href="/" target="_blank" rel="noopener">
                        <Eye className={t.icon} aria-hidden="true" />
                        학생이 보는 휴업 화면
                    </a>
                </div>
            )}

            {form && (
                <Dialog
                    title={closed ? "휴업 안내 고치기" : "학생 마켓 임시로 닫기"}
                    description="학생 화면에 다시 여는 날과 한마디가 보여요."
                    onClose={() => setForm(null)}
                    width={480}
                    footer={
                        <>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={() => setForm(null)}>취소</button>
                            <button type="button" className={t.btn} onClick={submitForm} disabled={saving}>
                                {saving ? "저장하는 중…" : closed ? "고친 내용 저장" : "마켓 닫기"}
                            </button>
                        </>
                    }
                >
                    <form className={t.form} onSubmit={(e) => { e.preventDefault(); submitForm(); }}>
                        {formError && <p className={t.error} role="alert">{formError}</p>}
                        <div className={t.row2}>
                            <div>
                                <label className={t.label} htmlFor="reopen-date">다시 여는 날</label>
                                <input
                                    id="reopen-date"
                                    className={t.input}
                                    type="date"
                                    min={todayYmd()}
                                    value={form.reopen_date}
                                    onChange={(e) => setForm({ ...form, reopen_date: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className={t.label} htmlFor="reopen-time">시간 <span className={styles.optional}>(선택)</span></label>
                                <input
                                    id="reopen-time"
                                    className={cn(t.input, styles.timeInput)}
                                    type="time"
                                    step={600}
                                    value={form.reopen_time}
                                    disabled={!form.reopen_date}
                                    onChange={(e) => setForm({ ...form, reopen_time: e.target.value })}
                                />
                            </div>
                        </div>
                        <p className={cn(t.hint, styles.formHint)}>
                            날짜를 비우면 학생에게 &lsquo;아직 정하는 중&rsquo;으로 보여요. 날짜가 지나도 저절로 열리지 않으니 준비가 끝나면 대시보드에서 다시 열어 주세요.
                        </p>
                        <div>
                            <label className={t.label} htmlFor="reopen-message">학생에게 한마디 <span className={styles.optional}>(선택)</span></label>
                            <textarea
                                id="reopen-message"
                                className={t.input}
                                rows={3}
                                maxLength={MESSAGE_MAX}
                                value={form.message}
                                onChange={(e) => setForm({ ...form, message: e.target.value })}
                                placeholder="예: 새 상품을 가득 채워서 돌아올게요!"
                            />
                            <p className={t.hint}>{form.message.length}/{MESSAGE_MAX}자</p>
                        </div>
                    </form>
                </Dialog>
            )}
            {toastElement}
        </section>
    );
}
