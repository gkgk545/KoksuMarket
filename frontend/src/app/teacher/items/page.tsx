"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase, Item } from "@/lib/supabase";
import { isAuthenticated, parseCSV, generateCSV, downloadCSV } from "@/lib/teacherAuth";
import { Download, FileDown, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { TeacherShell } from "@/components/TeacherShell";
import { Dialog } from "@/components/Dialog";
import { useConfirm, useToast } from "@/components/feedback";
import { cn } from "@/lib/utils";
import t from "../teacher.module.css";
import styles from "./items.module.css";

type ItemForm = { id?: number; name: string; cost: number; quantity: number; link: string; image_url: string };

const EMPTY_FORM: ItemForm = { name: "", cost: 1, quantity: 10, link: "", image_url: "" };

export default function ItemsPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<Item[]>([]);
    const [form, setForm] = useState<ItemForm | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [confirm, confirmDialog] = useConfirm();
    const [toast, toastElement] = useToast();

    const loadItems = async () => {
        const { data, error } = await supabase
            .from("market_item")
            .select("*")
            .order("name");

        if (error) {
            console.error("Failed to load items:", error);
            toast("상품을 불러오지 못했어요. 새로고침해 주세요.", "error");
        } else {
            setItems(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!isAuthenticated()) {
            router.push("/teacher");
            return;
        }
        loadItems();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router]);

    const openAdd = () => {
        setFormError(null);
        setForm({ ...EMPTY_FORM });
    };

    const openEdit = (item: Item) => {
        setFormError(null);
        setForm({
            id: item.id,
            name: item.name,
            cost: item.cost,
            quantity: item.quantity,
            link: item.link ?? "",
            image_url: item.image_url ?? "",
        });
    };

    const saveItem = async () => {
        if (!form) return;
        if (!form.name.trim()) {
            setFormError("상품 이름을 적어 주세요.");
            return;
        }
        if (form.cost < 1 || form.quantity < 0) {
            setFormError("가격은 1장 이상, 재고는 0개 이상이어야 해요.");
            return;
        }

        setSaving(true);
        const payload = {
            name: form.name.trim(),
            cost: form.cost,
            quantity: form.quantity,
            link: form.link.trim() || null,
            image_url: form.image_url.trim() || null,
        };
        const { error } = form.id
            ? await supabase.from("market_item").update(payload).eq("id", form.id)
            : await supabase.from("market_item").insert(payload);
        setSaving(false);

        if (error) {
            setFormError(`저장하지 못했어요: ${error.message}`);
            return;
        }
        toast(form.id ? `‘${payload.name}’을(를) 고쳤어요.` : `‘${payload.name}’을(를) 진열했어요.`);
        setForm(null);
        loadItems();
    };

    const deleteItem = async (item: Item) => {
        const ok = await confirm({
            title: `‘${item.name}’을(를) 지울까요?`,
            message: "학생 상품 목록에서 바로 사라져요. 지운 상품은 되살릴 수 없어요.",
            confirmLabel: "지우기",
            danger: true,
        });
        if (!ok) return;

        const { error } = await supabase.from("market_item").delete().eq("id", item.id);

        if (error) {
            toast(`지우지 못했어요: ${error.message}`, "error");
        } else {
            toast(`‘${item.name}’을(를) 지웠어요.`);
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

        if (fileInputRef.current) fileInputRef.current.value = "";

        if (itemsToAdd.length === 0) {
            toast("추가할 상품이 없어요. 양식(상품명,가격,재고,이미지URL)을 확인해 주세요.", "error");
            return;
        }

        const { error } = await supabase.from("market_item").insert(itemsToAdd);

        if (error) {
            toast(`올리지 못했어요: ${error.message}`, "error");
        } else {
            toast(`상품 ${itemsToAdd.length}가지를 추가했어요.`);
            loadItems();
        }
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

    const soldOut = items.filter((i) => i.quantity <= 0).length;

    return (
        <TeacherShell>
            <input type="file" ref={fileInputRef} accept=".csv" onChange={handleCSVUpload} hidden />

            <div className={t.pageHead}>
                <h1>상품 관리</h1>
                {!loading && <p>{items.length}가지 진열 중{soldOut > 0 && ` · 품절 ${soldOut}가지`}</p>}
                <div className={t.actions}>
                    <button type="button" className={cn(t.btn, t.quiet)} onClick={handleDownloadTemplate}>
                        <FileDown aria-hidden="true" />
                        CSV 양식
                    </button>
                    <button type="button" className={cn(t.btn, t.ghost)} onClick={() => fileInputRef.current?.click()}>
                        <Upload aria-hidden="true" />
                        CSV로 추가
                    </button>
                    <button type="button" className={cn(t.btn, t.ghost)} onClick={handleExport} disabled={items.length === 0}>
                        <Download aria-hidden="true" />
                        내보내기
                    </button>
                    <button type="button" className={t.btn} onClick={openAdd}>
                        <Plus aria-hidden="true" />
                        상품 추가
                    </button>
                </div>
            </div>

            <div className={t.panel}>
                {loading ? (
                    <p className={t.loadingPage}>상품을 불러오는 중…</p>
                ) : items.length === 0 ? (
                    <div className={t.empty}>
                        <b>아직 진열한 상품이 없어요</b>
                        <p>‘상품 추가’로 하나씩 넣거나, CSV 양식으로 한 번에 올릴 수 있어요.</p>
                    </div>
                ) : (
                    <div className={t.scroll}>
                        <table className={t.table}>
                            <thead>
                                <tr>
                                    <th scope="col">상품</th>
                                    <th scope="col" className={t.num}>가격</th>
                                    <th scope="col">재고</th>
                                    <th scope="col" className={t.end}><span className="sr-only">작업</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div className={styles.itemCell}>
                                                <span className={styles.thumb} aria-hidden="true">
                                                    {item.image_url
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        ? <img src={item.image_url} alt="" />
                                                        : item.name.trim().charAt(0)}
                                                </span>
                                                <span>
                                                    <span className={styles.itemName}>{item.name}</span>
                                                    {item.link && (
                                                        <a className={styles.itemLink} href={item.link} target="_blank" rel="noopener noreferrer">
                                                            자세히 보기 링크
                                                        </a>
                                                    )}
                                                </span>
                                            </div>
                                        </td>
                                        <td className={t.num}><span className={t.price}>{item.cost}<small>장</small></span></td>
                                        <td>
                                            <span className={styles.stockCell}>
                                                <span><b className={t.strong}>{item.quantity}</b><span className={t.u}>개</span></span>
                                                {item.quantity <= 0 ? (
                                                    <span className={cn(t.tag, t.tagOut)}>품절</span>
                                                ) : item.quantity <= 3 ? (
                                                    <span className={cn(t.tag, t.tagWarn)}>품절 임박</span>
                                                ) : null}
                                            </span>
                                        </td>
                                        <td className={t.end}>
                                            <span className={styles.rowActions}>
                                                <button type="button" className={cn(t.btn, t.quiet, t.sm)} onClick={() => openEdit(item)}>
                                                    <Pencil aria-hidden="true" />
                                                    고치기
                                                </button>
                                                <button
                                                    type="button"
                                                    className={cn(t.btn, t.quiet, t.sm, t.dangerText)}
                                                    onClick={() => deleteItem(item)}
                                                    aria-label={`${item.name} 지우기`}
                                                >
                                                    <Trash2 aria-hidden="true" />
                                                </button>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {form && (
                <Dialog
                    title={form.id ? "상품 고치기" : "상품 추가"}
                    onClose={() => setForm(null)}
                    footer={
                        <>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={() => setForm(null)}>취소</button>
                            <button type="button" className={t.btn} onClick={saveItem} disabled={saving}>
                                {saving ? "저장하는 중…" : form.id ? "고친 내용 저장" : "진열하기"}
                            </button>
                        </>
                    }
                >
                    <form className={t.form} onSubmit={(e) => { e.preventDefault(); saveItem(); }}>
                        {formError && <p className={t.error} role="alert">{formError}</p>}
                        <div>
                            <label className={t.label} htmlFor="item-name">상품 이름</label>
                            <input
                                id="item-name"
                                className={t.input}
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                placeholder="예: 연필 세트"
                            />
                        </div>
                        <div className={t.row2}>
                            <div>
                                <label className={t.label} htmlFor="item-cost">가격 (티켓)</label>
                                <input
                                    id="item-cost"
                                    className={t.input}
                                    type="number"
                                    inputMode="numeric"
                                    min={1}
                                    value={form.cost}
                                    onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                                />
                            </div>
                            <div>
                                <label className={t.label} htmlFor="item-qty">재고 (개)</label>
                                <input
                                    id="item-qty"
                                    className={t.input}
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    value={form.quantity}
                                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div>
                            <label className={t.label} htmlFor="item-image">사진 주소 (선택)</label>
                            <input
                                id="item-image"
                                className={t.input}
                                value={form.image_url}
                                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                                placeholder="https://"
                            />
                            <p className={t.hint}>비워 두면 상품 이름의 첫 낱말이 색지 위에 크게 찍혀요.</p>
                            {form.image_url.trim() && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img className={styles.preview} src={form.image_url.trim()} alt="사진 미리보기" />
                            )}
                        </div>
                        <div>
                            <label className={t.label} htmlFor="item-link">자세히 보기 링크 (선택)</label>
                            <input
                                id="item-link"
                                className={t.input}
                                value={form.link}
                                onChange={(e) => setForm({ ...form, link: e.target.value })}
                                placeholder="https://"
                            />
                        </div>
                        <button type="submit" hidden />
                    </form>
                </Dialog>
            )}
            {confirmDialog}
            {toastElement}
        </TeacherShell>
    );
}
