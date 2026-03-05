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

export interface Funding {
    id: number;
    title: string;
    description: string | null;
    target_amount: number;
    current_amount: number;
    image_url: string | null;
    deadline: string | null;
    is_completed: boolean;
}

export interface FundingParticipation {
    id: number;
    funding_id: number;
    student_id: number;
    amount: number;
    timestamp: string;
    // Joined data
    student_name?: string;
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

    // Purchase an item - using Supabase RPC for Atomic Transaction
    purchaseItem: async (student_id: number, item_id: number): Promise<{ status: string; message: string; student: Student }> => {
        const { data, error } = await supabase.rpc('purchase_item', {
            p_student_id: student_id,
            p_item_id: item_id
        });

        if (error) {
            throw new Error(error.message || '구매 과정에서 오류가 발생했습니다.');
        }

        return {
            status: 'success',
            message: '구매가 완료되었습니다!',
            student: data as Student,
        };
    },

    // Get all fundings
    getFundings: async (): Promise<Funding[]> => {
        const { data, error } = await supabase
            .from('market_funding')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw new Error(error.message);
        return data || [];
    },

    // Get a specific funding details with participants
    getFundingDetail: async (funding_id: number): Promise<{ funding: Funding; participations: FundingParticipation[] }> => {
        const { data: funding, error: fundingError } = await supabase
            .from('market_funding')
            .select('*')
            .eq('id', funding_id)
            .single();

        if (fundingError) throw new Error(fundingError.message);

        const { data: participations, error: partError } = await supabase
            .from('market_funding_participation')
            .select(`
                id, funding_id, student_id, amount, timestamp,
                market_student (name)
            `)
            .eq('funding_id', funding_id)
            .order('timestamp', { ascending: false });

        if (partError) throw new Error(partError.message);

        const transformedParts = (participations || []).map((p: any) => ({
            id: p.id,
            funding_id: p.funding_id,
            student_id: p.student_id,
            amount: p.amount,
            timestamp: p.timestamp,
            student_name: p.market_student?.name || 'Unknown',
        }));

        return { funding, participations: transformedParts };
    },

    // Participate in funding
    participateFunding: async (student_id: number, funding_id: number, amount: number): Promise<{ status: string; message: string; student: Student }> => {
        const { data, error } = await supabase.rpc('participate_funding', {
            p_student_id: student_id,
            p_funding_id: funding_id,
            p_amount: amount
        });

        if (error) {
            throw new Error(error.message || '참여 과정에서 오류가 발생했습니다.');
        }

        return {
            status: 'success',
            message: '성공적으로 펀딩에 참여했습니다!',
            student: data as Student,
        };
    },
};
