"use client";

import { useEffect, useSyncExternalStore } from "react";
import { teacherApi } from "./teacherApi";

// 랜덤 상품 돌림판 (supabase_random_draw.sql 의 market_random_draw 표).
// 번호는 DB가 남은 번호 중에서 골라 기록해요. 그래서 어느 교사 컴퓨터에서 뽑아도 같은 번호가 다시 나오지 않아요.

export type PoolId = "bag" | "biscuit";

export interface Pool {
    id: PoolId;
    label: string; // 버튼·제목에 쓰는 이름
    size: number; // 1번부터 size번까지 (DB의 _random_draw_size 와 같아야 해요)
}

export const POOLS: Pool[] = [
    { id: "bag", label: "랜덤 봉지과자", size: 10 },
    { id: "biscuit", label: "랜덤 비스켓", size: 20 },
];

export function getPool(id: PoolId) {
    return POOLS.find((p) => p.id === id)!;
}

// 구매 내역의 상품 이름으로 어떤 돌림판인지 찾아요. (예: "랜덤 봉지과자", "랜덤비스킷")
export function poolForItemName(name: string | null | undefined): PoolId | null {
    if (!name) return null;
    const n = name.replace(/\s+/g, "");
    if (!n.includes("랜덤")) return null;
    if (n.includes("봉지과자")) return "bag";
    if (n.includes("비스켓") || n.includes("비스킷")) return "biscuit";
    return null;
}

export function remainingNumbers(pool: Pool, drawn: number[]) {
    return Array.from({ length: pool.size }, (_, i) => i + 1).filter((n) => !drawn.includes(n));
}

export type Drawn = Record<PoolId, number[]>; // 뽑은 순서대로

export function drawErrorText(message: string) {
    if (/teacher_(list|draw|undo|reset)_random|schema cache|does not exist/i.test(message)) {
        return "뽑은 번호를 저장할 곳이 아직 없어요. Supabase에서 supabase_random_draw.sql 을 먼저 실행해 주세요.";
    }
    const empty = "RANDOM_DRAW_EMPTY:";
    if (message.includes(empty)) return message.slice(message.indexOf(empty) + empty.length).trim();
    return "번호 기록을 불러오거나 저장하지 못했어요. 잠시 뒤 다시 해 주세요.";
}

// 네트워크 문제로 호출이 던지는 경우에도 { error } 모양으로 받아요
async function safe<T>(run: () => Promise<{ data: T | null; error: { message: string } | null }>) {
    try {
        return await run();
    } catch (e) {
        return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
}

// --- 대시보드 패널과 돌림판이 같은 기록을 나눠 쓰는 작은 저장소 ---
interface DrawState {
    drawn: Drawn | null; // null = 아직 불러오기 전
    error: string | null;
}

let state: DrawState = { drawn: null, error: null };
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: Partial<DrawState>) {
    state = { ...state, ...next };
    listeners.forEach((l) => l());
}

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    return () => {
        listeners.delete(onChange);
    };
}

export function refreshDraws(): Promise<void> {
    if (!inflight) {
        inflight = safe(teacherApi.listRandomDraws).then(({ data, error }) => {
            inflight = null;
            if (error || !data) {
                if (error) console.error("Failed to load random draws:", error);
                setState({ error: drawErrorText(error?.message ?? "") });
                return;
            }
            setState({ drawn: { bag: data.bag ?? [], biscuit: data.biscuit ?? [] }, error: null });
        });
    }
    return inflight;
}

// 화면에 보이는 기록만 바꿔요 (돌림판이 멈춘 뒤에 뽑은 번호를 흐리게 하려고)
export function showDrawn(pool: PoolId, list: number[]) {
    if (!state.drawn) return;
    setState({ drawn: { ...state.drawn, [pool]: list }, error: null });
}

type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

// DB가 남은 번호 중 하나를 골라 기록해요. 화면 기록은 돌림판이 멈춘 뒤 showDrawn 으로 바꿔요.
export async function drawNumber(pool: PoolId): Promise<Outcome<{ number: number; drawn: number[] }>> {
    const { data, error } = await safe(() => teacherApi.drawRandom(pool));
    if (error || !data) {
        console.error("Failed to draw:", error);
        if (error?.message.includes("RANDOM_DRAW_EMPTY")) refreshDraws();
        return { ok: false, error: drawErrorText(error?.message ?? "") };
    }
    return { ok: true, value: data };
}

async function replace(pool: PoolId, run: () => ReturnType<typeof teacherApi.undoRandomDraw>): Promise<Outcome<null>> {
    const { data, error } = await safe(run);
    if (error || !data) {
        console.error("Failed to change random draws:", error);
        return { ok: false, error: drawErrorText(error?.message ?? "") };
    }
    showDrawn(pool, data);
    return { ok: true, value: null };
}

export const undoLastDraw = (pool: PoolId) => replace(pool, () => teacherApi.undoRandomDraw(pool));
export const resetDraws = (pool: PoolId) => replace(pool, () => teacherApi.resetRandomDraws(pool));

// 뽑은 번호 기록. 처음 쓸 때와 창으로 돌아올 때 다시 불러와요 (다른 컴퓨터에서 뽑았을 수 있으니까요).
export function useDrawHistory() {
    const snapshot = useSyncExternalStore(subscribe, () => state, () => state);

    useEffect(() => {
        refreshDraws();
        const recheck = () => {
            if (document.visibilityState === "visible") refreshDraws();
        };
        window.addEventListener("focus", recheck);
        document.addEventListener("visibilitychange", recheck);
        return () => {
            window.removeEventListener("focus", recheck);
            document.removeEventListener("visibilitychange", recheck);
        };
    }, []);

    return snapshot;
}
