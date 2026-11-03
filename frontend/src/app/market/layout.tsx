"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ReceiptText, ShoppingCart } from "lucide-react";
import { Student, api } from "@/lib/api";
import { CartProvider, useCart } from "@/context/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { cn } from "@/lib/utils";
import styles from "./market.module.css";

const TABS = [
    { href: "/market", label: "상품 목록" },
    { href: "/market/funding", label: "공동 펀딩" },
    { href: "/ranking", label: "마켓 랭킹" },
];

function MarketHeader({ user, onLogout, onRefresh }: { user: Student, onLogout: () => void, onRefresh: () => void }) {
    const { itemCount } = useCart();
    const [isCartOpen, setIsCartOpen] = useState(false);
    const countRef = useRef<HTMLSpanElement>(null);
    const prevCount = useRef(itemCount);

    // Little bump on the cart count whenever something is added or removed
    useEffect(() => {
        const el = countRef.current;
        if (el && prevCount.current !== itemCount) {
            el.classList.remove(styles.bump);
            void el.offsetWidth;
            el.classList.add(styles.bump);
        }
        prevCount.current = itemCount;
    }, [itemCount]);

    return (
        <>
            <header className={styles.top}>
                <div className={cn(styles.wrap, styles.topIn)}>
                    <Link href="/market" className={styles.logo}>곡수마켓</Link>
                    <p className={styles.me}><span>{user.grade}학년</span>{user.name}</p>
                    <div className={styles.purse} aria-label={`보유 티켓 ${user.ticket_count}장`}>
                        <small>보유 티켓</small>
                        <b>{user.ticket_count}</b>
                        <span>장</span>
                    </div>
                    <div className={styles.acts}>
                        <Link href="/market/history" className={styles.hbtn} aria-label="구매 기록">
                            <ReceiptText className={styles.icon} aria-hidden="true" />
                            <span className={styles.label}>구매 기록</span>
                        </Link>
                        <button
                            type="button"
                            className={cn(styles.hbtn, styles.cartBtn)}
                            onClick={() => setIsCartOpen(true)}
                            aria-label={`장바구니 열기, ${itemCount}개 담김`}
                        >
                            <ShoppingCart className={styles.icon} aria-hidden="true" />
                            <span className={styles.label}>장바구니</span>
                            <span ref={countRef} className={cn(styles.count, itemCount === 0 && styles.countZero)}>{itemCount}</span>
                        </button>
                        <button type="button" className={styles.hbtn} onClick={onLogout} aria-label="로그아웃">
                            <LogOut className={styles.icon} aria-hidden="true" />
                            <span className={styles.label}>로그아웃</span>
                        </button>
                    </div>
                </div>
            </header>
            <CartDrawer
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                currentUser={user}
                onPurchaseComplete={onRefresh}
            />
        </>
    );
}

function MarketTabs() {
    const pathname = usePathname().replace(/\/$/, "") || "/";
    return (
        <nav className={styles.tabs} aria-label="마켓 메뉴">
            {TABS.map((tab) => (
                <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>
                    {tab.label}
                </Link>
            ))}
        </nav>
    );
}

export default function MarketLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshUser = async () => {
        const stored = localStorage.getItem("user");
        if (stored) {
            const parsed = JSON.parse(stored);
            // Re-fetch to get fresh balance
            try {
                const data = await api.getStudentDetail(parsed.id);
                setUser(data.student);
                localStorage.setItem("user", JSON.stringify(data.student)); // Sync local storage
                window.dispatchEvent(new Event("auth_refreshed"));
            } catch (e) {
                console.error("Auth verify failed", e);
            }
        }
    };

    useEffect(() => {
        const stored = localStorage.getItem("user");
        if (!stored) {
            router.push("/");
        } else {
            refreshUser().finally(() => setLoading(false));
        }
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("user");
        router.push("/");
    };

    if (loading) {
        return <div className={styles.loadingPage}>가게 문을 여는 중…</div>;
    }

    if (!user) return null;

    return (
        <CartProvider>
            <MarketHeader user={user} onLogout={handleLogout} onRefresh={refreshUser} />
            <main className={styles.wrap}>
                <MarketTabs />
                <div className={styles.content}>{children}</div>
            </main>
        </CartProvider>
    );
}
