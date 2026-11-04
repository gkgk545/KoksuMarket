-- ==========================================
-- 학생 마켓 임시 휴업 (리뉴얼 중 문 닫기)
-- ==========================================
-- supabase_security.sql 을 실행한 뒤에 Supabase Dashboard -> SQL Editor 에서 한 번 실행하세요.
-- 여러 번 실행해도 안전해요.
--
-- 이 스크립트가 하는 일
--  1. 마켓 설정 표(market_setting)를 만들어요. 행은 항상 하나(id = 1)예요.
--  2. 교사 화면에서 휴업을 켜고 끄는 함수(teacher_set_market_closure)를 만들어요. 교사 로그인 토큰을 확인해요.
--  3. 휴업 중에는 DB가 구매·펀딩 참여 기록을 받지 않아요. (화면을 우회해도 살 수 없어요)
--     교사의 구매 취소·삭제 같은 작업은 그대로 할 수 있어요.
--
-- 마켓 랭킹과 교사 페이지는 휴업 중에도 열려 있어요.
-- 다시 여는 날짜는 학생에게 보여 주는 안내예요. 날짜가 지나도 저절로 열리지는 않으니
-- 교사 대시보드에서 '다시 열기'를 눌러 주세요.

-- ------------------------------------------
-- 1. 설정 표
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS market_setting (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    is_closed BOOLEAN NOT NULL DEFAULT false,
    reopen_date DATE,          -- 다시 여는 날 (비우면 '아직 정하지 않음')
    reopen_time TIME,          -- 다시 여는 시각 (비우면 날짜만 안내)
    message TEXT,              -- 학생에게 보여 줄 한마디
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO market_setting (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE market_setting ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE market_setting FROM anon, authenticated;
GRANT SELECT ON TABLE market_setting TO anon, authenticated;

DROP POLICY IF EXISTS public_read ON market_setting;
CREATE POLICY public_read ON market_setting FOR SELECT TO anon, authenticated USING (true);

-- ------------------------------------------
-- 2. 교사: 휴업 켜기 / 끄기
-- ------------------------------------------
CREATE OR REPLACE FUNCTION teacher_set_market_closure(
    p_token TEXT,
    p_closed BOOLEAN,
    p_reopen_date DATE DEFAULT NULL,
    p_reopen_time TIME DEFAULT NULL,
    p_message TEXT DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_row market_setting;
BEGIN
    PERFORM _assert_teacher(p_token);

    INSERT INTO market_setting (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

    UPDATE market_setting
    SET is_closed = COALESCE(p_closed, false),
        reopen_date = p_reopen_date,
        reopen_time = CASE WHEN p_reopen_date IS NULL THEN NULL ELSE p_reopen_time END,
        message = NULLIF(left(trim(COALESCE(p_message, '')), 200), ''),
        updated_at = NOW()
    WHERE id = 1
    RETURNING * INTO v_row;

    RETURN row_to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION teacher_set_market_closure(TEXT, BOOLEAN, DATE, TIME, TEXT) TO anon, authenticated;

-- ------------------------------------------
-- 3. 휴업 중에는 구매·펀딩 참여를 받지 않기
-- ------------------------------------------
-- purchase_cart_items / participate_funding 안에서 기록을 쓰는 순간 막혀서, 티켓 차감도 함께 취소돼요.
-- 'MARKET_CLOSED:' 앞부분은 웹사이트가 휴업 화면으로 바꾸는 신호로 써요.
CREATE OR REPLACE FUNCTION _block_when_market_closed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM market_setting WHERE id = 1 AND is_closed) THEN
        RAISE EXCEPTION 'MARKET_CLOSED: 지금은 마켓이 잠시 쉬고 있어요. 다시 열면 살 수 있어요.';
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION _block_when_market_closed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_when_market_closed ON market_purchase;
CREATE TRIGGER block_when_market_closed
    BEFORE INSERT ON market_purchase
    FOR EACH ROW EXECUTE FUNCTION _block_when_market_closed();

DROP TRIGGER IF EXISTS block_when_market_closed ON market_funding_participation;
CREATE TRIGGER block_when_market_closed
    BEFORE INSERT ON market_funding_participation
    FOR EACH ROW EXECUTE FUNCTION _block_when_market_closed();

NOTIFY pgrst, 'reload schema';
