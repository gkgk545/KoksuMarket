"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight, Disc3, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { teacherApi } from "@/lib/teacherApi";
import { isAuthenticated } from "@/lib/teacherAuth";
import { TeacherShell } from "@/components/TeacherShell";
import { MarketClosurePanel } from "@/components/MarketClosurePanel";
import { RandomDrawPanel } from "@/components/RandomDrawPanel";
import { RandomDrawDialog } from "@/components/RandomDrawDialog";
import { getPool, poolForItemName, type PoolId } from "@/lib/randomDraw";
import { cn } from "@/lib/utils";
import t from "../teacher.module.css";
import styles from "./dashboard.module.css";

interface GradeStats {
    grade: number;
    studentCount: number;
    totalTickets: number;
}

interface PendingPurchase {
    id: number;
    timestamp: string;
    student: { name: string; grade: number } | null;
    item: { name: string; cost: number } | null;
    done: boolean; // delivered during this visit; kept on screen so it can be undone
}

const GRADES = [3, 4, 5, 6];

function timeLabel(iso: string) {
    const d = new Date(iso);
    const now = new Date();
    const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (d.getTime() >= startOfToday) return `오늘 ${hm}`;
    if (d.getTime() >= startOfToday - 86_400_000) return `어제 ${hm}`;
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${hm}`;
}

export default function TeacherDashboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [gradeStats, setGradeStats] = useState<GradeStats[]>([]);
    const [totalPurchases, setTotalPurchases] = useState(0);
    const [pending, setPending] = useState<PendingPurchase[]>([]);
    const [filter, setFilter] = useState(0);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [drawPool, setDrawPool] = useState<PoolId | null>(null);

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/teacher");
            return;
        }
        loadDashboardData();
    }, [router]);

    const loadDashboardData = async () => {
        try {
            const { data: students, error: studentsError } = await supabase
                .from("market_student")
                .select("grade, ticket_count");

            if (studentsError) throw studentsError;

            const statsMap = new Map<number, GradeStats>();
            GRADES.forEach(grade => {
                statsMap.set(grade, { grade, studentCount: 0, totalTickets: 0 });
            });

            students?.forEach((s: { grade: number; ticket_count: number }) => {
                const stat = statsMap.get(s.grade);
                if (stat) {
                    stat.studentCount++;
                    stat.totalTickets += s.ticket_count;
                }
            });

            setGradeStats(Array.from(statsMap.values()));

            const { count: totalCount } = await supabase
                .from("market_purchase")
                .select("*", { count: "exact", head: true });

            const { data: pendingRows, error: pendingError } = await supabase
                .from("market_purchase")
                .select(`
                    id,
                    timestamp,
                    market_student (name, grade),
                    market_item (name, cost)
                `)
                .eq("is_delivered", false)
                .order("timestamp", { ascending: false });

            if (pendingError) throw pendingError;

            setTotalPurchases(totalCount || 0);
            // Supabase types the joined rows loosely; each join is a single row here
            const rows = (pendingRows || []) as unknown as {
                id: number;
                timestamp: string;
                market_student: PendingPurchase["student"];
                market_item: PendingPurchase["item"];
            }[];
            setPending(rows.map((p) => ({
                id: p.id,
                timestamp: p.timestamp,
                student: p.market_student,
                item: p.market_item,
                done: false,
            })));
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
            setError("현황을 불러오지 못했어요. 새로고침해 주세요.");
        } finally {
            setLoading(false);
        }
    };

    const setDelivered = async (id: number, delivered: boolean) => {
        setBusyId(id);
        setError(null);
        const { error } = await teacherApi.setDelivered(id, delivered);
        setBusyId(null);

        if (error) {
            console.error("Failed to update delivery:", error);
            setError("전달 상태를 바꾸지 못했어요. 다시 눌러 주세요.");
            return;
        }
        setPending((prev) => prev.map((p) => (p.id === id ? { ...p, done: delivered } : p)));
    };

    const pendingCount = pending.filter((p) => !p.done).length;

    if (loading) {
        return (
            <TeacherShell>
                <p className={t.loadingPage}>현황을 불러오는 중…</p>
            </TeacherShell>
        );
    }

    const rows = pending
        .filter((p) => !filter || p.student?.grade === filter)
        .map((p) => ({ ...p, pool: poolForItemName(p.item?.name) }));
    const studentTotal = gradeStats.reduce((sum, s) => sum + s.studentCount, 0);
    const ticketTotal = gradeStats.reduce((sum, s) => sum + s.totalTickets, 0);

    return (
        <TeacherShell pendingCount={pendingCount}>
            <div className={t.pageHead}>
                <h1>대시보드</h1>
                <p>전달할 물건과 학년별 티켓을 한눈에 봐요.</p>
                <div className={t.actions}>
                    <Link href="/" className={cn(t.btn, t.ghost)}>
                        학생 화면 보기
                        <ExternalLink aria-hidden="true" />
                    </Link>
                </div>
            </div>

            <dl className={styles.summary} aria-label="오늘의 현황">
                <div><dt>총 학생 수</dt><dd><b>{studentTotal}</b><span>명</span></dd></div>
                <div><dt>총 구매 건수</dt><dd><b>{totalPurchases}</b><span>건</span></dd></div>
                <div className={styles.pend}><dt>전달 대기</dt><dd><b>{pendingCount}</b><span>건</span></dd></div>
            </dl>

            <div className={styles.cols}>
                <section className={t.panel} aria-labelledby="queue-title">
                    <div className={t.pHead}>
                        <h2 id="queue-title">전달할 물건<em>{pendingCount}건</em></h2>
                        <div className={cn(t.seg, styles.filter)} role="group" aria-label="학년으로 거르기">
                            {[0, ...GRADES].map((g) => (
                                <button key={g} type="button" aria-pressed={filter === g} onClick={() => setFilter(g)}>
                                    {g ? `${g}학년` : "전체"}
                                </button>
                            ))}
                        </div>
                    </div>
                    {error && <p className={cn(t.error, styles.qError)} role="alert">{error}</p>}
                    <ul className={styles.queue} aria-live="polite">
                        {rows.length === 0 ? (
                            <li className={styles.qEmpty}>
                                <b>{filter ? `${filter}학년은 ` : ""}전달할 물건이 없어요</b>
                                <p>학생이 새로 사면 여기에 올라와요.</p>
                            </li>
                        ) : (
                            rows.map((r) => (
                                <li key={r.id} className={cn(styles.q, r.done && styles.done)}>
                                    <div className={styles.t}>{timeLabel(r.timestamp)}</div>
                                    <div>
                                        <div className={styles.who}>
                                            <span>{r.student?.grade}학년</span>
                                            {r.student?.name ?? "알 수 없음"}
                                        </div>
                                        <div className={styles.what}>{r.item?.name ?? "삭제된 상품"}</div>
                                    </div>
                                    <div className={styles.cost}>{r.item?.cost ?? 0}<small>장</small></div>
                                    <div className={styles.act}>
                                        {r.done ? (
                                            <>
                                                <span className={cn(t.mark, styles.press)}>전달 완료</span>
                                                <button type="button" className={styles.undo} onClick={() => setDelivered(r.id, false)} disabled={busyId === r.id}>
                                                    되돌리기
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                {r.pool && (
                                                    <button
                                                        type="button"
                                                        className={cn(t.btn, t.ghost, styles.drawBtn)}
                                                        onClick={() => setDrawPool(r.pool)}
                                                        aria-label={`${getPool(r.pool).label} 번호 뽑기`}
                                                        title="돌림판으로 번호 뽑기"
                                                    >
                                                        <Disc3 aria-hidden="true" />
                                                        뽑기
                                                    </button>
                                                )}
                                                <button type="button" className={t.btn} onClick={() => setDelivered(r.id, true)} disabled={busyId === r.id}>
                                                    <Check aria-hidden="true" />
                                                    전달 완료
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </li>
                            ))
                        )}
                    </ul>
                    <div className={t.pFoot}>
                        <Link className={cn(t.link, styles.footLink)} href="/teacher/purchases">
                            구매 내역 전체 보기
                            <ChevronRight className={t.icon} aria-hidden="true" />
                        </Link>
                    </div>
                </section>

                <div className={styles.side}>
                    <MarketClosurePanel />
                    <RandomDrawPanel onOpen={setDrawPool} />
                    <section className={t.panel} aria-labelledby="grade-title">
                        <div className={t.pHead}>
                            <h2 id="grade-title">학년별 현황</h2>
                            <span className={t.sub}>행을 누르면 학생 목록</span>
                        </div>
                        <table className={cn(t.table, styles.grades)}>
                            <thead>
                                <tr>
                                    <th scope="col">학년</th>
                                    <th scope="col">학생 수</th>
                                    <th scope="col">총 티켓</th>
                                    <th scope="col">1인 평균</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gradeStats.map((stat) => (
                                    <tr key={stat.grade} onClick={() => router.push(`/teacher/students/${stat.grade}`)}>
                                        <td><Link href={`/teacher/students/${stat.grade}`}>{stat.grade}학년</Link></td>
                                        <td><b className={t.strong}>{stat.studentCount}</b><span className={t.u}>명</span></td>
                                        <td><b className={t.strong}>{stat.totalTickets}</b><span className={t.u}>장</span></td>
                                        <td>
                                            {stat.studentCount ? (stat.totalTickets / stat.studentCount).toFixed(1) : "–"}
                                            <span className={t.u}>장</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>합계</td>
                                    <td><b className={t.strong}>{studentTotal}</b><span className={t.u}>명</span></td>
                                    <td><b className={t.strong}>{ticketTotal}</b><span className={t.u}>장</span></td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </section>
                </div>
            </div>

            {drawPool && <RandomDrawDialog initialPool={drawPool} onClose={() => setDrawPool(null)} />}
        </TeacherShell>
    );
}
