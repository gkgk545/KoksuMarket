"use client";

import { Disc3 } from "lucide-react";
import { POOLS, useDrawHistory, type PoolId } from "@/lib/randomDraw";
import { cn } from "@/lib/utils";
import t from "@/app/teacher/teacher.module.css";
import styles from "./randomDraw.module.css";

// 교사 대시보드: 랜덤 상품 돌림판을 여는 곳과 남은 번호 수
export function RandomDrawPanel({ onOpen }: { onOpen: (pool: PoolId) => void }) {
    const { drawn, error } = useDrawHistory();

    return (
        <section className={t.panel} aria-labelledby="draw-title">
            <div className={t.pHead}>
                <h2 id="draw-title">랜덤 번호 뽑기</h2>
                <span className={t.sub}>나온 번호는 다시 안 나와요</span>
            </div>
            <div className={styles.panelBody}>
                {error && !drawn && <p className={cn(t.error, styles.panelError)} role="alert">{error}</p>}
                {POOLS.map((p) => {
                    const left = drawn ? p.size - drawn[p.id].length : null;
                    return (
                        <div key={p.id} className={styles.poolRow}>
                            <div>
                                <div className={styles.poolName}>{p.label}</div>
                                <div className={styles.poolLeft}>
                                    {left === null ? `1~${p.size}번` : left === 0 ? "모두 뽑았어요" : `1~${p.size}번 중 ${left}개 남음`}
                                </div>
                            </div>
                            <button type="button" className={cn(t.btn, t.ghost)} onClick={() => onOpen(p.id)}>
                                <Disc3 aria-hidden="true" />
                                돌림판
                            </button>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
