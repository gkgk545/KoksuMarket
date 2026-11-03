"use client";

import { useEffect, useState } from "react";
import { api, Student, Purchase } from "@/lib/api";
import { cn } from "@/lib/utils";
import styles from "./history.module.css";

type Filter = "all" | "waiting" | "delivered";

const DAY = "일월화수목금토";

function dayLabel(d: Date) {
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY[d.getDay()]})`;
}

function timeLabel(d: Date) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function HistoryPage() {
    const [user, setUser] = useState<Student | null>(null);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>("all");

    useEffect(() => {
        const stored = localStorage.getItem("user");
        if (stored) {
            const parsedUser = JSON.parse(stored);
            setUser(parsedUser);

            // Fetch detailed user data including purchases
            api.getStudentDetail(parsedUser.id)
                .then((data) => {
                    // Sorting purchases by timestamp descending (newest first)
                    const sorted = data.purchases.sort((a, b) =>
                        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                    );
                    setPurchases(sorted);
                })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    if (loading) {
        return <p className={styles.loading}>구매 기록을 찾는 중…</p>;
    }

    if (!user) return null;

    const waiting = purchases.filter((p) => !p.is_delivered).length;
    const spent = purchases.reduce((sum, p) => sum + (p.item_cost ?? 0), 0);
    const shown = purchases.filter((p) =>
        filter === "all" ? true : filter === "waiting" ? !p.is_delivered : p.is_delivered
    );

    // Group lines under the day they were bought
    const days: { label: string; items: Purchase[] }[] = [];
    for (const p of shown) {
        const label = dayLabel(new Date(p.timestamp));
        const last = days[days.length - 1];
        if (last && last.label === label) last.items.push(p);
        else days.push({ label, items: [p] });
    }

    const filters: { key: Filter; label: string }[] = [
        { key: "all", label: "전체" },
        { key: "waiting", label: `받기 전 ${waiting}` },
        { key: "delivered", label: "받은 것" },
    ];

    return (
        <>
            <div className={styles.head}>
                <h1>구매 기록</h1>
                <div className={styles.seg} role="group" aria-label="구매 기록 거르기">
                    {filters.map((f) => (
                        <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.receipt}>
                <div className={styles.rTop}>
                    <b>곡수마켓</b>
                    <span>{user.grade}학년 {user.name}의 구매 기록</span>
                </div>
                <dl className={styles.totals}>
                    <div><dt>산 횟수</dt><dd>{purchases.length}<small>번</small></dd></div>
                    <div><dt>쓴 티켓</dt><dd>{spent}<small>장</small></dd></div>
                    <div className={styles.wait}><dt>받기 전</dt><dd>{waiting}<small>개</small></dd></div>
                </dl>

                {shown.length === 0 ? (
                    <div className={styles.empty}>
                        {purchases.length === 0 ? (
                            <>
                                <b>아직 산 물건이 없어요</b>
                                <p>상품 목록에서 마음에 드는 물건을 골라 보세요.</p>
                            </>
                        ) : filter === "waiting" ? (
                            <>
                                <b>받기를 기다리는 물건이 없어요</b>
                                <p>산 물건은 모두 선생님께 받았어요.</p>
                            </>
                        ) : (
                            <>
                                <b>아직 받은 물건이 없어요</b>
                                <p>선생님이 물건을 건네주면 여기에 표시돼요.</p>
                            </>
                        )}
                    </div>
                ) : (
                    days.map((day) => (
                        <section key={day.label}>
                            <h2 className={styles.day}>{day.label}</h2>
                            <ul className={styles.lines}>
                                {day.items.map((p) => (
                                    <li key={p.id} className={styles.line}>
                                        <div>
                                            <div className={styles.name}>{p.item_name}</div>
                                            <div className={styles.time}>{timeLabel(new Date(p.timestamp))}</div>
                                        </div>
                                        <div className={styles.cost}>{p.item_cost}<small>장</small></div>
                                        <div className={styles.status}>
                                            <span className={cn(p.is_delivered ? styles.delivered : styles.waiting)}>
                                                {p.is_delivered ? "전달 완료" : "선생님께 받기 전"}
                                            </span>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))
                )}
            </div>
        </>
    );
}
