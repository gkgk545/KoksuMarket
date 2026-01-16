"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api, Student } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ChevronRight, School, User, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"grade" | "student" | "password">("grade");
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
          setError("Failed to load students.");
          setLoading(false);
        });
    }
  }, [selectedGrade]);

  const handleGradeSelect = (grade: number) => {
    setSelectedGrade(grade);
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
      // Store student info in localStorage (or context)
      localStorage.setItem("user", JSON.stringify(res.student));
      router.push("/market"); // Navigate to market
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Back button logic
  const goBack = () => {
    setError(null);
    if (step === "password") setStep("student");
    else if (step === "student") {
      setStep("grade");
      setSelectedGrade(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-900 dark:via-purple-900 dark:to-slate-900 overflow-hidden relative">

      {/* Abstract Background Shapes */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-2xl rounded-3xl p-8 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
            곡수마켓
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            곡수마켓에 오신 것을 환영합니다!
          </p>
        </div>

        <AnimatePresence mode="wait">
          {step === "grade" && (
            <motion.div
              key="grade"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <School className="w-5 h-5 text-purple-500" />
                학년을 선택하세요
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {[3, 4, 5, 6].map((grade) => (
                  <button
                    key={grade}
                    onClick={() => handleGradeSelect(grade)}
                    className="h-24 rounded-2xl bg-white dark:bg-slate-800 border-2 border-transparent hover:border-purple-500 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center gap-2 group"
                  >
                    <span className="text-3xl font-bold text-gray-700 dark:text-gray-200 group-hover:text-purple-600 group-hover:scale-110 transition-transform">{grade}</span>
                    <span className="text-xs text-gray-400">학년</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {step === "student" && (
            <motion.div
              key="student"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  이름을 선택하세요
                </h2>
                <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {loading ? (
                <div className="h-48 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 max-h-80 overflow-y-auto p-1 custom-scrollbar">
                  {students.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => handleStudentSelect(student)}
                      className="p-4 rounded-xl bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700 transition-colors text-left"
                    >
                      <span className="font-medium text-gray-700 dark:text-gray-200">{student.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {step === "password" && (
            <motion.div
              key="password"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-pink-500" />
                  비밀번호 입력
                </h2>
                <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="text-center p-4 bg-purple-50 dark:bg-slate-800/50 rounded-xl">
                <p className="text-sm text-gray-500">선택한 학생</p>
                <p className="text-lg font-bold text-gray-800 dark:text-white">{selectedStudent?.name} ({selectedStudent?.grade}학년)</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-transparent focus:border-purple-500 focus:bg-white dark:focus:bg-slate-700 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
                  autoFocus
                />
                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-bold shadow-lg hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "로그인"}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>

      {/* Teacher Link */}
      <div className="absolute bottom-6 flex gap-6 text-sm text-gray-500 font-medium">
        <a href="/teacher" className="hover:text-purple-600 transition-colors flex items-center gap-1">
          교사 페이지 <ChevronRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
