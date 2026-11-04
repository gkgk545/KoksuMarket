"use client";

import { supabase, Student } from "./supabase";
import { getTeacherToken, logout } from "./teacherAuth";

// 교사 작업은 모두 DB 함수(supabase_security.sql)를 거쳐요.
// 함수가 로그인 토큰을 확인하므로, 공개 키만으로는 데이터를 고치거나 지울 수 없어요.
// 결과는 supabase 호출과 같은 { data, error } 모양으로 돌려줘요.

type Result<T> = { data: T | null; error: { message: string } | null };

async function call<T = null>(fn: string, args: Record<string, unknown> = {}): Promise<Result<T>> {
    const { data, error } = await supabase.rpc(fn, { p_token: getTeacherToken(), ...args });
    if (error) {
        if (String(error.message).includes("TEACHER_AUTH")) {
            // 세션이 끝났거나 예전 토큰: 로그인 화면으로
            logout();
            window.location.href = "/teacher";
        }
        return { data: null, error: { message: error.message } };
    }
    return { data: data as T, error: null };
}

export type TicketMode = "set" | "add" | "subtract";

export interface NewStudent {
    name: string;
    grade: number;
    password: string;
    ticket_count: number;
}

export interface ItemInput {
    name: string;
    cost: number;
    quantity: number;
    link?: string | null;
    image_url?: string | null;
}

export interface FundingInput {
    title: string;
    description: string | null;
    target_amount: number;
    image_url: string | null;
    grade: number | null;
    is_completed?: boolean;
}

export const teacherApi = {
    // 학생 (비밀번호 포함 — 교사만 볼 수 있음)
    listStudents: (grade: number) => call<Student[]>("teacher_list_students", { p_grade: grade }),
    setTickets: (studentIds: number[], mode: TicketMode, amount: number) =>
        call<number>("teacher_set_tickets", { p_student_ids: studentIds, p_mode: mode, p_amount: amount }),
    addStudents: (students: NewStudent[]) => call<number>("teacher_add_students", { p_students: students }),
    setStudentPassword: (studentId: number, password: string) =>
        call("teacher_set_student_password", { p_student_id: studentId, p_password: password }),
    deleteStudent: (studentId: number) => call("teacher_delete_student", { p_student_id: studentId }),

    // 상품
    addItems: (items: ItemInput[]) => call<number>("teacher_add_items", { p_items: items }),
    updateItem: (itemId: number, item: ItemInput) => call("teacher_update_item", { p_item_id: itemId, p_item: item }),
    deleteItem: (itemId: number) => call("teacher_delete_item", { p_item_id: itemId }),

    // 구매 내역
    setDelivered: (purchaseId: number, delivered: boolean) =>
        call("teacher_set_delivered", { p_purchase_id: purchaseId, p_delivered: delivered }),
    deletePurchases: (purchaseIds: number[]) => call<number>("teacher_delete_purchases", { p_purchase_ids: purchaseIds }),
    cancelPurchase: (purchaseId: number) => call("teacher_cancel_purchase", { p_purchase_id: purchaseId }),

    // 공동 펀딩 (fundingId 가 null 이면 새로 만들기)
    saveFunding: (fundingId: number | null, funding: FundingInput) =>
        call("teacher_save_funding", { p_funding_id: fundingId, p_funding: funding }),
    deleteFunding: (fundingId: number) => call("teacher_delete_funding", { p_funding_id: fundingId }),
};
