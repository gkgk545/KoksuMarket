"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import { api, Student } from "@/lib/api";
import styles from "./login.module.css";

type Step = "grade" | "student" | "password";

const GRADES = [3, 4, 5, 6];

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("grade");
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch students when grade is selected
  useEffect(() => {
    if (selectedGrade) {
      setLoading(true);
      api.getStudentsByGrade(selectedGrade)
        .then((data) => {
          setStudents(data);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError("학생 목록을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요.");
          setLoading(false);
        });
    }
  }, [selectedGrade]);

  const handleGradeSelect = (grade: number) => {
    setSelectedGrade(grade);
    setSelectedStudent(null);
    setStep("student");
    setError(null);
  };

  const handleStudentSelect = (student: Student) => {
    setSelectedStudent(student);
    setStep("password");
    setError(null);
    setPassword("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent || !password) return;

    setLoading(true);
    try {
      const res = await api.login(selectedStudent.id, password);
      localStorage.setItem("user", JSON.stringify(res.student));
      router.push("/market");
    } catch {
      setError("비밀번호가 달라요. 한 번 더 천천히 눌러 보세요.");
    } finally {
      setLoading(false);
    }
  };

  // Jump back to an earlier step from the stub or the back buttons
  const goTo = (target: Step) => {
    setError(null);
    if (target === "grade") {
      setSelectedGrade(null);
      setSelectedStudent(null);
    }
    if (target === "student") setSelectedStudent(null);
    setStep(target);
  };

  const fields: { step: Step; label: string; value: string | null; empty: string; enabled: boolean }[] = [
    { step: "grade", label: "학년", value: selectedGrade ? `${selectedGrade}학년` : null, empty: "고르기 전", enabled: true },
    { step: "student", label: "이름", value: selectedStudent?.name ?? null, empty: "고르기 전", enabled: !!selectedGrade },
    { step: "password", label: "비밀번호", value: password ? "●".repeat(Math.min(password.length, 6)) : null, empty: "입력 전", enabled: !!selectedStudent },
  ];

  return (
    <div className={styles.page}>
      <main className={styles.wrap}>
        <div className={styles.ticket}>
          <aside className={styles.stub} aria-label="입장권">
            <p className={styles.brand}>
              곡수마켓<small>우리 학교 티켓 가게</small>
            </p>
            <p className={styles.serial}>입장권 · {new Date().getFullYear()}</p>
            <ol className={styles.fields} aria-label="입장 단계">
              {fields.map((f) => (
                <li key={f.step}>
                  <button
                    type="button"
                    className={styles.field}
                    aria-current={step === f.step ? "step" : undefined}
                    disabled={!f.enabled || step === f.step}
                    onClick={() => goTo(f.step)}
                  >
                    <span className={styles.fieldKey}>{f.label}</span>
                    <span className={f.value ? styles.fieldValue : styles.fieldEmpty}>{f.value ?? f.empty}</span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <section className={styles.body} aria-live="polite">
            {step === "grade" && (
              <div className={styles.panel} key="grade">
                <div className={styles.stepHead}>
                  <h1>몇 학년이에요?</h1>
                </div>
                <div className={styles.grades} role="group" aria-label="학년">
                  {GRADES.map((grade) => (
                    <button key={grade} type="button" className={styles.grade} onClick={() => handleGradeSelect(grade)}>
                      <span className={styles.gradeInner}>
                        <b>{grade}</b>
                        <span>학년</span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === "student" && (
              <div className={styles.panel} key="student">
                <div className={styles.stepHead}>
                  <button type="button" className={styles.back} onClick={() => goTo("grade")}>
                    <ChevronLeft aria-hidden="true" />
                    학년
                  </button>
                  <h1>{selectedGrade}학년, 이름을 눌러요</h1>
                </div>
                {loading ? (
                  <p className={styles.loading}>이름을 불러오는 중…</p>
                ) : error ? (
                  <p className={styles.err} role="alert">
                    <CircleAlert aria-hidden="true" />
                    {error}
                  </p>
                ) : (
                  <>
                    <div className={styles.names} role="group" aria-label="이름">
                      {students.map((student) => (
                        <button key={student.id} type="button" className={styles.name} onClick={() => handleStudentSelect(student)}>
                          {student.name}
                        </button>
                      ))}
                    </div>
                    <p className={styles.note}>내 이름이 없으면 선생님께 말해 주세요.</p>
                  </>
                )}
              </div>
            )}

            {step === "password" && selectedStudent && (
              <form className={styles.panel} key="password" onSubmit={handleLogin} noValidate>
                <div className={styles.stepHead}>
                  <button type="button" className={styles.back} onClick={() => goTo("student")}>
                    <ChevronLeft aria-hidden="true" />
                    이름
                  </button>
                  <h1>비밀번호를 넣어요</h1>
                </div>
                <div className={styles.who}>
                  <b>{selectedStudent.name}</b>
                  <span>{selectedStudent.grade}학년</span>
                  <button type="button" onClick={() => goTo("student")}>내가 아니에요</button>
                </div>
                <label className={styles.label} htmlFor="pw">비밀번호</label>
                <input
                  id="pw"
                  className={styles.pw}
                  type="password"
                  autoComplete="current-password"
                  placeholder="비밀번호를 입력하세요"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby="pw-hint pw-err"
                  autoFocus
                />
                <p className={styles.hint} id="pw-hint">비밀번호를 잊었으면 선생님께 물어보세요.</p>
                {error && (
                  <p className={styles.err} id="pw-err" role="alert">
                    <CircleAlert aria-hidden="true" />
                    {error}
                  </p>
                )}
                <button type="submit" className={styles.go} disabled={loading || !password}>
                  {loading ? (
                    <span className={styles.spin} aria-label="확인 중" />
                  ) : (
                    <>
                      마켓 입장하기
                      <ChevronRight aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            )}
          </section>
        </div>
      </main>

      <nav className={styles.links} aria-label="다른 페이지">
        <a href="/ranking">
          마켓 랭킹 <ChevronRight aria-hidden="true" />
        </a>
        <a href="/teacher">
          교사 페이지 <ChevronRight aria-hidden="true" />
        </a>
      </nav>
    </div>
  );
}
