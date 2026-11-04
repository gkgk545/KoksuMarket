"use client";

import { supabase } from "./supabase";

const AUTH_KEY = "teacherAuth";
const EXPIRY_KEY = "teacherAuthExpiry";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function login(password: string, rememberMe: boolean = false): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc("verify_teacher_login", {
            p_password: password,
            p_remember: rememberMe,
        });

        if (error || !data || data.status !== "success" || !data.token) {
            return false;
        }

        // 서버가 발급한 세션 토큰. 교사 작업 함수(teacherApi)가 매번 이 토큰을 보내 확인받아요.
        localStorage.setItem(AUTH_KEY, data.token);
        if (rememberMe) {
            const expiryTime = Date.now() + SESSION_DURATION;
            localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
        } else {
            localStorage.removeItem(EXPIRY_KEY);
        }
        return true;
    } catch (e) {
        console.error("Teacher login error:", e);
        return false;
    }
}

export function getTeacherToken(): string | null {
    return localStorage.getItem(AUTH_KEY);
}

export function isAuthenticated(): boolean {
    const auth = localStorage.getItem(AUTH_KEY);
    if (!auth) return false;

    // 예전 방식 토큰("true", "teacher_session_…")은 서버가 알아보지 못하니 다시 로그인하게
    if (auth === "true" || auth.startsWith("teacher_session_")) {
        logout();
        return false;
    }

    const expiry = localStorage.getItem(EXPIRY_KEY);
    if (expiry) {
        const expiryTime = parseInt(expiry, 10);
        if (Date.now() > expiryTime) {
            logout();
            return false;
        }
    }
    return true;
}

export function logout(): void {
    const token = localStorage.getItem(AUTH_KEY);
    if (token) {
        // 서버의 세션도 지우기 (실패해도 12시간/7일 뒤 저절로 만료)
        supabase.rpc("teacher_logout", { p_token: token }).then(undefined, () => {});
    }
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(EXPIRY_KEY);
}

// CSV Utilities
export function parseCSV(csvText: string): string[][] {
    const lines = csvText.trim().split('\n');
    return lines.map(line => {
        // Handle quoted values with commas
        const result: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of line) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current.trim());
        return result;
    });
}

export function generateCSV(headers: string[], rows: string[][]): string {
    const escapeCell = (cell: string) => {
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
    };

    const headerLine = headers.map(escapeCell).join(',');
    const dataLines = rows.map(row => row.map(escapeCell).join(','));

    return [headerLine, ...dataLines].join('\n');
}

export function downloadCSV(filename: string, csvContent: string): void {
    const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
