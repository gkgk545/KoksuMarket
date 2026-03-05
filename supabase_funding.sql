-- 1. 펀딩(공동 구매) 테이블 생성
CREATE TABLE market_funding (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    target_amount INT NOT NULL,
    current_amount INT DEFAULT 0,
    image_url TEXT,
    deadline TIMESTAMP WITH TIME ZONE,
    is_completed BOOLEAN DEFAULT false
);

-- 2. 펀딩 참여 기록 테이블 생성
CREATE TABLE market_funding_participation (
    id SERIAL PRIMARY KEY,
    funding_id INT REFERENCES market_funding(id) ON DELETE CASCADE,
    student_id INT REFERENCES market_student(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 펀딩 참여용 트랜잭션 RPC 함수 (동시성 방어 및 티켓 차감)
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
