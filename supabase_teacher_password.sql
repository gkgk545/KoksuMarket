-- ==========================================
-- 교사 비밀번호 바꾸기 함수
-- ==========================================
-- supabase_security.sql 을 실행한 뒤에 Supabase Dashboard -> SQL Editor 에서 한 번 실행하세요.
-- (새 비밀번호를 bcrypt 해시로 저장하므로, 해시를 알아보는 새 로그인 함수가 먼저 있어야 해요.)
--
-- 교사 로그인 화면의 '비밀번호 바꾸기'에서 불러요. 지금 비밀번호가 맞아야만 바뀌고,
-- 바뀌면 모든 기기의 교사 로그인이 풀려요.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION change_teacher_password(p_current TEXT, p_new TEXT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_id INT;
    v_hash TEXT;
    v_ok BOOLEAN;
BEGIN
    IF p_new IS NULL OR length(p_new) < 4 THEN
        RETURN json_build_object('status', 'fail', 'reason', 'too_short');
    END IF;

    SELECT id, password_hash INTO v_id, v_hash FROM market_teacher_auth ORDER BY id LIMIT 1 FOR UPDATE;

    IF v_hash IS NULL OR p_current IS NULL OR p_current = '' THEN
        v_ok := false;
    ELSIF v_hash LIKE '$2%' THEN
        v_ok := v_hash = crypt(p_current, v_hash);
    ELSE
        v_ok := v_hash = p_current;
    END IF;

    IF NOT v_ok THEN
        PERFORM pg_sleep(1); -- 비밀번호 마구 넣어 보기를 느리게
        RETURN json_build_object('status', 'fail', 'reason', 'wrong_password');
    END IF;

    UPDATE market_teacher_auth
    SET password_hash = crypt(p_new, gen_salt('bf')), updated_at = NOW()
    WHERE id = v_id;

    -- 예전 비밀번호로 들어와 있던 모든 기기 로그아웃
    -- (Supabase는 API로 부른 함수에서 WHERE 없는 DELETE를 막으므로 WHERE true 를 붙여요)
    DELETE FROM market_teacher_session WHERE true;

    RETURN json_build_object('status', 'success');
END;
$$;

GRANT EXECUTE ON FUNCTION change_teacher_password(TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
