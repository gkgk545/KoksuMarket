-- ==========================================
-- 공동 펀딩 학년 구분 SQL 스크립트
-- ==========================================
-- 이 스크립트를 Supabase Dashboard -> SQL Editor에 복사하여 한 번 실행하세요.
-- grade 가 NULL 인 펀딩은 "전체 학년" 펀딩으로, 모든 학생에게 보여요.

-- 1. 펀딩에 대상 학년 컬럼 추가
ALTER TABLE market_funding ADD COLUMN IF NOT EXISTS grade INT;

-- 2. 기존 펀딩은 제목의 "○학년"으로 학년을 채워 넣기 (예: "5학년 김킷(3차)" -> 5)
UPDATE market_funding
SET grade = substring(title FROM '([3-6])학년')::int
WHERE grade IS NULL
  AND title ~ '[3-6]학년';

-- 3. 펀딩 참여 RPC: 다른 학년 펀딩에는 참여할 수 없도록 서버에서도 막기
CREATE OR REPLACE FUNCTION participate_funding(p_student_id INT, p_funding_id INT, p_amount INT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_funding RECORD;
    v_student RECORD;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION '참여할 티켓 수는 1 이상이어야 합니다.';
    END IF;

    -- 1. 학생 확보 (잠금)
    SELECT * INTO v_student FROM market_student WHERE id = p_student_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '학생을 찾을 수 없습니다.';
    END IF;

    IF v_student.ticket_count < p_amount THEN
        RAISE EXCEPTION '티켓이 부족합니다.';
    END IF;

    -- 2. 펀딩 확보 (잠금)
    SELECT * INTO v_funding FROM market_funding WHERE id = p_funding_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION '펀딩을 찾을 수 없습니다.';
    END IF;

    IF v_funding.is_completed THEN
        RAISE EXCEPTION '이미 종료된 펀딩입니다.';
    END IF;

    IF v_funding.grade IS NOT NULL AND v_funding.grade <> v_student.grade THEN
        RAISE EXCEPTION '우리 학년 펀딩에만 참여할 수 있어요.';
    END IF;

    -- 3. 학생 티켓 차감
    UPDATE market_student
    SET ticket_count = ticket_count - p_amount
    WHERE id = p_student_id
    RETURNING id, name, grade, ticket_count INTO v_student;

    -- 4. 펀딩 모금액 증가
    UPDATE market_funding
    SET current_amount = current_amount + p_amount
    WHERE id = p_funding_id;

    -- 5. 참여 기록 작성
    INSERT INTO market_funding_participation (funding_id, student_id, amount, timestamp)
    VALUES (p_funding_id, p_student_id, p_amount, NOW());

    RETURN row_to_json(v_student);
END;
$$;

GRANT EXECUTE ON FUNCTION participate_funding(INT, INT, INT) TO anon, authenticated, service_role;

-- 4. Supabase Data API 가 새 컬럼을 바로 알아보도록 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
