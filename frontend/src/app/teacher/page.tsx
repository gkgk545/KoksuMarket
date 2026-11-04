"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CircleAlert, CircleCheck, ChevronLeft, ChevronRight, KeyRound } from "lucide-react";
import { login, isAuthenticated, changePassword } from "@/lib/teacherAuth";
import styles from "../login.module.css";

type Mode = "login" | "change";

const MIN_LENGTH = 4;

export default function TeacherLoginPage() {
    const router = useRouter();
    const [mode, setMode] = useState<Mode>("login");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [loading, setLoading] = useState(false);

    // Password change
    const [current, setCurrent] = useState("");
    const [next, setNext] = useState("");
    const [confirmNext, setConfirmNext] = useState("");

    useEffect(() => {
        // Auto-redirect if already authenticated
        if (isAuthenticated()) {
            router.push("/teacher/dashboard");
        }
    }, [router]);

    const switchMode = (target: Mode) => {
        setMode(target);
        setError("");
        setNotice("");
        setPassword("");
        setCurrent("");
        setNext("");
        setConfirmNext("");
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;
        setLoading(true);
        setError("");
        setNotice("");

        const success = await login(password, rememberMe);
        if (success) {
            router.push("/teacher/dashboard");
        } else {
            setError("비밀번호가 맞지 않아요. 다시 입력해 주세요.");
        }
        setLoading(false);
    };

    const handleChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!current || !next || !confirmNext) return;
        if (next.length < MIN_LENGTH) {
            setError(`새 비밀번호는 ${MIN_LENGTH}자 이상으로 정해 주세요.`);
            return;
        }
        if (next !== confirmNext) {
            setError("새 비밀번호 두 칸이 서로 달라요. 다시 확인해 주세요.");
            return;
        }
        if (next === current) {
            setError("지금 비밀번호와 다른 비밀번호로 정해 주세요.");
            return;
        }

        setLoading(true);
        setError("");
        const result = await changePassword(current, next);
        setLoading(false);

        if (result === "ok") {
            switchMode("login");
            setNotice("비밀번호를 바꿨어요. 새 비밀번호로 로그인해 주세요.");
        } else if (result === "wrong_password") {
            setError("지금 비밀번호가 맞지 않아요.");
        } else if (result === "too_short") {
            setError(`새 비밀번호는 ${MIN_LENGTH}자 이상으로 정해 주세요.`);
        } else {
            setError("지금은 비밀번호를 바꿀 수 없어요. 잠시 뒤 다시 해 주세요.");
        }
    };

    const errorBox = error && (
        <p className={styles.err} id="teacher-err" role="alert">
            <CircleAlert aria-hidden="true" />
            {error}
        </p>
    );

    return (
        <div className={styles.page}>
            <main className={styles.wrap}>
                <div className={styles.ticket}>
                    <aside className={styles.stub} aria-label="교사용 입장권">
                        <p className={styles.brand}>
                            곡수마켓<small>교사 관리 페이지</small>
                        </p>
                        <p className={styles.serial}>교사용 · {new Date().getFullYear()}</p>
                        <p className={styles.stubNote}>
                            학생 티켓, 상품, 구매 전달, 공동 펀딩을 관리해요.
                        </p>
                    </aside>

                    <section className={styles.body}>
                        {mode === "login" ? (
                            <form className={styles.panel} key="login" onSubmit={handleLogin} noValidate>
                                <div className={styles.stepHead}>
                                    <h1>교사 비밀번호를 넣어요</h1>
                                </div>
                                {notice && (
                                    <p className={styles.ok} role="status">
                                        <CircleCheck aria-hidden="true" />
                                        {notice}
                                    </p>
                                )}
                                <label className={styles.label} htmlFor="teacher-pw">교사 비밀번호</label>
                                <input
                                    id="teacher-pw"
                                    className={styles.pw}
                                    type="password"
                                    autoComplete="current-password"
                                    placeholder="비밀번호를 입력하세요"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError("");
                                    }}
                                    aria-invalid={error ? true : undefined}
                                    aria-describedby={error ? "teacher-err" : undefined}
                                    autoFocus
                                />
                                <label className={styles.remember}>
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                    />
                                    이 기기에서 7일 동안 로그인 유지
                                </label>
                                {errorBox}
                                <button type="submit" className={styles.go} disabled={loading || !password}>
                                    {loading ? (
                                        <span className={styles.spin} aria-label="확인 중" />
                                    ) : (
                                        <>
                                            관리 페이지로
                                            <ChevronRight aria-hidden="true" />
                                        </>
                                    )}
                                </button>
                            </form>
                        ) : (
                            <form className={styles.panel} key="change" onSubmit={handleChange} noValidate>
                                <div className={styles.stepHead}>
                                    <button type="button" className={styles.back} onClick={() => switchMode("login")}>
                                        <ChevronLeft aria-hidden="true" />
                                        로그인
                                    </button>
                                    <h1>비밀번호 바꾸기</h1>
                                </div>
                                <label className={styles.label} htmlFor="teacher-pw-current">지금 비밀번호</label>
                                <input
                                    id="teacher-pw-current"
                                    className={styles.pw}
                                    type="password"
                                    autoComplete="current-password"
                                    value={current}
                                    onChange={(e) => {
                                        setCurrent(e.target.value);
                                        setError("");
                                    }}
                                    autoFocus
                                />
                                <label className={`${styles.label} ${styles.nextField}`} htmlFor="teacher-pw-new">새 비밀번호</label>
                                <input
                                    id="teacher-pw-new"
                                    className={styles.pw}
                                    type="password"
                                    autoComplete="new-password"
                                    value={next}
                                    onChange={(e) => {
                                        setNext(e.target.value);
                                        setError("");
                                    }}
                                    aria-describedby="teacher-pw-hint"
                                />
                                <label className={`${styles.label} ${styles.nextField}`} htmlFor="teacher-pw-confirm">새 비밀번호 한 번 더</label>
                                <input
                                    id="teacher-pw-confirm"
                                    className={styles.pw}
                                    type="password"
                                    autoComplete="new-password"
                                    value={confirmNext}
                                    onChange={(e) => {
                                        setConfirmNext(e.target.value);
                                        setError("");
                                    }}
                                    aria-invalid={confirmNext && next !== confirmNext ? true : undefined}
                                />
                                <p className={styles.hint} id="teacher-pw-hint">
                                    {MIN_LENGTH}자 이상. 바꾸면 다른 기기에 로그인된 교사 화면도 모두 로그아웃돼요.
                                </p>
                                {errorBox}
                                <button
                                    type="submit"
                                    className={styles.go}
                                    disabled={loading || !current || !next || !confirmNext}
                                >
                                    {loading ? <span className={styles.spin} aria-label="바꾸는 중" /> : "비밀번호 바꾸기"}
                                </button>
                            </form>
                        )}
                    </section>
                </div>
            </main>

            <nav className={styles.links} aria-label="다른 페이지">
                <Link href="/">
                    <ChevronLeft aria-hidden="true" /> 학생 페이지로
                </Link>
                {mode === "login" && (
                    <button type="button" onClick={() => switchMode("change")}>
                        <KeyRound aria-hidden="true" /> 비밀번호 바꾸기
                    </button>
                )}
            </nav>
        </div>
    );
}
