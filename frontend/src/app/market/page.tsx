"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, Funding, Item, Student, isFundingForGrade } from "@/lib/api";
import { ProductCard } from "@/components/ProductCard";
import { FundingStrip } from "@/components/FundingStrip";
import styles from "./market.module.css";

function FundingTeaser({ funding, now }: { funding: Funding; now: number }) {
    const deadline = funding.deadline ? new Date(funding.deadline) : null;
    const daysLeft = deadline ? Math.ceil((deadline.getTime() - now) / 86_400_000) : null;

    return (
        <section className={styles.fund} aria-labelledby="fund-title">
            <div>
                <h2 id="fund-title"><span>공동 펀딩</span>{funding.title}</h2>
                <p>
                    {deadline
                        ? `${deadline.getMonth() + 1}월 ${deadline.getDate()}일까지${daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft}일 남음` : ""}`
                        : "다 모이면 함께 사요"}
                    {funding.current_amount < funding.target_amount && ` · ${funding.target_amount - funding.current_amount}장 더 모으면 완성`}
                </p>
            </div>
            <Link className={`${styles.btn} ${styles.ghost}`} href="/market/funding">펀딩 보러 가기</Link>
            <div className={styles.strip}>
                <FundingStrip current={funding.current_amount} target={funding.target_amount} />
            </div>
        </section>
    );
}

export default function MarketPage() {
    const [items, setItems] = useState<Item[]>([]);
    const [fundings, setFundings] = useState<{ list: Funding[]; loadedAt: number } | null>(null);
    const [user, setUser] = useState<Student | null>(null);
    const [loading, setLoading] = useState(true);

    const loadItems = () => {
        api.getItems()
            .then(setItems)
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        const loadUserFromStorage = () => {
            const stored = localStorage.getItem("user");
            if (stored) setUser(JSON.parse(stored));
        };

        loadUserFromStorage();
        loadItems();
        api.getFundings()
            .then((list) => setFundings({ list, loadedAt: Date.now() }))
            .catch((e) => console.error("Failed to load fundings", e));

        window.addEventListener("purchase_complete", loadItems);
        window.addEventListener("auth_refreshed", loadUserFromStorage);
        return () => {
            window.removeEventListener("purchase_complete", loadItems);
            window.removeEventListener("auth_refreshed", loadUserFromStorage);
        };
    }, []);

    const balance = user?.ticket_count ?? 0;
    // 내 학년(또는 전체 학년) 펀딩 중 아직 모으는 것 하나만 보여 줘요.
    const openFunding = user ? fundings?.list.find((f) => !f.is_completed && isFundingForGrade(f, user.grade)) : undefined;
    const affordable = items.filter((i) => i.quantity > 0 && balance >= i.cost).length;

    return (
        <>
            {openFunding && fundings && <FundingTeaser funding={openFunding} now={fundings.loadedAt} />}

            <div className={styles.shelfHead}>
                <h1>판매 중인 물건</h1>
                {!loading && items.length > 0 && (
                    <p>{items.length}가지 중 지금 {affordable}가지를 살 수 있어요</p>
                )}
            </div>

            {loading ? (
                <p className={styles.emptyShelf}>물건을 진열하는 중…</p>
            ) : items.length === 0 ? (
                <div className={styles.emptyShelf}>
                    <b>아직 진열된 물건이 없어요</b>
                    <p>선생님이 물건을 올리면 여기에 나타나요.</p>
                </div>
            ) : (
                <div className={styles.grid}>
                    {items.map((item) => (
                        <ProductCard key={item.id} item={item} balance={balance} />
                    ))}
                </div>
            )}
        </>
    );
}
