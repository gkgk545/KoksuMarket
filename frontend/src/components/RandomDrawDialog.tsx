"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import { Dialog } from "@/components/Dialog";
import {
    POOLS,
    drawNumber,
    getPool,
    refreshDraws,
    remainingNumbers,
    resetDraws,
    showDrawn,
    undoLastDraw,
    useDrawHistory,
    type PoolId,
} from "@/lib/randomDraw";
import { cn } from "@/lib/utils";
import t from "@/app/teacher/teacher.module.css";
import styles from "./randomDraw.module.css";

const SPIN_MS = 4200;
const TURNS = 6;
const R = 100; // 돌림판 반지름 (viewBox 단위)
const FILLS = ["var(--sky)", "var(--apricot)", "var(--mint)", "var(--sand)"];

// 위쪽(12시)에서 시계 방향으로 잰 각도의 원 위 점
function point(deg: number, r: number) {
    const a = (deg * Math.PI) / 180;
    return `${(r * Math.sin(a)).toFixed(3)} ${(-r * Math.cos(a)).toFixed(3)}`;
}

function wedge(from: number, to: number) {
    return `M0 0 L${point(from, R)} A${R} ${R} 0 0 1 ${point(to, R)} Z`;
}

// 0 이상 1 미만의 고른 난수 (멈추는 위치를 칸 안에서 살짝 흔들 때만 써요. 번호는 DB가 골라요)
function randomFraction() {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
}

interface RandomDrawDialogProps {
    initialPool: PoolId;
    onClose: () => void;
}

type Busy = null | "spin" | "undo" | "reset";

// 랜덤 봉지과자(1~10)·랜덤 비스켓(1~20) 번호를 돌림판으로 뽑아요. 한 번 나온 번호는 다시 나오지 않아요.
export function RandomDrawDialog({ initialPool, onClose }: RandomDrawDialogProps) {
    const { drawn, error: loadError } = useDrawHistory();
    const [poolId, setPoolId] = useState<PoolId>(initialPool);
    const [rotation, setRotation] = useState(0);
    const [spinMs, setSpinMs] = useState(SPIN_MS);
    const [busy, setBusy] = useState<Busy>(null);
    const [result, setResult] = useState<number | null>(null);
    const [confirmReset, setConfirmReset] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const timer = useRef<number | null>(null);

    const pool = getPool(poolId);
    const loaded = drawn !== null;
    const history = drawn?.[poolId] ?? [];
    const remaining = remainingNumbers(pool, history);
    const seg = 360 / pool.size;
    const spinning = busy === "spin";
    const error = actionError ?? (loaded ? null : loadError);

    useEffect(() => () => {
        // 돌아가는 중에 화면을 떠나도 번호는 이미 기록됐으니 기록을 다시 불러와요
        if (timer.current) {
            window.clearTimeout(timer.current);
            refreshDraws();
        }
    }, []);

    const switchPool = (id: PoolId) => {
        if (busy || id === poolId) return;
        setPoolId(id);
        setRotation(0);
        setSpinMs(0);
        setResult(null);
        setConfirmReset(false);
        setActionError(null);
    };

    const spin = async () => {
        if (busy || !loaded || remaining.length === 0) return;
        setConfirmReset(false);
        setActionError(null);
        setResult(null);
        setBusy("spin");

        const res = await drawNumber(poolId);
        if (!res.ok) {
            setActionError(res.error);
            setBusy(null);
            return;
        }

        const { number: pick, drawn: list } = res.value;
        // 칸 가운데에서 조금 비켜 서도록 흔들어 줘요 (칸 경계에는 닿지 않게)
        const jitter = (randomFraction() - 0.5) * seg * 0.6;
        const target = (((-((pick - 1) * seg + jitter)) % 360) + 360) % 360;
        const base = rotation - (((rotation % 360) + 360) % 360);
        const next = base + TURNS * 360 + target;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const ms = reduced ? 0 : SPIN_MS;

        setSpinMs(ms);
        setRotation(next);
        timer.current = window.setTimeout(() => {
            timer.current = null;
            showDrawn(poolId, list);
            setResult(pick);
            setBusy(null);
        }, ms + 60);
    };

    const handleUndo = async () => {
        if (busy || history.length === 0) return;
        setBusy("undo");
        setActionError(null);
        const res = await undoLastDraw(poolId);
        setBusy(null);
        if (!res.ok) return setActionError(res.error);
        setResult(null);
    };

    const handleReset = async () => {
        if (busy) return;
        setBusy("reset");
        setActionError(null);
        const res = await resetDraws(poolId);
        setBusy(null);
        if (!res.ok) return setActionError(res.error);
        setResult(null);
        setConfirmReset(false);
    };

    // 돌아가는 동안에는 닫지 않아요. 결과를 못 본 채 번호만 기록되지 않도록요.
    const close = () => {
        if (!spinning) onClose();
    };

    return (
        <Dialog
            title="랜덤 번호 뽑기"
            description="한 번 나온 번호는 다시 나오지 않아요."
            onClose={close}
            width={600}
            footer={
                <>
                    <button type="button" className={cn(t.btn, t.ghost, styles.undo)} onClick={handleUndo} disabled={!!busy || history.length === 0}>
                        <Undo2 aria-hidden="true" />
                        {busy === "undo" ? "되돌리는 중…" : "마지막 번호 되돌리기"}
                    </button>
                    <button type="button" className={cn(t.btn, styles.spinBtn)} onClick={spin} disabled={!!busy || !loaded || remaining.length === 0} data-autofocus>
                        {spinning ? "돌아가는 중…" : loaded && remaining.length === 0 ? "모두 뽑았어요" : "돌리기"}
                    </button>
                </>
            }
        >
            <div className={cn(t.seg, styles.pools)} role="group" aria-label="뽑을 상품">
                {POOLS.map((p) => (
                    <button key={p.id} type="button" aria-pressed={poolId === p.id} onClick={() => switchPool(p.id)} disabled={!!busy && poolId !== p.id}>
                        {p.label}
                        <span className={t.segCount}>1~{p.size}</span>
                    </button>
                ))}
            </div>

            {error && <p className={t.error} role="alert">{error}</p>}

            <div className={styles.stage}>
                <div className={styles.wheelBox}>
                    <span className={styles.pointer} aria-hidden="true" />
                    <svg
                        className={styles.wheel}
                        viewBox="-104 -104 208 208"
                        role="img"
                        aria-label={`${pool.label} 돌림판, 남은 번호 ${remaining.length}개`}
                        style={{ transform: `rotate(${rotation}deg)`, transitionDuration: `${spinMs}ms` }}
                    >
                        <circle r={R + 3} className={styles.rim} />
                        {Array.from({ length: pool.size }, (_, i) => {
                            const n = i + 1;
                            const used = history.includes(n);
                            const mid = i * seg;
                            const won = result === n;
                            return (
                                <g key={n} className={cn(used && styles.used, won && styles.won)}>
                                    <path d={wedge(mid - seg / 2, mid + seg / 2)} style={{ fill: used ? undefined : FILLS[i % FILLS.length] }} />
                                    <text
                                        transform={`rotate(${mid}) translate(0 ${-R * 0.74})`}
                                        className={cn(styles.num, pool.size > 12 && styles.numSm)}
                                    >
                                        {n}
                                    </text>
                                </g>
                            );
                        })}
                        <circle r={R * 0.2} className={styles.hub} />
                    </svg>
                </div>

                <div className={styles.readout} aria-live="polite">
                    {result !== null ? (
                        <>
                            <span className={styles.readLabel}>{pool.label}</span>
                            <b className={styles.big}>{result}<small>번</small></b>
                            <span className={styles.readNote}>남은 번호 {remaining.length}개</span>
                        </>
                    ) : spinning ? (
                        <span className={styles.readLabel}>두근두근…</span>
                    ) : !loaded ? (
                        <span className={styles.readLabel}>{loadError ? "기록을 불러오지 못했어요" : "뽑은 번호를 불러오는 중…"}</span>
                    ) : remaining.length === 0 ? (
                        <>
                            <b className={styles.allDone}>모두 뽑았어요</b>
                            <span className={styles.readNote}>아래에서 다시 채우면 1번부터 다시 나와요.</span>
                        </>
                    ) : (
                        <>
                            <span className={styles.readLabel}>남은 번호</span>
                            <b className={styles.big}>{remaining.length}<small>개</small></b>
                            <span className={styles.readNote}>‘돌리기’를 누르세요.</span>
                        </>
                    )}
                </div>
            </div>

            <section className={styles.history} aria-label="뽑은 번호">
                <div className={styles.hHead}>
                    <h3>뽑은 번호 <span>{history.length}/{pool.size}</span></h3>
                    {confirmReset ? (
                        <span className={styles.confirm}>
                            모두 지울까요?
                            <button type="button" className={cn(t.btn, t.sm, styles.dangerBtn)} onClick={handleReset} disabled={!!busy}>
                                {busy === "reset" ? "지우는 중…" : "지우기"}
                            </button>
                            <button type="button" className={cn(t.btn, t.ghost, t.sm)} onClick={() => setConfirmReset(false)} disabled={!!busy}>
                                그대로 두기
                            </button>
                        </span>
                    ) : (
                        <button
                            type="button"
                            className={cn(t.btn, t.ghost, t.sm)}
                            onClick={() => setConfirmReset(true)}
                            disabled={!!busy || history.length === 0}
                        >
                            <RotateCcw aria-hidden="true" />
                            다시 채우기
                        </button>
                    )}
                </div>
                {history.length === 0 ? (
                    <p className={styles.hEmpty}>{loaded ? "아직 뽑은 번호가 없어요." : "–"}</p>
                ) : (
                    <ol className={styles.chips}>
                        {history.map((n, i) => (
                            <li key={n} className={cn(i === history.length - 1 && styles.last)} title={`${i + 1}번째로 뽑음`}>
                                {n}
                            </li>
                        ))}
                    </ol>
                )}
            </section>
        </Dialog>
    );
}
