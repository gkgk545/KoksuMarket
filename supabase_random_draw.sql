-- ==========================================
-- 랜덤 상품 돌림판 (랜덤 봉지과자 1~10번, 랜덤 비스켓 1~20번)
-- ==========================================
-- supabase_security.sql 을 실행한 뒤에 Supabase Dashboard -> SQL Editor 에서 한 번 실행하세요.
-- 여러 번 실행해도 안전해요. (이미 뽑은 기록은 지워지지 않아요)
--
-- 이 스크립트가 하는 일
--  1. 뽑은 번호 표(market_random_draw)를 만들어요. 같은 상품에서 같은 번호는 한 번만 들어가요.
--  2. 교사 화면에서 쓰는 함수 네 개를 만들어요. 모두 교사 로그인 토큰을 확인해요.
--     - teacher_list_random_draws : 상품별로 뽑은 번호 (뽑은 순서)
--     - teacher_draw_random       : 남은 번호 중 하나를 DB가 골라 기록하고 돌려줘요
--     - teacher_undo_random_draw  : 마지막으로 뽑은 번호 하나를 되돌려요
--     - teacher_reset_random_draw : 그 상품의 기록을 모두 지워 1번부터 다시 나오게 해요
--
-- 번호는 DB가 골라요. 교사 컴퓨터 두 대에서 동시에 눌러도 같은 번호가 두 번 나오지 않아요.
-- 상품을 늘리거나 번호 개수를 바꾸려면 _random_draw_size 와 웹사이트의 POOLS(lib/randomDraw.ts)를 함께 고쳐 주세요.

-- ------------------------------------------
-- 1. 뽑은 번호 표
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS market_random_draw (
    id BIGSERIAL PRIMARY KEY,
    pool TEXT NOT NULL CHECK (pool IN ('bag', 'biscuit')),   -- bag: 랜덤 봉지과자, biscuit: 랜덤 비스켓
    number INT NOT NULL CHECK (number >= 1),
    drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (pool, number)
);

-- 교사 함수로만 읽고 써요. 공개 키로는 볼 수도 고칠 수도 없어요.
ALTER TABLE market_random_draw ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE market_random_draw FROM anon, authenticated;
REVOKE ALL ON SEQUENCE market_random_draw_id_seq FROM anon, authenticated;

-- 상품별 번호 개수
CREATE OR REPLACE FUNCTION _random_draw_size(p_pool TEXT)
RETURNS INT
LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE p_pool WHEN 'bag' THEN 10 WHEN 'biscuit' THEN 20 END;
$$;
REVOKE ALL ON FUNCTION _random_draw_size(TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION _random_draw_history(p_pool TEXT)
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT COALESCE(json_agg(number ORDER BY drawn_at, id), '[]'::json)
    FROM market_random_draw
    WHERE pool = p_pool;
$$;
REVOKE ALL ON FUNCTION _random_draw_history(TEXT) FROM PUBLIC, anon, authenticated;

-- ------------------------------------------
-- 2. 교사 함수
-- ------------------------------------------

-- { "bag": [3, 7], "biscuit": [12] }
CREATE OR REPLACE FUNCTION teacher_list_random_draws(p_token TEXT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    RETURN json_build_object(
        'bag', _random_draw_history('bag'),
        'biscuit', _random_draw_history('biscuit')
    );
END;
$$;

-- 남은 번호 중 하나를 골라 기록해요. { "number": 7, "drawn": [3, 7] }
-- 남은 번호가 없으면 'RANDOM_DRAW_EMPTY:' 로 시작하는 오류를 내요.
CREATE OR REPLACE FUNCTION teacher_draw_random(p_token TEXT, p_pool TEXT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_size INT := _random_draw_size(p_pool);
    v_pick INT;
BEGIN
    PERFORM _assert_teacher(p_token);
    IF v_size IS NULL THEN
        RAISE EXCEPTION '알 수 없는 상품이에요: %', p_pool;
    END IF;

    -- 같은 상품을 동시에 뽑으면 차례대로 처리해요
    PERFORM pg_advisory_xact_lock(hashtext('market_random_draw:' || p_pool));

    SELECT n INTO v_pick
    FROM generate_series(1, v_size) AS n
    WHERE NOT EXISTS (SELECT 1 FROM market_random_draw d WHERE d.pool = p_pool AND d.number = n)
    ORDER BY random()
    LIMIT 1;

    IF v_pick IS NULL THEN
        RAISE EXCEPTION 'RANDOM_DRAW_EMPTY: 모든 번호를 뽑았어요. 다시 채운 뒤에 뽑아 주세요.';
    END IF;

    INSERT INTO market_random_draw (pool, number) VALUES (p_pool, v_pick);

    RETURN json_build_object('number', v_pick, 'drawn', _random_draw_history(p_pool));
END;
$$;

-- 마지막으로 뽑은 번호 하나를 되돌려요. 남은 기록(뽑은 순서)을 돌려줘요.
CREATE OR REPLACE FUNCTION teacher_undo_random_draw(p_token TEXT, p_pool TEXT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    PERFORM pg_advisory_xact_lock(hashtext('market_random_draw:' || p_pool));

    DELETE FROM market_random_draw
    WHERE id = (
        SELECT id FROM market_random_draw
        WHERE pool = p_pool
        ORDER BY drawn_at DESC, id DESC
        LIMIT 1
    );

    RETURN _random_draw_history(p_pool);
END;
$$;

-- 그 상품의 기록을 모두 지워요.
CREATE OR REPLACE FUNCTION teacher_reset_random_draw(p_token TEXT, p_pool TEXT)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM _assert_teacher(p_token);
    PERFORM pg_advisory_xact_lock(hashtext('market_random_draw:' || p_pool));

    DELETE FROM market_random_draw WHERE pool = p_pool;

    RETURN '[]'::json;
END;
$$;

GRANT EXECUTE ON FUNCTION teacher_list_random_draws(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_draw_random(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_undo_random_draw(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION teacher_reset_random_draw(TEXT, TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
