import { supabase } from './supabase';

// Types matching the database schema
export interface Student {
    id: number;
    name: string;
    grade: number;
    ticket_count: number;
    password?: string; // Only needed for login verification
}

export interface Item {
    id: number;
    name: string;
    cost: number;
    link: string | null;
    image_url: string | null;
    quantity: number;
}

export interface Purchase {
    id: number;
    student_id: number;
    item_id: number;
    timestamp: string;
    is_delivered: boolean;
    // Joined data
    item_name?: string;
    item_cost?: number;
}

export const api = {
    // Get students by grade
    getStudentsByGrade: async (grade: number): Promise<Student[]> => {
        const { data, error } = await supabase
            .from('market_student')
            .select('id, name, grade, ticket_count')
            .eq('grade', grade)
            .order('name');

        if (error) throw new Error(error.message);
        return data || [];
    },

    // Student login - simple password check
    login: async (student_id: number, password: string): Promise<{ status: string; student: Student }> => {
        const { data, error } = await supabase
            .from('market_student')
            .select('id, name, grade, ticket_count, password')
            .eq('id', student_id)
            .single();

        if (error) throw new Error('학생을 찾을 수 없습니다.');
        if (data.password !== password) throw new Error('비밀번호가 틀렸습니다.');

        // Remove password from returned data
        const { password: _, ...student } = data;
        return { status: 'success', student };
    },

    // Get all items
    getItems: async (): Promise<Item[]> => {
        const { data, error } = await supabase
            .from('market_item')
            .select('*')
            .order('name');

        if (error) throw new Error(error.message);
        return data || [];
    },

    // Get student detail with purchase history
    getStudentDetail: async (id: number): Promise<{ student: Student; purchases: Purchase[] }> => {
        // Get student
        const { data: student, error: studentError } = await supabase
            .from('market_student')
            .select('id, name, grade, ticket_count')
            .eq('id', id)
            .single();

        if (studentError) throw new Error(studentError.message);

        // Get purchases with item info
        const { data: purchases, error: purchasesError } = await supabase
            .from('market_purchase')
            .select(`
                id,
                student_id,
                item_id,
                timestamp,
                is_delivered,
                market_item (name, cost)
            `)
            .eq('student_id', id)
            .order('timestamp', { ascending: false });

        if (purchasesError) throw new Error(purchasesError.message);

        // Transform purchases to include item_name and item_cost
        const transformedPurchases = (purchases || []).map((p: any) => ({
            id: p.id,
            student_id: p.student_id,
            item_id: p.item_id,
            timestamp: p.timestamp,
            is_delivered: p.is_delivered,
            item_name: p.market_item?.name || 'Unknown',
            item_cost: p.market_item?.cost || 0,
        }));

        return { student, purchases: transformedPurchases };
    },

    // Purchase an item
    purchaseItem: async (student_id: number, item_id: number): Promise<{ status: string; message: string; student: Student }> => {
        // Get student
        const { data: student, error: studentError } = await supabase
            .from('market_student')
            .select('id, name, grade, ticket_count')
            .eq('id', student_id)
            .single();

        if (studentError) throw new Error('학생을 찾을 수 없습니다.');

        // Get item
        const { data: item, error: itemError } = await supabase
            .from('market_item')
            .select('*')
            .eq('id', item_id)
            .single();

        if (itemError) throw new Error('상품을 찾을 수 없습니다.');

        // Check stock
        if (item.quantity <= 0) {
            throw new Error('품절된 상품입니다.');
        }

        // Check balance
        if (student.ticket_count < item.cost) {
            throw new Error('티켓이 부족합니다.');
        }

        // Deduct ticket from student
        const { error: updateStudentError } = await supabase
            .from('market_student')
            .update({ ticket_count: student.ticket_count - item.cost })
            .eq('id', student_id);

        if (updateStudentError) throw new Error('티켓 차감 실패');

        // Decrease item quantity
        const { error: updateItemError } = await supabase
            .from('market_item')
            .update({ quantity: item.quantity - 1 })
            .eq('id', item_id);

        if (updateItemError) throw new Error('재고 감소 실패');

        // Create purchase record
        const { error: purchaseError } = await supabase
            .from('market_purchase')
            .insert({
                student_id,
                item_id,
                timestamp: new Date().toISOString(),
                is_delivered: false,
            });

        if (purchaseError) throw new Error('구매 기록 생성 실패');

        return {
            status: 'success',
            message: '구매가 완료되었습니다!',
            student: {
                ...student,
                ticket_count: student.ticket_count - item.cost,
            },
        };
    },
};
