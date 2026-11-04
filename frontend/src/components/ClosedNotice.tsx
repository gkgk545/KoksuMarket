"use client";

import { ChevronRight, LogOut, Trophy } from "lucide-react";
import { MarketStatus, reopenCountdown, reopenDateLabel, reopenTimeLabel } from "@/lib/marketStatus";
import { cn } from "@/lib/utils";
import login from "@/app/login.module.css";
import styles from "./closed.module.css";

interface ClosedNoticeProps {
    status: MarketStatus;
    // 학생이 로그인한 채로 닫힌 경우: 같은 기기를 다음 친구가 쓰도록 로그아웃 버튼을 보여 줘요.
    onLogout?: () => void;
}

// 학생 마켓 임시 휴업 안내. 로그인 화면과 같은 입장권 모양에, 노란 쪽에는 다시 여는 날을 적어 둬요.
export function ClosedNotice({ status, onLogout }: ClosedNoticeProps) {
    const date = status.reopen_date;
    const time = date ? status.reopen_time : null;
    const countdown = date ? reopenCountdown(date) : null;
    const overdue = !!date && countdown === null; // 날짜가 지났는데 아직 닫혀 있음

    const stubFields = [
        { label: "여는 날", value: date && !overdue ? reopenDateLabel(date, { short: true }) : null, empty: overdue ? "곧 열려요" : "정하는 중" },
        { label: "여는 시간", value: time && !overdue ? reopenTimeLabel(time) : null, empty: date && !overdue ? "그날 중" : "–" },
    ];

    return (
        <div className={login.page}>
            <main className={login.wrap}>
                <div className={login.ticket}>
                    <aside className={login.stub} aria-label="휴업 안내">
                        <p className={login.brand}>
                            곡수마켓<small>우리 학교 티켓 가게</small>
                        </p>
                        <p className={login.serial}>휴업 안내 · {new Date().getFullYear()}</p>
                        <dl className={cn(login.fields, styles.stubFields)}>
                            {stubFields.map((f) => (
                                <div key={f.label} className={cn(login.field, styles.stubField)}>
                                    <dt className={login.fieldKey}>{f.label}</dt>
                                    <dd className={f.value ? login.fieldValue : login.fieldEmpty}>{f.value ?? f.empty}</dd>
                                </div>
                            ))}
                        </dl>
                    </aside>

                    <section className={cn(login.body, styles.body)}>
                        <span className={styles.stamp} aria-hidden="true">임시 휴업</span>
                        <h1 className={styles.title}>마켓이 잠시 쉬어요</h1>
                        <p className={styles.lede}>
                            더 좋은 가게로 꾸미는 중이에요.
                            <br />
                            그동안은 물건을 사거나 펀딩에 참여할 수 없어요.
                        </p>

                        <div className={styles.reopen} role="status">
                            <span className={styles.reopenKey}>다시 여는 날</span>
                            {date && !overdue ? (
                                <>
                                    <p className={styles.reopenWhen}>
                                        <b>{reopenDateLabel(date)}</b>
                                        {time && <span>{reopenTimeLabel(time)}</span>}
                                    </p>
                                    <span className={styles.countdown}>{countdown}</span>
                                </>
                            ) : (
                                <p className={styles.reopenSoon}>
                                    <b>{overdue ? "곧 다시 열어요" : "아직 정하는 중이에요"}</b>
                                    <span>{overdue ? "준비가 조금 더 걸리고 있어요." : "정해지면 선생님이 알려 줄게요."}</span>
                                </p>
                            )}
                        </div>

                        {status.message && (
                            <figure className={styles.memo}>
                                <figcaption>선생님 한마디</figcaption>
                                <blockquote>{status.message}</blockquote>
                            </figure>
                        )}

                        <div className={styles.spacer} />
                        <a href="/ranking" className={cn(login.go, styles.go)}>
                            <Trophy aria-hidden="true" />
                            마켓 랭킹은 볼 수 있어요
                            <ChevronRight aria-hidden="true" />
                        </a>
                    </section>
                </div>
            </main>

            <nav className={login.links} aria-label="다른 페이지">
                {onLogout && (
                    <button type="button" onClick={onLogout}>
                        <LogOut aria-hidden="true" />
                        로그아웃
                    </button>
                )}
                <a href="/teacher">
                    교사 페이지 <ChevronRight aria-hidden="true" />
                </a>
            </nav>
        </div>
    );
}
