"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase, Item } from "@/lib/supabase";
import { isAuthenticated, parseCSV, generateCSV, downloadCSV } from "@/lib/teacherAuth";
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, Loader2, Upload, Download } from "lucide-react";
import { motion } from "framer-motion";

export default function ItemsPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<Item[]>([]);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newItem, setNewItem] = useState({
        name: "",
        cost: 1,
        quantity: 10,
        link: "",
        image_url: "",
    });

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/teacher");
            return;
        }
        loadItems();
    }, [router]);

    const loadItems = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("market_item")
            .select("*")
            .order("name");

        if (error) {
            console.error("Failed to load items:", error);
        } else {
            setItems(data || []);
        }
        setLoading(false);
    };

    const addItem = async () => {
        if (!newItem.name.trim()) {
            alert("상품명을 입력해주세요.");
            return;
        }

        const { error } = await supabase.from("market_item").insert({
            name: newItem.name.trim(),
            cost: newItem.cost,
            quantity: newItem.quantity,
            link: newItem.link || null,
            image_url: newItem.image_url || null,
        });

        if (error) {
            alert("상품 추가 실패: " + error.message);
        } else {
            setShowAddModal(false);
            setNewItem({ name: "", cost: 1, quantity: 10, link: "", image_url: "" });
            loadItems();
        }
    };

    const updateItem = async () => {
        if (!editingItem) return;

        const { error } = await supabase
            .from("market_item")
            .update({
                name: editingItem.name,
                cost: editingItem.cost,
                quantity: editingItem.quantity,
                link: editingItem.link,
                image_url: editingItem.image_url,
            })
            .eq("id", editingItem.id);

        if (error) {
            alert("상품 수정 실패: " + error.message);
        } else {
            setEditingItem(null);
            loadItems();
        }
    };

    const deleteItem = async (itemId: number, itemName: string) => {
        if (!confirm(`정말 "${itemName}" 상품을 삭제하시겠습니까?`)) return;

        const { error } = await supabase.from("market_item").delete().eq("id", itemId);

        if (error) {
            alert("삭제 실패: " + error.message);
        } else {
            loadItems();
        }
    };

    // CSV Upload
    const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const text = await file.text();
        const rows = parseCSV(text);

        const startIndex = rows[0]?.[0]?.toLowerCase().includes('상품') ? 1 : 0;

        const itemsToAdd = rows.slice(startIndex).filter(row => row[0]?.trim()).map(row => ({
            name: row[0]?.trim() || "",
            cost: parseInt(row[1]) || 1,
            quantity: parseInt(row[2]) || 10,
            image_url: row[3]?.trim() || null,
        }));

        if (itemsToAdd.length === 0) {
            alert("추가할 상품이 없습니다. CSV 형식을 확인해주세요.\n형식: 상품명,가격,재고,이미지URL");
            return;
        }

        const { error } = await supabase.from("market_item").insert(itemsToAdd);

        if (error) {
            alert("업로드 실패: " + error.message);
        } else {
            alert(`${itemsToAdd.length}개의 상품이 추가되었습니다.`);
            loadItems();
        }

        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // CSV Export
    const handleExport = () => {
        const headers = ["상품명", "가격", "재고", "이미지URL"];
        const rows = items.map(i => [i.name, i.cost.toString(), i.quantity.toString(), i.image_url || ""]);
        const csv = generateCSV(headers, rows);
        downloadCSV("상품목록.csv", csv);
    };

    // CSV Template Download
    const handleDownloadTemplate = () => {
        const headers = ["상품명", "가격", "재고", "이미지URL"];
        const exampleRows = [
            ["연필", "1", "50", ""],
            ["지우개", "2", "30", "https://example.com/eraser.jpg"],
        ];
        const csv = generateCSV(headers, exampleRows);
        downloadCSV("상품_업로드_양식.csv", csv);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hidden file input */}
            <input
                type="file"
                ref={fileInputRef}
                accept=".csv"
                onChange={handleCSVUpload}
                className="hidden"
            />

            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center gap-4">
                            <Link
                                href="/teacher/dashboard"
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <h1 className="text-2xl font-bold text-indigo-600">상품 관리</h1>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
                            >
                                <Upload className="w-4 h-4" />
                                <span>CSV 업로드</span>
                            </button>
                            <button
                                onClick={handleDownloadTemplate}
                                className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                                <Download className="w-4 h-4" />
                                <span>양식 다운로드</span>
                            </button>
                            <button
                                onClick={handleExport}
                                disabled={items.length === 0}
                                className="flex items-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                <span>내보내기</span>
                            </button>
                            <button
                                onClick={() => setShowAddModal(true)}
                                className="flex items-center gap-2 bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                <span>상품 추가</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {items.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        등록된 상품이 없습니다.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {items.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="bg-white rounded-xl shadow-sm p-4 border"
                            >
                                {item.image_url && (
                                    <img
                                        src={item.image_url}
                                        alt={item.name}
                                        className="w-full h-32 object-cover rounded-lg mb-4"
                                    />
                                )}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg">{item.name}</h3>
                                        <p className="text-purple-600 font-semibold">{item.cost}장</p>
                                        <p className={`text-sm ${item.quantity > 0 ? "text-gray-500" : "text-red-500 font-bold"}`}>
                                            재고: {item.quantity}개 {item.quantity === 0 && "(품절)"}
                                        </p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setEditingItem(item)}
                                            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                        >
                                            <Edit2 className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => deleteItem(item.id, item.name)}
                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </main>

            {/* Add/Edit Modal */}
            {(showAddModal || editingItem) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white rounded-xl p-6 w-full max-w-md mx-4"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">
                                {editingItem ? "상품 수정" : "상품 추가"}
                            </h2>
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingItem(null);
                                }}
                                className="p-1 hover:bg-gray-100 rounded"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">상품명</label>
                                <input
                                    type="text"
                                    value={editingItem ? editingItem.name : newItem.name}
                                    onChange={(e) =>
                                        editingItem
                                            ? setEditingItem({ ...editingItem, name: e.target.value })
                                            : setNewItem({ ...newItem, name: e.target.value })
                                    }
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="상품 이름"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">가격 (티켓)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={editingItem ? editingItem.cost : newItem.cost}
                                        onChange={(e) =>
                                            editingItem
                                                ? setEditingItem({ ...editingItem, cost: Number(e.target.value) })
                                                : setNewItem({ ...newItem, cost: Number(e.target.value) })
                                        }
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">재고</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingItem ? editingItem.quantity : newItem.quantity}
                                        onChange={(e) =>
                                            editingItem
                                                ? setEditingItem({ ...editingItem, quantity: Number(e.target.value) })
                                                : setNewItem({ ...newItem, quantity: Number(e.target.value) })
                                        }
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">이미지 URL (선택)</label>
                                <input
                                    type="text"
                                    value={editingItem ? editingItem.image_url || "" : newItem.image_url}
                                    onChange={(e) =>
                                        editingItem
                                            ? setEditingItem({ ...editingItem, image_url: e.target.value })
                                            : setNewItem({ ...newItem, image_url: e.target.value })
                                    }
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowAddModal(false);
                                    setEditingItem(null);
                                }}
                                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={editingItem ? updateItem : addItem}
                                className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                            >
                                <Save className="w-4 h-4" />
                                {editingItem ? "수정" : "추가"}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
