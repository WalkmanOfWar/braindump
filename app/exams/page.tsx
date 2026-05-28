"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { ExamCard } from "@/components/exam-card";
import { ExamModal } from "@/components/exam-modal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, GraduationCap } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import type { ExamWithSessions } from "@/types";
import type { Category } from "@/types";
import type { StudySession } from "@prisma/client";

type FilterTab = "active" | "past";

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamWithSessions | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("active");
  const searchParams = useSearchParams();
  const router = useRouter();

  const fetchData = useCallback(async () => {
    const [examsRes, catsRes] = await Promise.all([
      fetch("/api/exams"),
      fetch("/api/categories"),
    ]);
    if (examsRes.ok) setExams(await examsRes.json());
    if (catsRes.ok) setCategories(await catsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-open create modal when navigated from command palette (?new=1)
  useEffect(() => {
    if (searchParams.get("new") === "1" && !loading) {
      setEditingExam(null);
      setModalOpen(true);
      router.replace("/exams");
    }
  }, [searchParams, loading, router]);

  const handleToggleSession = async (
    examId: string,
    sessionId: string,
    done: boolean
  ) => {
    const res = await fetch(`/api/exams/${examId}/sessions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, done }),
    });
    if (res.ok) {
      setExams((prev) =>
        prev.map((exam) => {
          if (exam.id !== examId) return exam;
          return {
            ...exam,
            studySessions: exam.studySessions.map((s) =>
              s.id === sessionId ? { ...s, done } : s
            ),
          };
        })
      );
    }
  };

  const handleSessionRated = (
    examId: string,
    sessionId: string,
    confidence: number,
    notes: string,
    retrySession?: StudySession
  ) => {
    setExams((prev) =>
      prev.map((exam) => {
        if (exam.id !== examId) return exam;
        const updatedSessions = exam.studySessions.map((s) =>
          s.id === sessionId ? { ...s, confidence, notes } : s
        );
        // Append the auto-created retry session if present
        const sessions = retrySession
          ? [...updatedSessions, retrySession]
          : updatedSessions;
        return { ...exam, studySessions: sessions };
      })
    );
  };

  const handleSaveExam = (exam: ExamWithSessions) => {
    setExams((prev) => {
      const exists = prev.find((e) => e.id === exam.id);
      return exists
        ? prev.map((e) => (e.id === exam.id ? exam : e))
        : [...prev, exam];
    });
    setEditingExam(null);
  };

  const handleEditExam = (exam: ExamWithSessions) => {
    setEditingExam(exam);
    setModalOpen(true);
  };

  const handleDeleteExam = async (examId: string) => {
    const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
    if (res.ok) {
      setExams((prev) => prev.filter((e) => e.id !== examId));
      toast.success("Egzamin usunięty");
    } else {
      toast.error("Nie udało się usunąć egzaminu");
    }
  };

  const now = new Date();
  const filtered = exams.filter((e) =>
    filterTab === "active"
      ? new Date(e.examDate) >= now
      : new Date(e.examDate) < now
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Ładowanie…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <TopNavbar />

      <main className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Egzaminy</h1>
          <Button
            onClick={() => { setEditingExam(null); setModalOpen(true); }}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj egzamin
          </Button>
        </div>

        <Tabs value={filterTab} onValueChange={(v) => setFilterTab(v as FilterTab)} className="mb-6">
          <TabsList className="grid w-full grid-cols-2 sm:w-64">
            <TabsTrigger value="active">Nadchodzące</TabsTrigger>
            <TabsTrigger value="past">Przeszłe</TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onToggleSession={handleToggleSession}
                onDelete={handleDeleteExam}
                onEdit={handleEditExam}
                onSessionRated={handleSessionRated}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            emoji={filterTab === "active" ? "🎓" : "📖"}
            title={filterTab === "active" ? "Brak nadchodzących egzaminów" : "Brak przeszłych egzaminów"}
            description={
              filterTab === "active"
                ? "Dodaj egzamin i wygeneruj spersonalizowany plan nauki!"
                : "Jeszcze nie masz ukończonych egzaminów."
            }
            action={
              filterTab === "active"
                ? { label: "Dodaj egzamin", onClick: () => { setEditingExam(null); setModalOpen(true); } }
                : undefined
            }
          />
        )}
      </main>

      <BottomNav />

      <ExamModal
        open={modalOpen}
        onOpenChange={(v) => { setModalOpen(v); if (!v) setEditingExam(null); }}
        exam={editingExam}
        categories={categories}
        onSave={handleSaveExam}
        onCategoryCreated={(cat) => setCategories((prev) => [...prev, cat])}
      />
    </div>
  );
}
