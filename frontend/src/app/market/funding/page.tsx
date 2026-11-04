"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { api, Funding, Student, isFundingForGrade } from "@/lib/api";
import { FundingStrip } from "@/components/FundingStrip";
import { useToast } from "@/components/feedback";
import { cn } from "@/lib/utils";
import market from "../market.module.css";
import styles from "./funding.module.css";

function deadlineLabel(deadline: string | null) {
    if (!deadline) return null;
    const d = new Date(deadline);
    return `${d.getMonth() + 1}월 ${d.getDate()}일까지`;
}

interface GiveTrayProps {
    funding: Funding;
    balance: number;
    submitting: boolean;
    onCancel: () => void;
    onGive: (amount: number) => void;
}

// The yellow stub that opens under a funding: pick how many tickets, then give.
function GiveTray({ funding, balance, submitting, onCancel, onGive }: GiveTrayProps) {
    const remaining = Math.max(funding.target_amount - funding.current_amount, 0);
    const max = Math.max(Math.min(balance, remaining || balance), 0);
    const [amount, setAmount] = useState(Math.min(1, max));
    const valid = amount >= 1 && amount <= balance;
    const presets = [1, 5, 10].filter((n) => n < max);

    return (
        <div className={styles.tray}>
            <div className={styles.trayRow}>
                <span className={styles.trayLabel} id={`give-${funding.id}`}>낼 티켓</span>
                <div className={styles.amount} role="group" aria-labelledby={`give-${funding.id}`}>
                    <button type="button" onClick={() => setAmount((n) => Math.max(1, n - 1))} disabled={amount <= 1} aria-label="1장 줄이기">
                        <Minus aria-hidden="true" />
                    </button>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={max}
                        value={amount || ""}
                        onChange={(e) => setAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                        aria-label="낼 티켓 수"
                    />
                    <button type="button" onClick={() => setAmount((n) => Math.min(max, n + 1))} disabled={amount >= max} aria-label="1장 늘리기">
                        <Plus aria-hidden="true" />
                    </button>
                </div>
                <div className={styles.chips}>
                    {presets.map((n) => (
                        <button key={n} type="button" onClick={() => setAmount(n)}>{n}장</button>
                    ))}
                    {max > 0 && (
                        <button type="button" onClick={() => setAmount(max)}>
                            {remaining && max === remaining ? `남은 ${max}장 모두` : `${max}장 모두`}
                        </button>
                    )}
                </div>
            </div>
            <p className={cn(styles.after, !valid && styles.bad)}>
                {amount > balance
                    ? `티켓이 ${amount - balance}장 모자라요.`
                    : amount < 1
                        ? "1장 이상 넣어 주세요."
                        : `내고 나면 내 티켓은 ${balance - amount}장 남아요. 낸 티켓은 돌려받을 수 없어요.`}
            </p>
            <div className={styles.trayFoot}>
                <button type="button" className={cn(market.btn, market.ghost)} onClick={onCancel} disabled={submitting}>
                    취소
                </button>
                <button type="button" className={market.btn} onClick={() => onGive(amount)} disabled={!valid || submitting}>
                    {submitting ? "내는 중…" : `${amount}장 내기`}
                </button>
            </div>
        </div>
    );
}

export default function FundingPage() {
    const [allFundings, setAllFundings] = useState<Funding[]>([]);
    const [user, setUser] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const [openId, setOpenId] = useState<number | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [toast, toastElement] = useToast();

    const loadFundings = () => {
        api.getFundings()
            .then(setAllFundings)
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

    const handleParticipate = async (funding: Funding, amount: number) => {
        if (!user) return;

        setSubmitting(true);
        try {
            await api.participateFunding(user.id, funding.id, amount);
            toast(`‘${funding.title}’에 티켓 ${amount}장을 냈어요.`);
            window.dispatchEvent(new Event("auth_refreshed"));
            loadFundings();
            setOpenId(null);
        } catch (err) {
            toast((err instanceof Error && err.message) || "티켓을 내지 못했어요. 다시 눌러 주세요.", "error");
        } finally {
            setSubmitting(false);
        }
    };

    const balance = user?.ticket_count ?? 0;
    // 내 학년 펀딩과 전체 학년 펀딩만 보여 줘요.
    const fundings = user ? allFundings.filter((f) => isFundingForGrade(f, user.grade)) : [];
    const isDone = (f: Funding) => f.is_completed || f.current_amount >= f.target_amount;
    const open = fundings.filter((f) => !isDone(f));
    const finished = fundings.filter(isDone);

    const renderFunding = (funding: Funding) => {
        const done = isDone(funding);
        const remaining = Math.max(funding.target_amount - funding.current_amount, 0);
        const deadline = deadlineLabel(funding.deadline);

        return (
            <li key={funding.id} className={cn(styles.fund, !funding.image_url && styles.noImage, done && styles.done)}>
                {funding.image_url && (
                    <div className={styles.photo}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={funding.image_url} alt="" />
                    </div>
                )}
                <div className={styles.body}>
                    <div className={styles.titleRow}>
                        <div>
                            <h3>{funding.title}</h3>
                            {funding.description && <p className={styles.desc}>{funding.description}</p>}
                        </div>
                        {done && <span className={styles.stamp}>목표 달성</span>}
                    </div>
                    <FundingStrip current={funding.current_amount} target={funding.target_amount} done={done} onPaper />
                    {!done && (
                        <div className={styles.actions}>
                            <p className={styles.meta}>
                                <b>{remaining}장</b> 더 모으면 완성{deadline && ` · ${deadline}`}
                            </p>
                            {openId !== funding.id && (
                                <button
                                    type="button"
                                    className={cn(market.btn, styles.push)}
                                    onClick={() => setOpenId(funding.id)}
                                    disabled={balance < 1}
                                >
                                    {balance < 1 ? "낼 티켓이 없어요" : "티켓 내기"}
                                </button>
                            )}
                        </div>
                    )}
                    {!done && openId === funding.id && (
                        <GiveTray
                            funding={funding}
                            balance={balance}
                            submitting={submitting}
                            onCancel={() => setOpenId(null)}
                            onGive={(amount) => handleParticipate(funding, amount)}
                        />
                    )}
                </div>
            </li>
        );
    };

    return (
        <>
            <div className={styles.head}>
                <h1>공동 펀딩</h1>
                <p>친구들과 티켓을 모아 큰 물건을 함께 사요. 내 티켓 <b>{balance}장</b></p>
            </div>

            {loading ? (
                <p className={styles.loading}>펀딩을 불러오는 중…</p>
            ) : fundings.length === 0 ? (
                <div className={styles.empty}>
                    <b>지금 진행 중인 펀딩이 없어요</b>
                    <p>선생님이 새 펀딩을 열면 여기에 나타나요.</p>
                </div>
            ) : (
                <>
                    {open.length > 0 && (
                        <section className={styles.section} aria-labelledby="open-title">
                            <h2 className={styles.sectionTitle} id="open-title">모으는 중</h2>
                            <ul className={styles.list}>{open.map(renderFunding)}</ul>
                        </section>
                    )}
                    {finished.length > 0 && (
                        <section className={styles.section} aria-labelledby="done-title">
                            <h2 className={styles.sectionTitle} id="done-title">다 모은 펀딩</h2>
                            <ul className={styles.list}>{finished.map(renderFunding)}</ul>
                        </section>
                    )}
                </>
            )}
            {toastElement}
        </>
    );
}
