-- ==========================================
-- 곡수마켓 (KoksuMarket) 데이터베이스 개선 SQL 스크립트
-- ==========================================
-- 이 스크립트를 Supabase Dashboard -> SQL Editor에 복사하여 실행하세요.

-- 1. 학생 로그인 검증용 안전한 RPC 함수 (비밀번호 노출 방지)
DROP FUNCTION IF EXISTS verify_student_login(integer, text);

CREATE OR REPLACE FUNCTION verify_student_login(p_student_id INT, p_password TEXT)
RETURNS TABLE (
    id BIGINT,
    name TEXT,
    grade INT,
    ticket_count INT
) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY 
    SELECT s.id::bigint, s.name::text, s.grade::integer, s.ticket_count::integer
    FROM market_student s
    WHERE s.id = p_student_id AND s.password = p_password;
END;
$$;


-- 2. 장바구니 일괄 결제 트랜잭션 RPC 함수 (동시성 및 데이터 정합성 보장)
CREATE OR REPLACE FUNCTION purchase_cart_items(p_student_id INT, p_items jsonb)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_item RECORD;
    v_total_cost INT := 0;
    v_student_tickets INT;
    v_student_name TEXT;
    v_student_grade INT;
BEGIN
    -- 1. 총 필요 티켓 계산 및 재고 사전 검증 (FOR UPDATE 배타적 잠금으로 동시 구매 문제 방지)
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id INT, quantity INT, cost INT) LOOP
        v_total_cost := v_total_cost + (v_item.cost * v_item.quantity);
        
        -- 재고 검증
        IF (SELECT quantity FROM market_item WHERE id = v_item.id FOR UPDATE) < v_item.quantity THEN
            RAISE EXCEPTION '상품(ID: %)의 재고가 부족합니다.', v_item.id;
        END IF;
    END LOOP;

    -- 2. 학생 티켓 잔액 검증 (FOR UPDATE 잠금)
    SELECT ticket_count, name, grade INTO v_student_tickets, v_student_name, v_student_grade 
    FROM market_student 
    WHERE id = p_student_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION '학생을 찾을 수 없습니다.';
    END IF;

    IF v_student_tickets < v_total_cost THEN
        RAISE EXCEPTION '티켓이 부족합니다. (필요: %, 보유: %)', v_total_cost, v_student_tickets;
    END IF;

    -- 3. 학생 티켓 차감
    UPDATE market_student 
    SET ticket_count = ticket_count - v_total_cost 
    WHERE id = p_student_id;

    -- 4. 상품 재고 차감 및 구매 이력 작성
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id INT, quantity INT) LOOP
        -- 재고 업데이트
        UPDATE market_item 
        SET quantity = quantity - v_item.quantity 
        WHERE id = v_item.id;
        
        -- 수량만큼 구매 내역 일괄 추가
        FOR i IN 1..v_item.quantity LOOP
            INSERT INTO market_purchase (student_id, item_id, timestamp, is_delivered)
            VALUES (p_student_id, v_item.id, NOW(), false);
        END LOOP;
    END LOOP;

    RETURN json_build_object(
        'status', 'success', 
        'remaining_tickets', v_student_tickets - v_total_cost,
        'student', json_build_object(
            'id', p_student_id,
            'name', v_student_name,
            'grade', v_student_grade,
            'ticket_count', v_student_tickets - v_total_cost
        )
    );
END;
$$;


-- 3. 교사 취소용 트랜잭션 RPC 함수 (티켓 및 재고 완벽 복구)
CREATE OR REPLACE FUNCTION cancel_purchase_rpc(p_purchase_id INT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_purchase RECORD;
    v_item_cost INT;
BEGIN
    -- 1. 구매 내역 조회 및 잠금
    SELECT * INTO v_purchase FROM market_purchase WHERE id = p_purchase_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '구매 기록을 찾을 수 없습니다.';
    END IF;

    -- 2. 상품 단가 확인
    SELECT cost INTO v_item_cost FROM market_item WHERE id = v_purchase.item_id;

    -- 3. 학생 티켓 복구
    UPDATE market_student 
    SET ticket_count = ticket_count + v_item_cost 
    WHERE id = v_purchase.student_id;

    -- 4. 상품 재고 복구
    UPDATE market_item 
    SET quantity = quantity + 1 
    WHERE id = v_purchase.item_id;

    -- 5. 구매 기록 삭제
    DELETE FROM market_purchase WHERE id = p_purchase_id;

    RETURN json_build_object('status', 'success', 'message', '구매 취소 및 복구가 완료되었습니다.');
END;
$$;


-- 4. 랭킹 집계용 데이터베이스 뷰
DROP VIEW IF EXISTS student_rankings;

CREATE VIEW student_rankings AS
SELECT 
    s.id,
    s.name,
    s.grade,
    s.ticket_count as current_tickets,
    -- 누적 소비 티켓량 (구매한 아이템 가격 합산)
    COALESCE((
        SELECT SUM(i.cost) 
        FROM market_purchase p
        JOIN market_item i ON p.item_id = i.id
        WHERE p.student_id = s.id
    ), 0) AS total_spent,
    -- 공동 펀딩 기부 티켓량 합산
    COALESCE((
        SELECT SUM(fp.amount)
        FROM market_funding_participation fp
        WHERE fp.student_id = s.id
    ), 0) AS total_funded,
    -- 총 티켓 (잔여 + 소비 + 기부)
    s.ticket_count + COALESCE((
        SELECT SUM(i.cost) 
        FROM market_purchase p
        JOIN market_item i ON p.item_id = i.id
        WHERE p.student_id = s.id
    ), 0) + COALESCE((
        SELECT SUM(fp.amount)
        FROM market_funding_participation fp
        WHERE fp.student_id = s.id
    ), 0) AS total_tickets
FROM market_student s;


-- 5. 교사 권한 원격 검증용 테이블 및 RPC 함수 생성 (클라이언트 하드코딩 탈피)
CREATE TABLE IF NOT EXISTS market_teacher_auth (
    id SERIAL PRIMARY KEY,
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 초기 교사 비밀번호 데이터 등록 (테이블이 비어있을 때만)
INSERT INTO market_teacher_auth (id, password_hash) 
VALUES (1, 'teacher2026')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION verify_teacher_login(p_password TEXT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_saved_pass TEXT;
BEGIN
    SELECT password_hash INTO v_saved_pass FROM market_teacher_auth LIMIT 1;
    IF v_saved_pass = p_password THEN
        -- 세션 검증 토큰 (간이 해시) 생성하여 반환
        RETURN json_build_object(
            'status', 'success', 
            'token', 'teacher_session_' || md5(p_password || 'salt2026')
        );
    ELSE
        RETURN json_build_object('status', 'fail');
    END IF;
END;
$$;


-- 6. RLS(행 수준 보안) 설정 해제 (개발 및 빠른 연동용)
-- Supabase에서 새 테이블을 만들면 기본적으로 RLS가 켜져 클라이언트의 직접적인 데이터 입력(Insert/Update)이 차단됩니다.
-- 아래 명령어를 실행하여 테이블의 RLS를 비활성화하면 오류 없이 바로 학생 데이터 추가가 가능해집니다.

ALTER TABLE market_student DISABLE ROW LEVEL SECURITY;
ALTER TABLE market_item DISABLE ROW LEVEL SECURITY;
ALTER TABLE market_purchase DISABLE ROW LEVEL SECURITY;
ALTER TABLE market_funding DISABLE ROW LEVEL SECURITY;
ALTER TABLE market_funding_participation DISABLE ROW LEVEL SECURITY;

