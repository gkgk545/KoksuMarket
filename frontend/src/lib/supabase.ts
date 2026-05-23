import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let realSupabase: any = null;

if (supabaseUrl && supabaseAnonKey) {
    try {
        realSupabase = createClient(supabaseUrl, supabaseAnonKey);
    } catch (e) {
        console.error("Supabase initialization failed:", e);
    }
}

// Safe Proxy wrapper to prevent app crash when environment variables are missing.
// It will throw a clean, human-readable error when any database query is attempted.
export const supabase = new Proxy({} as any, {
    get(target, prop) {
        if (!realSupabase) {
            const errorMsg = 
                "Supabase 환경 변수가 설정되지 않았습니다!\n\n" +
                "해결 방법:\n" +
                "1. 'frontend' 폴더 안에 '.env.local' 파일을 생성해 주세요.\n" +
                "2. 파일 내에 아래와 같이 Supabase 정보를 입력해 주세요:\n\n" +
                "NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL\n" +
                "NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY\n\n" +
                "3. 그 후 개발 서버(npm run dev)를 재시작해 주세요.";
            
            console.error(errorMsg);
            throw new Error(errorMsg);
        }
        return realSupabase[prop];
    }
});

// Types for our database tables
export interface Student {
    id: number;
    name: string;
    grade: number;
    password: string;
    ticket_count: number;
}

export interface Item {
    id: number;
    name: string;
    cost: number;
    quantity: number;
    link: string | null;
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
