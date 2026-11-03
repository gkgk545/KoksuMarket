"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import { login, isAuthenticated } from "@/lib/teacherAuth";
import styles from "../login.module.css";

export default function TeacherLoginPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Auto-redirect if already authenticated
        if (isAuthenticated()) {
            router.push("/teacher/dashboard");
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password) return;
        setLoading(true);
        setError("");

        const success = await login(password, rememberMe);
        if (success) {
            router.push("/teacher/dashboard");
        } else {
            setError("비밀번호가 맞지 않아요. 다시 입력해 주세요.");
        }
        setLoading(false);
    };

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
                        <form className={styles.panel} onSubmit={handleLogin} noValidate>
                            <div className={styles.stepHead}>
                                <h1>교사 비밀번호를 넣어요</h1>
                            </div>
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
                            {error && (
                                <p className={styles.err} id="teacher-err" role="alert">
                                    <CircleAlert aria-hidden="true" />
                                    {error}
                                </p>
                            )}
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
                    </section>
                </div>
            </main>

            <nav className={styles.links} aria-label="다른 페이지">
                <Link href="/">
                    <ChevronLeft aria-hidden="true" /> 학생 페이지로
                </Link>
            </nav>
        </div>
    );
}
