"use client";

import { useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

// 학생 마켓 임시 휴업 설정 (supabase_market_closure.sql 의 market_setting 표, 행 하나).
// 학생 화면(/ 로그인, /market)은 닫혀 있으면 휴업 안내를 보여 주고,
// 마켓 랭킹과 교사 페이지는 그대로 열려 있어요.

export interface MarketStatus {
    is_closed: boolean;
    reopen_date: string | null; // "2026-11-10"
    reopen_time: string | null; // "09:00:00"
    message: string | null;
}

export const OPEN_STATUS: MarketStatus = { is_closed: false, reopen_date: null, reopen_time: null, message: null };

// DB가 휴업 중에 구매·펀딩 참여를 거절할 때 붙이는 표시
export const MARKET_CLOSED_TAG = "MARKET_CLOSED:";
const CLOSED_EVENT = "market_closed";

// 설정을 읽지 못하면(표가 아직 없거나 네트워크 문제) 마켓을 열어 둬요.
// 그래도 구매는 DB가 휴업 여부를 다시 확인하므로 안전해요.
export async function fetchMarketStatus(): Promise<MarketStatus> {
    try {
        const { data, error } = await supabase
            .from("market_setting")
            .select("is_closed, reopen_date, reopen_time, message")
            .eq("id", 1)
            .maybeSingle();
        if (error || !data) return OPEN_STATUS;
        return data as MarketStatus;
    } catch {
        return OPEN_STATUS;
    }
}

// --- 화면끼리 같은 상태를 나눠 쓰는 작은 저장소 ---
let current: MarketStatus | null = null; // null = 아직 확인 전
let inflight: Promise<MarketStatus> | null = null;
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach((l) => l());
}

export function setMarketStatus(next: MarketStatus) {
    current = next;
    emit();
}

export function refreshMarketStatus(): Promise<MarketStatus> {
    if (!inflight) {
        inflight = fetchMarketStatus().then((s) => {
            inflight = null;
            setMarketStatus(s);
            return s;
        });
    }
    return inflight;
}

// 구매·펀딩 오류가 휴업 때문이면 화면이 바로 휴업 안내로 바뀌도록 알려요.
// 돌려주는 값은 학생에게 보여 줄 문장이에요.
export function readableMarketError(message: string): string {
    if (!message.includes(MARKET_CLOSED_TAG)) return message;
    window.dispatchEvent(new Event(CLOSED_EVENT));
    return message.slice(message.indexOf(MARKET_CLOSED_TAG) + MARKET_CLOSED_TAG.length).trim();
}

function subscribe(onChange: () => void) {
    listeners.add(onChange);
    return () => {
        listeners.delete(onChange);
    };
}

// 휴업 상태. 확인 전에는 null.
// watch 를 켜면 창으로 돌아올 때와 1분마다 다시 확인해요 (학생이 마켓에 있는 동안 교사가 닫는 경우).
export function useMarketStatus({ watch = false }: { watch?: boolean } = {}) {
    const status = useSyncExternalStore(subscribe, () => current, () => null);

    useEffect(() => {
        refreshMarketStatus();
        if (!watch) return;
        const recheck = () => {
            if (document.visibilityState === "visible") refreshMarketStatus();
        };
        const timer = window.setInterval(recheck, 60_000);
        window.addEventListener("focus", recheck);
        document.addEventListener("visibilitychange", recheck);
        window.addEventListener(CLOSED_EVENT, recheck);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("focus", recheck);
            document.removeEventListener("visibilitychange", recheck);
            window.removeEventListener(CLOSED_EVENT, recheck);
        };
    }, [watch]);

    return status;
}

// --- 다시 여는 날 문장 ---
const DAY = "일월화수목금토";

function parseDate(ymd: string) {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Date(y, m - 1, d);
}

// "11월 10일 (화)", short: "11월 10일"
export function reopenDateLabel(ymd: string, { short = false } = {}) {
    const d = parseDate(ymd);
    const md = `${d.getMonth() + 1}월 ${d.getDate()}일`;
    return short ? md : `${md} (${DAY[d.getDay()]})`;
}

// "오전 9시", "오후 1시 30분"
export function reopenTimeLabel(hms: string) {
    const [h, m] = hms.split(":").map(Number);
    const half = h < 12 ? "오전" : "오후";
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${half} ${hour}시${m ? ` ${m}분` : ""}`;
}

// "11월 10일 (화) 오전 9시". 날짜가 없으면 null.
export function reopenSummary(status: MarketStatus) {
    if (!status.reopen_date) return null;
    const time = status.reopen_time ? ` ${reopenTimeLabel(status.reopen_time)}` : "";
    return `${reopenDateLabel(status.reopen_date)}${time}`;
}

// "오늘", "내일", "3일 뒤". 날짜가 이미 지났으면 null.
export function reopenCountdown(ymd: string, now = new Date()) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((parseDate(ymd).getTime() - today.getTime()) / 86_400_000);
    if (days < 0) return null;
    if (days === 0) return "오늘";
    if (days === 1) return "내일";
    if (days === 2) return "모레";
    return `${days}일 뒤`;
}
