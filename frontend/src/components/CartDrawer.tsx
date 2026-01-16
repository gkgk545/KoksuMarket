"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/context/CartContext";
import { X, Trash2, CreditCard, Loader2 } from "lucide-react";
import { api, Student } from "@/lib/api";
import { cn } from "@/lib/utils";

import { ConfirmationModal } from "./ConfirmationModal";

interface CartDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: Student | null;
    onPurchaseComplete: () => void;
}

export function CartDrawer({ isOpen, onClose, currentUser, onPurchaseComplete }: CartDrawerProps) {
    const { items, removeItem, totalCost, clearCart } = useCart();
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

    const handleCheckout = async () => {
        if (!currentUser) return;
        if (currentUser.ticket_count < totalCost) {
            setMsg({ type: 'error', text: '티켓이 부족합니다!' });
            return;
        }

        setLoading(true);
        setMsg(null);
        setIsConfirmOpen(false); // Close the confirmation modal

        try {
            // Since backend doesn't support bulk, we loop. 
            // In production, this should be a single transaction API.
            for (const item of items) {
                for (let i = 0; i < item.quantity; i++) {
                    await api.purchaseItem(currentUser.id, item.id);
                }
            }

            setMsg({ type: 'success', text: '구매가 완료되었습니다!' });
            setTimeout(() => {
                clearCart();
                onPurchaseComplete();
                onClose();
                setMsg(null);
            }, 1500);

        } catch (err: any) {
            setMsg({ type: 'error', text: err.message || '구매 중 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleCheckout}
                title="구매 확인"
                description={`총 ${totalCost} 티켓이 차감됩니다. 정말 구매하시겠습니까? 구매 후에는 취소할 수 없습니다.`}
            />
            <AnimatePresence>
                {isOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.5 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black z-40"
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl z-50 flex flex-col"
                        >
                            <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-purple-500" />
                                    장바구니
                                </h2>
                                <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {items.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                        <p>장바구니가 비었습니다.</p>
                                    </div>
                                ) : (
                                    items.map((item) => (
                                        <div key={item.id} className="flex gap-4 items-center bg-gray-50 dark:bg-slate-800 p-3 rounded-xl">
                                            {item.image_url ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                                            ) : (
                                                <div className="w-16 h-16 bg-gray-200 rounded-lg" />
                                            )}
                                            <div className="flex-1">
                                                <h4 className="font-semibold">{item.name}</h4>
                                                <p className="text-sm text-gray-500">{item.cost} Tickets</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="font-bold">x{item.quantity}</span>
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-full"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="p-6 bg-gray-50 dark:bg-slate-800 border-t dark:border-slate-700 space-y-4">
                                <div className="flex justify-between text-lg font-bold">
                                    <span>총 합계</span>
                                    <span className="text-purple-600">{totalCost} Tickets</span>
                                </div>

                                {msg && (
                                    <div className={cn(
                                        "p-3 rounded-lg text-center text-sm font-medium",
                                        msg.type === 'success' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                    )}>
                                        {msg.text}
                                    </div>
                                )}

                                <button
                                    onClick={() => setIsConfirmOpen(true)}
                                    disabled={items.length === 0 || loading}
                                    className="w-full py-4 rounded-xl bg-purple-600 text-white font-bold text-lg shadow-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="animate-spin" /> : "결제하기"}
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
