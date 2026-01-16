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

    // Purchase an item - with race condition handling
    purchaseItem: async (student_id: number, item_id: number): Promise<{ status: string; message: string; student: Student }> => {
        // 1. Get item info first (to know the cost)
        const { data: item, error: itemError } = await supabase
            .from('market_item')
            .select('*')
            .eq('id', item_id)
            .single();

        if (itemError) throw new Error('상품을 찾을 수 없습니다.');

        // Early check for stock (will be verified again atomically)
        if (item.quantity <= 0) {
            throw new Error('품절된 상품입니다.');
        }

        // 2. Get student info (to check balance)
        const { data: student, error: studentError } = await supabase
            .from('market_student')
            .select('id, name, grade, ticket_count')
            .eq('id', student_id)
            .single();

        if (studentError) throw new Error('학생을 찾을 수 없습니다.');

        // Early check for balance (will be verified again atomically)
        if (student.ticket_count < item.cost) {
            throw new Error('티켓이 부족합니다.');
        }

        // 3. ATOMIC: Decrease item quantity only if quantity > 0
        // This uses Supabase RPC or conditional update
        const { data: updatedItem, error: updateItemError } = await supabase
            .from('market_item')
            .update({ quantity: item.quantity - 1 })
            .eq('id', item_id)
            .gt('quantity', 0)  // Only update if quantity > 0
            .select()
            .single();

        if (updateItemError || !updatedItem) {
            throw new Error('품절된 상품입니다. 다른 학생이 먼저 구매했습니다.');
        }

        // 4. ATOMIC: Decrease ticket only if ticket_count >= cost
        const { data: updatedStudent, error: updateStudentError } = await supabase
            .from('market_student')
            .update({ ticket_count: student.ticket_count - item.cost })
            .eq('id', student_id)
            .gte('ticket_count', item.cost)  // Only update if enough tickets
            .select()
            .single();

        if (updateStudentError || !updatedStudent) {
            // Rollback: Restore item quantity
            await supabase
                .from('market_item')
                .update({ quantity: updatedItem.quantity + 1 })
                .eq('id', item_id);

            throw new Error('티켓이 부족합니다. 다시 시도해주세요.');
        }

        // 5. Create purchase record
        const { error: purchaseError } = await supabase
            .from('market_purchase')
            .insert({
                student_id,
                item_id,
                timestamp: new Date().toISOString(),
                is_delivered: false,
            });

        if (purchaseError) {
            // Rollback: Restore both item quantity and student tickets
            await supabase
                .from('market_item')
                .update({ quantity: updatedItem.quantity + 1 })
                .eq('id', item_id);
            await supabase
                .from('market_student')
                .update({ ticket_count: updatedStudent.ticket_count + item.cost })
                .eq('id', student_id);

            throw new Error('구매 기록 생성 실패. 다시 시도해주세요.');
        }

        return {
            status: 'success',
            message: '구매가 완료되었습니다!',
            student: updatedStudent,
        };
    },
};
