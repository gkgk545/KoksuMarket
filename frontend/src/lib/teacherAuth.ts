"use client";

const TEACHER_PASSWORD = "teacher2026";
const AUTH_KEY = "teacherAuth";
const EXPIRY_KEY = "teacherAuthExpiry";
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export function login(password: string, rememberMe: boolean = false): boolean {
    if (password === TEACHER_PASSWORD) {
        localStorage.setItem(AUTH_KEY, "true");
        if (rememberMe) {
            const expiryTime = Date.now() + SESSION_DURATION;
            localStorage.setItem(EXPIRY_KEY, expiryTime.toString());
        } else {
            localStorage.removeItem(EXPIRY_KEY);
        }
        return true;
    }
    return false;
}

export function isAuthenticated(): boolean {
    const auth = localStorage.getItem(AUTH_KEY);
    if (!auth) return false;

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
