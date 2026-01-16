const API_BASE_URL = 'http://localhost:8000/api';

export interface Student {
    id: number;
    name: string;
    grade: number;
    ticket_count: number;
}

export interface Item {
    id: number;
    name: string;
    cost: number;
    link: string;
    image_url: string;
    quantity: number;
}

export interface Purchase {
    id: number;
    item_name: string;
    item_cost: number;
    timestamp: string;
    is_delivered: boolean;
}

async function fetcher<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'API Error');
    }

    return res.json();
}

export const api = {
    getStudentsByGrade: (grade: number) => fetcher<Student[]>(`/students/?grade=${grade}`),
    login: (student_id: number, password: string) => fetcher<{
        status: string,
        student: Student
    }>('/login/', {
        method: 'POST',
        body: JSON.stringify({ student_id, password }),
    }),
    getItems: () => fetcher<Item[]>('/items/'),
    getStudentDetail: (id: number) => fetcher<{
        student: Student,
        purchases: Purchase[]
    }>(`/student/${id}/`),
    purchaseItem: (student_id: number, item_id: number) => fetcher<{
        status: string,
        message: string,
        student: Student
    }>(`/purchase/`, {
        method: 'POST',
        body: JSON.stringify({ student_id, item_id })
    })
};
