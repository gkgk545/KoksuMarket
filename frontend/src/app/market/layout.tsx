"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ReceiptText, ShoppingCart } from "lucide-react";
import { Student, api } from "@/lib/api";
import { CartProvider, useCart } from "@/context/CartContext";
import { CartDrawer, CartPanel } from "@/components/CartDrawer";
import { CartBar } from "@/components/CartBar";
import { Dialog } from "@/components/Dialog";
import { ClosedNotice } from "@/components/ClosedNotice";
import { useMarketStatus } from "@/lib/marketStatus";
import { cn } from "@/lib/utils";
import kit from "@/components/kit.module.css";
import styles from "./market.module.css";

const TABS = [
    { href: "/market", label: "상품 목록" },
    { href: "/market/funding", label: "공동 펀딩" },
    { href: "/ranking", label: "마켓 랭킹" },
];

// Keep in step with the 1100px media query in market.module.css (.wide, .withPanel).
const PANEL_QUERY = "(min-width: 1100px)";

function useMediaQuery(query: string) {
    const subscribe = useCallback((onChange: () => void) => {
        const media = window.matchMedia(query);
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, [query]);
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

function useCurrentPath() {
    return usePathname().replace(/\/$/, "") || "/";
}

interface MarketHeaderProps {
    user: Student;
    wide: boolean;
    onLogout: () => void;
    onOpenCart: () => void;
}

function MarketHeader({ user, wide, onLogout, onOpenCart }: MarketHeaderProps) {
    const { itemCount, totalCost } = useCart();
    const [askLogout, setAskLogout] = useState(false);

    // Logging out with things still in the cart is the usual way a purchase gets forgotten.
    const handleLogoutClick = () => {
        if (itemCount > 0) setAskLogout(true);
        else onLogout();
    };
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
                <div className={cn(styles.wrap, wide && styles.wide, styles.topIn)}>
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
                            onClick={onOpenCart}
                            aria-label={`장바구니 열기, ${itemCount}개 담김`}
                        >
                            <ShoppingCart className={styles.icon} aria-hidden="true" />
                            <span className={styles.label}>장바구니</span>
                            <span ref={countRef} className={cn(styles.count, itemCount === 0 && styles.countZero)}>{itemCount}</span>
                        </button>
                        <button type="button" className={styles.hbtn} onClick={handleLogoutClick} aria-label="로그아웃">
                            <LogOut className={styles.icon} aria-hidden="true" />
                            <span className={styles.label}>로그아웃</span>
                        </button>
                    </div>
                </div>
            </header>
            {askLogout && (
                <Dialog
                    title={`장바구니에 ${itemCount}개가 남아 있어요`}
                    onClose={() => setAskLogout(false)}
                    footer={
                        <>
                            <button type="button" className={cn(kit.btn, kit.ghost)} onClick={onLogout}>
                                사지 않고 나가기
                            </button>
                            <button
                                type="button"
                                className={kit.btn}
                                data-autofocus
                                onClick={() => {
                                    setAskLogout(false);
                                    onOpenCart();
                                }}
                            >
                                장바구니 보기
                            </button>
                        </>
                    }
                >
                    <p className={kit.message}>
                        아직 구매하지 않았어요. 티켓 {totalCost}장어치 물건이 담겨 있어요.
                        담아 둔 물건은 다음에 들어와도 남아 있지만, 그사이 다른 친구가 먼저 사면 살 수 없어요.
                    </p>
                </Dialog>
            )}
        </>
    );
}

function MarketTabs() {
    const pathname = useCurrentPath();
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

interface MarketShellProps {
    user: Student;
    onLogout: () => void;
    onRefresh: () => void;
    children: React.ReactNode;
}

// Where the cart shows: a side panel beside the shelf on wide screens,
// otherwise a bottom bar (while something is in it) that opens the drawer.
function MarketShell({ user, onLogout, onRefresh, children }: MarketShellProps) {
    const { itemCount } = useCart();
    const isWide = useMediaQuery(PANEL_QUERY);
    const path = useCurrentPath();
    const showPanel = isWide && path === "/market";
    const [isCartOpen, setIsCartOpen] = useState(false);
    const panelRef = useRef<HTMLElement>(null);
    const showBar = !showPanel && itemCount > 0;

    const openCart = () => {
        const panel = panelRef.current;
        if (!showPanel || !panel) {
            setIsCartOpen(true);
            return;
        }
        // The panel is already on screen: point at it instead of opening a second cart.
        panel.focus();
        panel.classList.remove(styles.panelFlash);
        void panel.offsetWidth;
        panel.classList.add(styles.panelFlash);
    };

    return (
        <>
            <MarketHeader user={user} wide={showPanel} onLogout={onLogout} onOpenCart={openCart} />
            <main className={cn(styles.wrap, showPanel && styles.wide, showPanel && styles.withPanel, showBar && styles.hasBar)}>
                <MarketTabs />
                <div className={styles.content}>{children}</div>
                {showPanel && <CartPanel ref={panelRef} currentUser={user} onPurchaseComplete={onRefresh} />}
            </main>
            {showBar && !isCartOpen && <CartBar onOpen={openCart} />}
            <CartDrawer
                isOpen={isCartOpen && !showPanel}
                onClose={() => setIsCartOpen(false)}
                currentUser={user}
                onPurchaseComplete={onRefresh}
            />
        </>
    );
}

// Re-fetches the student saved at login so the balance is current, and syncs localStorage.
// Returns null when no one is logged in or the check fails.
async function fetchFreshUser(): Promise<Student | null> {
    const stored = localStorage.getItem("user");
    if (!stored) return null;
    try {
        const parsed = JSON.parse(stored) as Student;
        const data = await api.getStudentDetail(parsed.id);
        localStorage.setItem("user", JSON.stringify(data.student));
        window.dispatchEvent(new Event("auth_refreshed"));
        return data.student;
    } catch (e) {
        console.error("Auth verify failed", e);
        return null;
    }
}

export default function MarketLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [user, setUser] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);
    const marketStatus = useMarketStatus({ watch: true });
    const path = useCurrentPath();

    // After a purchase: fetch the fresh balance and show it.
    const refreshUser = useCallback(() => {
        fetchFreshUser().then((student) => {
            if (student) setUser(student);
        });
    }, []);

    useEffect(() => {
        if (!localStorage.getItem("user")) {
            router.push("/");
            return;
        }
        let cancelled = false;
        fetchFreshUser().then((student) => {
            if (cancelled) return;
            setUser(student);
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("user");
        router.push("/");
    };

    if (loading || !marketStatus) {
        return <div className={styles.loadingPage}>가게 문을 여는 중…</div>;
    }

    // 임시 휴업: 상품·펀딩·구매 기록 화면 대신 안내 (예전 /market/ranking 주소는 랭킹으로 보내 줘요)
    if (marketStatus.is_closed && path !== "/market/ranking") {
        return <ClosedNotice status={marketStatus} onLogout={handleLogout} />;
    }

    if (!user) return null;

    return (
        <CartProvider studentId={user.id} balance={user.ticket_count}>
            <MarketShell user={user} onLogout={handleLogout} onRefresh={refreshUser}>
                {children}
            </MarketShell>
        </CartProvider>
    );
}
