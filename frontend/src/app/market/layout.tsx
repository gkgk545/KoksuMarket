"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Student } from "@/lib/api";
import { CartProvider, useCart } from "@/context/CartContext";
import { ShoppingCart, LogOut, Loader2, User as UserIcon } from "lucide-react";
import { motion } from "framer-motion";
import { CartDrawer } from "@/components/CartDrawer";
import { api } from "@/lib/api";

function MarketHeader({ user, onLogout, onRefresh }: { user: Student, onLogout: () => void, onRefresh: () => void }) {
    const { itemCount } = useCart();
    const [isCartOpen, setIsCartOpen] = useState(false);

    return (
        <>
            <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/" className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-80 transition-opacity">
                        곡수마켓
                    </Link>
                    <nav className="hidden md:flex gap-4 text-sm font-medium text-gray-500">
                        {/* Links moved to login page */}
                    </nav>
                </div>

                <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-100 dark:bg-slate-800 rounded-full mr-2">
                        <UserIcon className="w-4 h-4 text-gray-500" />
                        <span className="font-semibold text-sm">{user.grade}학년 {user.name}</span>
                        <div className="w-px h-4 bg-gray-300 mx-2" />
                        <span className="font-bold text-purple-600">{user.ticket_count} Tickets</span>
                    </div>

                    <div className="md:hidden font-bold text-purple-600 bg-purple-50 px-3 py-1 rounded-full text-sm mr-2">
                        {user.ticket_count} T
                    </div>

                    <Link
                        href="/market/history"
                        className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 rounded-full transition-colors relative group"
                        title="구매 기록"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-700 dark:text-gray-300">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <span className="absolute hidden group-hover:block top-full mt-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            구매 기록
                        </span>
                    </Link>

                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="relative p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 rounded-full transition-colors"
                        title="장바구니"
                    >
                        <ShoppingCart className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                        {itemCount > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-bounce">
                                {itemCount}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={onLogout}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-5 h-5" />
                    </button>
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
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <CartProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-gray-100">
                <MarketHeader user={user} onLogout={handleLogout} onRefresh={refreshUser} />
                <main className="container mx-auto p-4 md:p-8 animate-fade-in-up">
                    {children}
                </main>
            </div>
        </CartProvider>
    );
}
