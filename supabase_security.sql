-- ==========================================
-- 곡수마켓 보안 강화 SQL (RLS 켜기 + 교사 작업을 로그인 확인 함수로만)
-- ==========================================
-- Supabase Dashboard -> SQL Editor 에 통째로 붙여 넣고 한 번 실행하세요.
-- 여러 번 실행해도 안전해요.
--
-- 순서: supabase_funding_grade.sql 실행 -> 새 웹사이트 배포(Netlify) 완료 -> 이 파일 실행
--       (이 파일을 실행하면 예전 웹사이트의 교사 화면은 더 이상 데이터를 고칠 수 없어요.)
--
-- 이 스크립트가 하는 일
--  1. public 스키마의 모든 테이블에 RLS를 켜고, anon(웹사이트 공개 키)의 쓰기·삭제 권한을 없애요.
--  2. 학생 화면에 필요한 읽기만 열어 둬요. 학생 비밀번호 칸은 읽을 수 없어요.
--  3. 교사 로그인 시 서버가 무작위 세션 토큰을 발급하고, 교사 작업은 그 토큰을 확인하는 함수로만 할 수 있어요.
--  4. 교사 비밀번호를 bcrypt 해시로 바꿔 저장해요.
--  5. 장바구니 결제가 브라우저가 보낸 가격 대신 DB의 가격을 쓰도록 고쳐요.
--
-- ⚠️ 이후에 supabase_improvements.sql / supabase_funding.sql 을 다시 실행하지 마세요.
--    그 안의 RLS 해제·GRANT 구문이 테이블을 다시 열어 버려요.
--
-- 교사 비밀번호를 바꾸려면 (따옴표 안만 고쳐서 실행):
--   UPDATE market_teacher_auth SET password_hash = extensions.crypt('새비밀번호', extensions.gen_salt('bf')), updated_at = NOW();

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE market_funding ADD COLUMN IF NOT EXISTS grade INT;

-- ------------------------------------------
-- 1. 교사 세션 테이블
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS market_teacher_session (
    token TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

-- ------------------------------------------
-- 2. 모든 테이블 잠그기 (RLS 켜고 anon/authenticated 권한 회수)
-- ------------------------------------------
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.tablename);
    END LOOP;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 앞으로 새로 만드는 테이블도 기본으로는 공개되지 않게
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;

-- ------------------------------------------
-- 3. 학생 화면에 필요한 읽기만 열기
-- ------------------------------------------
GRANT SELECT ON TABLE market_item, market_funding, market_funding_participation, market_purchase TO anon, authenticated;
-- 학생 표는 비밀번호를 뺀 칸만
GRANT SELECT (id, name, grade, ticket_count) ON TABLE market_student TO anon, authenticated;

DROP POLICY IF EXISTS public_read ON market_item;
CREATE POLICY public_read ON market_item FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS public_read ON market_funding;
CREATE POLICY public_read ON market_funding FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS public_read ON market_funding_participation;
CREATE POLICY public_read ON market_funding_participation FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS public_read ON market_purchase;
CREATE POLICY public_read ON market_purchase FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS public_read ON market_student;
CREATE POLICY public_read ON market_student FOR SELECT TO anon, authenticated USING (true);

-- 랭킹 뷰는 보는 사람 권한으로 실행 (위에서 연 읽기 권한만 사용)
ALTER VIEW student_rankings SET (security_invoker = true);
GRANT SELECT ON student_rankings TO anon, authenticated;

-- ------------------------------------------
-- 4. 교사 로그인 / 세션
-- ------------------------------------------
-- 평문으로 저장된 교사 비밀번호를 bcrypt 해시로 바꾸기
UPDATE market_teacher_auth
SET password_hash = extensions.crypt(password_hash, extensions.gen_salt('bf')), updated_at = NOW()
WHERE password_hash NOT LIKE '$2%';

DROP FUNCTION IF EXISTS verify_teacher_login(TEXT);
CREATE OR REPLACE FUNCTION verify_teacher_login(p_password TEXT, p_remember BOOLEAN DEFAULT false)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_id INT;
    v_hash TEXT;
    v_ok BOOLEAN;
    v_token TEXT;
BEGIN
    SELECT id, password_hash INTO v_id, v_hash FROM market_teacher_auth ORDER BY id LIMIT 1;

    IF v_hash IS NULL OR p_password IS NULL OR p_password = '' THEN
        v_ok := false;
    ELSIF v_hash LIKE '$2%' THEN
        v_ok := v_hash = crypt(p_password, v_hash);
    ELSE
        -- 누군가 평문으로 비밀번호를 넣어 둔 경우: 맞으면 바로 해시로 바꿔 저장
        v_ok := v_hash = p_password;
        IF v_ok THEN
            UPDATE market_teacher_auth SET password_hash = crypt(p_password, gen_salt('bf')), updated_at = NOW() WHERE id = v_id;
        END IF;
    END IF;

    IF NOT v_ok THEN
        PERFORM pg_sleep(1); -- 비밀번호 마구 넣어 보기를 느리게
        RETURN json_build_object('status', 'fail');
    END IF;

    DELETE FROM market_teacher_session WHERE expires_at < NOW();
    v_token := encode(gen_random_bytes(32), 'hex');
    INSERT INTO market_teacher_session (token, expires_at)
    VALUES (v_token, NOW() + CASE WHEN p_remember THEN INTERVAL '7 days' ELSE INTERVAL '12 hours' END);

    RETURN json_build_object('status', 'success', 'token', v_token);
END;
$$;

CREATE OR REPLACE FUNCTION teacher_logout(p_token TEXT)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    DELETE FROM market_teacher_session WHERE token = p_token;
$$;

-- 교사 함수들이 맨 먼저 부르는 토큰 확인 (웹에서 직접 부를 수 없음)
CREATE OR REPLACE FUNCTION _assert_teacher(p_token TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF p_token IS NULL OR NOT EXISTS (
        SELECT 1 FROM market_teacher_session WHERE token = p_token AND expires_at > NOW()
    ) THEN
        RAISE EXCEPTION 'TEACHER_AUTH: 교사 로그인이 필요해요. 다시 로그인해 주세요.';
    END IF;
END;
$$;
REVOKE ALL ON FUNCTION _assert_teacher(TEXT) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------
-- 5. 교사 작업 함수 — 학생
-- ------------------------------------------
CREATE OR REPLACE FUNCTION teacher_list_students(p_token TEXT, p_grade INT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    RETURN COALESCE((
        SELECT json_agg(json_build_object(
            'id', s.id, 'name', s.name, 'grade', s.grade,
            'ticket_count', s.ticket_count, 'password', s.password
        ) ORDER BY s.name)
        FROM market_student s
        WHERE s.grade = p_grade
    ), '[]'::json);
END;
$$;

-- p_mode: 'set' (그 수로 맞추기) | 'add' (더하기) | 'subtract' (빼기, 0 아래로는 안 내려감)
CREATE OR REPLACE FUNCTION teacher_set_tickets(p_token TEXT, p_student_ids BIGINT[], p_mode TEXT, p_amount INT)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count INT;
BEGIN
    PERFORM _assert_teacher(p_token);
    IF p_amount IS NULL OR p_amount < 0 THEN
        RAISE EXCEPTION '티켓 수는 0 이상이어야 해요.';
    END IF;
    IF p_mode NOT IN ('set', 'add', 'subtract') THEN
        RAISE EXCEPTION '알 수 없는 티켓 작업이에요: %', p_mode;
    END IF;

    UPDATE market_student
    SET ticket_count = CASE p_mode
        WHEN 'set' THEN p_amount
        WHEN 'add' THEN ticket_count + p_amount
        ELSE GREATEST(ticket_count - p_amount, 0)
    END
    WHERE id = ANY(p_student_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- p_students: [{ "name", "grade", "password", "ticket_count" }, ...]
CREATE OR REPLACE FUNCTION teacher_add_students(p_token TEXT, p_students jsonb)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count INT;
BEGIN
    PERFORM _assert_teacher(p_token);
    INSERT INTO market_student (name, grade, password, ticket_count)
    SELECT trim(x->>'name'),
           (x->>'grade')::int,
           COALESCE(NULLIF(trim(x->>'password'), ''), '1234'),
           GREATEST(COALESCE((x->>'ticket_count')::int, 0), 0)
    FROM jsonb_array_elements(p_students) AS x
    WHERE COALESCE(trim(x->>'name'), '') <> '';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION teacher_set_student_password(p_token TEXT, p_student_id BIGINT, p_password TEXT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    IF COALESCE(trim(p_password), '') = '' THEN
        RAISE EXCEPTION '새 비밀번호를 적어 주세요.';
    END IF;
    UPDATE market_student SET password = trim(p_password) WHERE id = p_student_id;
END;
$$;

CREATE OR REPLACE FUNCTION teacher_delete_student(p_token TEXT, p_student_id BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    DELETE FROM market_purchase WHERE student_id = p_student_id;
    DELETE FROM market_funding_participation WHERE student_id = p_student_id;
    DELETE FROM market_student WHERE id = p_student_id;
END;
$$;

-- ------------------------------------------
-- 6. 교사 작업 함수 — 상품
-- ------------------------------------------
-- p_items: [{ "name", "cost", "quantity", "link", "image_url" }, ...]
CREATE OR REPLACE FUNCTION teacher_add_items(p_token TEXT, p_items jsonb)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count INT;
BEGIN
    PERFORM _assert_teacher(p_token);
    INSERT INTO market_item (name, cost, quantity, link, image_url)
    SELECT trim(x->>'name'),
           GREATEST(COALESCE((x->>'cost')::int, 1), 1),
           GREATEST(COALESCE((x->>'quantity')::int, 0), 0),
           NULLIF(trim(x->>'link'), ''),
           NULLIF(trim(x->>'image_url'), '')
    FROM jsonb_array_elements(p_items) AS x
    WHERE COALESCE(trim(x->>'name'), '') <> '';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION teacher_update_item(p_token TEXT, p_item_id BIGINT, p_item jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    UPDATE market_item
    SET name = trim(p_item->>'name'),
        cost = GREATEST(COALESCE((p_item->>'cost')::int, 1), 1),
        quantity = GREATEST(COALESCE((p_item->>'quantity')::int, 0), 0),
        link = NULLIF(trim(p_item->>'link'), ''),
        image_url = NULLIF(trim(p_item->>'image_url'), '')
    WHERE id = p_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION teacher_delete_item(p_token TEXT, p_item_id BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    DELETE FROM market_item WHERE id = p_item_id;
END;
$$;

-- ------------------------------------------
-- 7. 교사 작업 함수 — 구매 내역
-- ------------------------------------------
CREATE OR REPLACE FUNCTION teacher_set_delivered(p_token TEXT, p_purchase_id BIGINT, p_delivered BOOLEAN)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    UPDATE market_purchase SET is_delivered = p_delivered WHERE id = p_purchase_id;
END;
$$;

-- 기록만 지움 (티켓·재고는 돌려주지 않음)
CREATE OR REPLACE FUNCTION teacher_delete_purchases(p_token TEXT, p_purchase_ids BIGINT[])
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_count INT;
BEGIN
    PERFORM _assert_teacher(p_token);
    DELETE FROM market_purchase WHERE id = ANY(p_purchase_ids);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- 구매 취소: 티켓과 재고를 돌려주고 기록 삭제 (예전 cancel_purchase_rpc 를 대신함)
DROP FUNCTION IF EXISTS cancel_purchase_rpc(INT);
CREATE OR REPLACE FUNCTION teacher_cancel_purchase(p_token TEXT, p_purchase_id BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_purchase RECORD;
    v_item_cost INT;
BEGIN
    PERFORM _assert_teacher(p_token);

    SELECT * INTO v_purchase FROM market_purchase WHERE id = p_purchase_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '구매 기록을 찾을 수 없습니다.';
    END IF;

    SELECT cost INTO v_item_cost FROM market_item WHERE id = v_purchase.item_id;

    UPDATE market_student SET ticket_count = ticket_count + COALESCE(v_item_cost, 0) WHERE id = v_purchase.student_id;
    UPDATE market_item SET quantity = quantity + 1 WHERE id = v_purchase.item_id;
    DELETE FROM market_purchase WHERE id = p_purchase_id;
END;
$$;

-- ------------------------------------------
-- 8. 교사 작업 함수 — 공동 펀딩
-- ------------------------------------------
-- p_funding_id 가 NULL 이면 새로 만들고, 있으면 고쳐요.
-- p_funding: { "title", "description", "target_amount", "image_url", "grade", "is_completed" }
CREATE OR REPLACE FUNCTION teacher_save_funding(p_token TEXT, p_funding_id BIGINT, p_funding jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    IF COALESCE((p_funding->>'target_amount')::int, 0) < 1 THEN
        RAISE EXCEPTION '목표는 1장 이상이어야 해요.';
    END IF;

    IF p_funding_id IS NULL THEN
        INSERT INTO market_funding (title, description, target_amount, current_amount, image_url, grade, is_completed)
        VALUES (
            trim(p_funding->>'title'),
            NULLIF(trim(p_funding->>'description'), ''),
            (p_funding->>'target_amount')::int,
            0,
            NULLIF(trim(p_funding->>'image_url'), ''),
            (p_funding->>'grade')::int,
            false
        );
    ELSE
        UPDATE market_funding
        SET title = trim(p_funding->>'title'),
            description = NULLIF(trim(p_funding->>'description'), ''),
            target_amount = (p_funding->>'target_amount')::int,
            image_url = NULLIF(trim(p_funding->>'image_url'), ''),
            grade = (p_funding->>'grade')::int,
            is_completed = COALESCE((p_funding->>'is_completed')::boolean, is_completed)
        WHERE id = p_funding_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION teacher_delete_funding(p_token TEXT, p_funding_id BIGINT)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    DELETE FROM market_funding WHERE id = p_funding_id;
END;
$$;

-- ------------------------------------------
-- 9. 학생 쪽 함수 정비
-- ------------------------------------------
-- 학생 로그인 (비밀번호 칸을 읽을 수 없으므로 이 함수로만 로그인)
DROP FUNCTION IF EXISTS verify_student_login(integer, text);
CREATE OR REPLACE FUNCTION verify_student_login(p_student_id INT, p_password TEXT)
RETURNS TABLE (id BIGINT, name TEXT, grade INT, ticket_count INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    SELECT s.id::bigint, s.name::text, s.grade::integer, s.ticket_count::integer
    FROM market_student s
    WHERE s.id = p_student_id AND s.password = p_password;
END;
$$;

-- 장바구니 결제: 가격은 브라우저가 보낸 값이 아니라 DB 값을 사용
CREATE OR REPLACE FUNCTION purchase_cart_items(p_student_id INT, p_items jsonb)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_line RECORD;
    v_item RECORD;
    v_total_cost INT := 0;
    v_student RECORD;
BEGIN
    IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION '장바구니가 비어 있습니다.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_to_recordset(p_items) AS x(id INT, quantity INT)
        WHERE x.id IS NULL OR x.quantity IS NULL OR x.quantity < 1
    ) THEN
        RAISE EXCEPTION '수량은 1 이상이어야 합니다.';
    END IF;

    -- 1. 상품 잠그고 재고 확인, 총액 계산 (같은 상품이 여러 줄이면 합쳐서)
    FOR v_line IN
        SELECT x.id, SUM(x.quantity)::int AS quantity
        FROM jsonb_to_recordset(p_items) AS x(id INT, quantity INT)
        GROUP BY x.id
    LOOP
        SELECT * INTO v_item FROM market_item WHERE id = v_line.id FOR UPDATE;
        IF NOT FOUND THEN
            RAISE EXCEPTION '상품(ID: %)을 찾을 수 없습니다.', v_line.id;
        END IF;
        IF v_item.quantity < v_line.quantity THEN
            RAISE EXCEPTION '상품(ID: %)의 재고가 부족합니다.', v_line.id;
        END IF;
        v_total_cost := v_total_cost + v_item.cost * v_line.quantity;
    END LOOP;

    -- 2. 학생 잔액 확인
    SELECT * INTO v_student FROM market_student WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '학생을 찾을 수 없습니다.';
    END IF;
    IF v_student.ticket_count < v_total_cost THEN
        RAISE EXCEPTION '티켓이 부족합니다. (필요: %, 보유: %)', v_total_cost, v_student.ticket_count;
    END IF;

    -- 3. 티켓 차감, 재고 차감, 구매 기록 작성
    UPDATE market_student SET ticket_count = ticket_count - v_total_cost WHERE id = p_student_id;

    FOR v_line IN
        SELECT x.id, SUM(x.quantity)::int AS quantity
        FROM jsonb_to_recordset(p_items) AS x(id INT, quantity INT)
        GROUP BY x.id
    LOOP
        UPDATE market_item SET quantity = quantity - v_line.quantity WHERE id = v_line.id;
        FOR i IN 1..v_line.quantity LOOP
            INSERT INTO market_purchase (student_id, item_id, timestamp, is_delivered)
            VALUES (p_student_id, v_line.id, NOW(), false);
        END LOOP;
    END LOOP;

    RETURN json_build_object(
        'status', 'success',
        'remaining_tickets', v_student.ticket_count - v_total_cost,
        'student', json_build_object(
            'id', p_student_id,
            'name', v_student.name,
            'grade', v_student.grade,
            'ticket_count', v_student.ticket_count - v_total_cost
        )
    );
END;
$$;

-- 쓰지 않는 예전 단일 구매 함수가 남아 있다면 웹에서 못 부르게
DO $$
BEGIN
    IF to_regprocedure('public.purchase_item(integer, integer)') IS NOT NULL THEN
        REVOKE EXECUTE ON FUNCTION public.purchase_item(integer, integer) FROM PUBLIC, anon, authenticated;
    END IF;
END $$;

-- ------------------------------------------
-- 10. 함수 실행 권한
-- ------------------------------------------
GRANT EXECUTE ON FUNCTION verify_teacher_login(TEXT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_logout(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_list_students(TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_set_tickets(TEXT, BIGINT[], TEXT, INT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_add_students(TEXT, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_set_student_password(TEXT, BIGINT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_delete_student(TEXT, BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_add_items(TEXT, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_update_item(TEXT, BIGINT, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_delete_item(TEXT, BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_set_delivered(TEXT, BIGINT, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_delete_purchases(TEXT, BIGINT[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_cancel_purchase(TEXT, BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_save_funding(TEXT, BIGINT, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_delete_funding(TEXT, BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_student_login(INT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION purchase_cart_items(INT, jsonb) TO anon, authenticated;

-- Supabase Data API 가 바뀐 내용을 바로 알아보도록
NOTIFY pgrst, 'reload schema';
