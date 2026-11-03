"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { api, Student } from "@/lib/api";
import { cn } from "@/lib/utils";
import market from "../market/market.module.css";
import styles from "./ranking.module.css";

interface RankingItem {
    id: number;
    name: string;
    grade: number;
    current_tickets: number;
    total_spent: number;
    total_funded: number;
    total_tickets: number;
}

type TabType = "total" | "spent" | "savings" | "funded";

const TABS: { type: TabType; label: string; rule: string }[] = [
    { type: "total", label: "티켓 왕", rule: "지금까지 받은 티켓을 모두 더한 수예요. (가진 티켓 + 쓴 티켓 + 펀딩에 낸 티켓)" },
    { type: "spent", label: "소비 왕", rule: "마켓에서 물건을 사는 데 쓴 티켓 수예요." },
    { type: "savings", label: "저축 왕", rule: "쓰지 않고 지금 가지고 있는 티켓 수예요." },
    { type: "funded", label: "기부 왕", rule: "공동 펀딩에 낸 티켓 수예요." },
];

const GRADES = [3, 4, 5, 6];

export default function RankingPage() {
    const [rankings, setRankings] = useState<RankingItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>("total");
    const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
    const [currentUser, setCurrentUser] = useState<Student | null>(null);

    useEffect(() => {
        // Load current user (optional - might not be logged in)
        const stored = localStorage.getItem("user");
        if (stored) {
            try {
                setCurrentUser(JSON.parse(stored));
            } catch {}
        }

        // Fetch rankings (no login required)
        api.getStudentRankings()
            .then((data) => setRankings(data as RankingItem[]))
            .catch((err) => {
                console.error("Failed to load rankings:", err);
                setFailed(true);
            })
            .finally(() => setLoading(false));
    }, []);

    const getValue = (item: RankingItem) => {
        switch (activeTab) {
            case "total": return item.total_tickets;
            case "spent": return item.total_spent;
            case "savings": return item.current_tickets;
            case "funded": return item.total_funded;
        }
    };

    const sorted = rankings
        .filter((item) => gradeFilter === "all" || item.grade === gradeFilter)
        .sort((a, b) => getValue(b) - getValue(a));

    const myIndex = currentUser ? sorted.findIndex((item) => item.id === currentUser.id) : -1;
    const tab = TABS.find((t) => t.type === activeTab)!;
    const top = sorted.slice(0, 3);
    const rest = sorted.slice(3);

    return (
        <>
            <header className={market.top}>
                <div className={cn(market.wrap, market.topIn)}>
                    <Link href={currentUser ? "/market" : "/"} className={market.logo}>곡수마켓</Link>
                    <div className={market.acts}>
                        <Link href={currentUser ? "/market" : "/"} className={market.hbtn}>
                            <ChevronLeft className={market.icon} aria-hidden="true" />
                            {currentUser ? "마켓으로" : "처음으로"}
                        </Link>
                    </div>
                </div>
            </header>

            <main className={styles.main}>
                <div className={styles.head}>
                    <h1>마켓 랭킹</h1>
                    <p>곡수마켓에서 티켓을 가장 많이 모으고, 쓰고, 나눈 친구들이에요.</p>
                </div>

                <div className={styles.controls}>
                    <div className={styles.seg} role="group" aria-label="랭킹 종류">
                        {TABS.map((t) => (
                            <button key={t.type} type="button" aria-pressed={activeTab === t.type} onClick={() => setActiveTab(t.type)}>
                                {t.label}
                            </button>
                        ))}
                    </div>
                    <div className={cn(styles.seg, styles.gradeSeg)} role="group" aria-label="학년">
                        {(["all", ...GRADES] as const).map((g) => (
                            <button key={g} type="button" aria-pressed={gradeFilter === g} onClick={() => setGradeFilter(g)}>
                                {g === "all" ? "전체" : `${g}학년`}
                            </button>
                        ))}
                    </div>
                </div>
                <p className={styles.rule}>{tab.rule}</p>

                {loading ? (
                    <p className={styles.loading}>랭킹을 세는 중…</p>
                ) : failed ? (
                    <div className={cn(styles.panel, styles.empty)}>
                        <b>랭킹을 불러오지 못했어요</b>
                        <p>잠시 뒤 새로고침해 주세요.</p>
                    </div>
                ) : sorted.length === 0 ? (
                    <div className={cn(styles.panel, styles.empty)}>
                        <b>아직 랭킹이 없어요</b>
                        <p>{gradeFilter === "all" ? "티켓을 받은 친구가 생기면 여기에 나타나요." : `${gradeFilter}학년 기록이 아직 없어요.`}</p>
                    </div>
                ) : (
                    <>
                        <ol className={styles.podium} aria-label={`${tab.label} 1등부터 3등`}>
                            {top.map((item, i) => (
                                <li key={item.id} className={cn(i === 0 && styles.first)}>
                                    <div className={styles.prize}>
                                        <div className={styles.rankStub} aria-label={`${i + 1}등`}>{i + 1}</div>
                                        <div className={styles.prizeBody}>
                                            <span className={styles.prizeName}>
                                                {item.name}
                                                {currentUser?.id === item.id && <span className={styles.me}>나</span>}
                                            </span>
                                            <span className={styles.prizeGrade}>{item.grade}학년</span>
                                            <span className={styles.prizeValue}>{getValue(item)}<small>장</small></span>
                                        </div>
                                    </div>
                                </li>
                            ))}
                        </ol>

                        {rest.length > 0 && (
                            <div className={styles.panel}>
                                <ol className={styles.rows} start={4}>
                                    {rest.map((item, idx) => (
                                        <li key={item.id} className={cn(styles.row, currentUser?.id === item.id && styles.mine)}>
                                            <span className={styles.rank}>{idx + 4}</span>
                                            <span className={styles.who}>
                                                {item.name}
                                                {currentUser?.id === item.id && <span className={styles.me}>나</span>}
                                                <span>{item.grade}학년</span>
                                            </span>
                                            <span className={styles.value}>{getValue(item)}<small>장</small></span>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )}

                        {myIndex >= 3 && (
                            <div className={styles.myBar} role="status">
                                <b>{myIndex + 1}등</b>
                                <span>{sorted[myIndex].name} (나)</span>
                                <span className={styles.value}>{getValue(sorted[myIndex])}<small>장</small></span>
                            </div>
                        )}
                    </>
                )}
            </main>
        </>
    );
}
