-- ==========================================
-- 긴급 보안 조치: 교사 비밀번호 테이블 잠그기
-- ==========================================
-- Supabase Dashboard -> SQL Editor 에서 한 번 실행하세요.
-- 웹사이트는 market_teacher_auth 를 직접 읽지 않고 verify_teacher_login 함수(SECURITY DEFINER)로만
-- 확인하므로, 아래 조치 뒤에도 교사 로그인은 그대로 동작해요.
--
-- ⚠️ 이 테이블은 그동안 누구나 읽을 수 있었어요. 실행 후 교사 비밀번호를 꼭 새것으로 바꿔 주세요.
--    (아래 맨 끝 UPDATE 문의 '새비밀번호' 를 바꿔서 실행)

ALTER TABLE market_teacher_auth ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE market_teacher_auth FROM anon, authenticated;

-- 교사 비밀번호 바꾸기 (원하는 비밀번호로 고친 뒤 이 줄만 실행해도 돼요)
-- UPDATE market_teacher_auth SET password_hash = '새비밀번호', updated_at = NOW() WHERE id = 1;
