"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/teacherAuth";
import { cn } from "@/lib/utils";
import styles from "@/app/teacher/teacher.module.css";

const SECTIONS = [
    { href: "/teacher/dashboard", match: "/teacher/dashboard", label: "대시보드" },
    { href: "/teacher/purchases", match: "/teacher/purchases", label: "구매 내역" },
    { href: "/teacher/items", match: "/teacher/items", label: "상품" },
    { href: "/teacher/students/3", match: "/teacher/students", label: "학생·티켓" },
    { href: "/teacher/funding", match: "/teacher/funding", label: "공동 펀딩" },
];

const DAY = "일월화수목금토";

function todayLabel() {
    const d = new Date();
    return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAY[d.getDay()]})`;
}

interface TeacherShellProps {
    children: React.ReactNode;
    pendingCount?: number; // shown as a badge on the 구매 내역 tab
}

// Header and section tabs shared by every teacher page.
export function TeacherShell({ children, pendingCount }: TeacherShellProps) {
    const router = useRouter();
    const pathname = usePathname();

    const handleLogout = () => {
        logout();
        router.push("/teacher");
    };

    return (
        <>
            <header className={styles.top}>
                <div className={cn(styles.wrap, styles.topIn)}>
                    <Link href="/teacher/dashboard" className={styles.logo}>곡수마켓</Link>
                    <span className={styles.role}>교사</span>
                    <span className={styles.date}>{todayLabel()}</span>
                    <button type="button" className={styles.hbtn} onClick={handleLogout}>
                        <LogOut className={styles.icon} aria-hidden="true" />
                        로그아웃
                    </button>
                </div>
            </header>
            <div className={styles.wrap}>
                <nav className={styles.tabs} aria-label="교사 메뉴">
                    {SECTIONS.map((s) => (
                        <Link key={s.href} href={s.href} aria-current={pathname.startsWith(s.match) ? "page" : undefined}>
                            {s.label}
                            {s.match === "/teacher/purchases" && !!pendingCount && (
                                <span className={styles.tabBadge} aria-label={`전달 대기 ${pendingCount}건`}>{pendingCount}</span>
                            )}
                        </Link>
                    ))}
                </nav>
                <main className={styles.main}>{children}</main>
            </div>
        </>
    );
}
