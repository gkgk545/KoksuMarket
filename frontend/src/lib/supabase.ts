import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Types for our database tables
export interface Student {
    id: number;
    name: string;
    grade: number;
    ticket_count: number;
}

export interface Item {
    id: number;
    name: string;
    price: number;
    quantity: number;
    image_url: string | null;
}

export interface Purchase {
    id: number;
    student_id: number;
    item_id: number;
    quantity: number;
    total_price: number;
    purchased_at: string;
    is_delivered: boolean;
    // Joined fields
    student?: Student;
    item?: Item;
}
