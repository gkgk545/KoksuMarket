"use client";

import { Item } from "@/lib/api";
import { motion } from "framer-motion";
import { ShoppingCart, AlertCircle } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { cn } from "@/lib/utils";

interface ProductCardProps {
    item: Item;
    canBuy: boolean; // Based on balance (passed from parent)
}

export function ProductCard({ item, canBuy }: ProductCardProps) {
    const { addItem } = useCart();

    const isSoldOut = item.quantity <= 0;
    const isLowStock = !isSoldOut && item.quantity <= 3;

    // Disable buying if sold out or if user can't afford (original logic) 
    // BUT we should split the reason for button text.
    const isDisabled = isSoldOut || !canBuy;

    return (
        <motion.div
            whileHover={{ y: -5 }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-lg border border-gray-100 dark:border-slate-700 flex flex-col h-full group relative"
        >
            <div className="relative aspect-square bg-gray-100 dark:bg-slate-700 overflow-hidden">
                {item.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={item.image_url}
                        alt={item.name}
                        className={cn(
                            "w-full h-full object-cover transition-transform duration-500 group-hover:scale-110",
                            isSoldOut && "grayscale opacity-50"
                        )}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                        No Image
                    </div>
                )}

                {/* Price Badge */}
                <div className="absolute top-2 right-2 bg-black/50 backdrop-blur-md text-white text-xs px-2 py-1 rounded-full z-10">
                    {item.cost} Tickets
                </div>

                {/* Status Badges */}
                {isSoldOut && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
                        <span className="text-white font-bold text-xl border-2 border-white px-4 py-2 transform -rotate-12 bg-red-500/80 backdrop-blur-sm rounded-lg">
                            품절
                        </span>
                    </div>
                )}

                {isLowStock && (
                    <div className="absolute bottom-2 left-2 bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-10 animate-pulse">
                        <AlertCircle className="w-3 h-3" />
                        품절 임박 ({item.quantity}개 남음)
                    </div>
                )}
            </div>

            <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">{item.name}</h3>
                {item.link && (
                    <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline mb-2 block">
                        자세히 보기
                    </a>
                )}

                <div className="mt-auto pt-4">
                    <button
                        onClick={() => addItem(item)}
                        disabled={isDisabled}
                        className={cn(
                            "w-full py-2 rounded-xl flex items-center justify-center gap-2 font-semibold transition-all active:scale-95",
                            isSoldOut
                                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                                : !canBuy
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-purple-600 text-white hover:bg-purple-700 shadow-purple-500/20 shadow-lg"
                        )}
                    >
                        <ShoppingCart className="w-4 h-4" />
                        {isSoldOut ? "품절" : (!canBuy ? "티켓 부족" : "담기")}
                    </button>
                    {!isSoldOut && (
                        <p className="text-center text-xs text-gray-400 mt-2">
                            재고: {item.quantity}개
                        </p>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
