"use client";

import { useState, useEffect, useCallback } from "react";
import { TopNavbar } from "@/components/top-navbar";
import { BottomNav } from "@/components/bottom-nav";
import { ExamCard } from "@/components/exam-card";
import { ExamModal } from "@/components/exam-modal";
import { Button } from "@/components/ui/button";
import { Plus, GraduationCap } from "lucide-react";
import type { ExamWithSessions } from "@/types";
import type { Category } from "@/types";

export default function ExamsPage() {
  const [exams, setExams] = useState<ExamWithSessions[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleSaveExam = (exam: ExamWithSessions) => {
    setExams((prev) => [...prev, exam]);
  };

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
            onClick={() => setModalOpen(true)}
            className="bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj egzamin
          </Button>
        </div>

        {exams.length > 0 ? (
          <div className="space-y-4">
            {exams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                onToggleSession={handleToggleSession}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mb-4">
              <GraduationCap className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              Brak egzaminów
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Dodaj egzamin i wygeneruj plan nauki!
            </p>
            <Button
              onClick={() => setModalOpen(true)}
              className="bg-accent text-accent-foreground hover:bg-accent/90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Dodaj egzamin
            </Button>
          </div>
        )}
      </main>

      <BottomNav />

      <ExamModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        categories={categories}
        onSave={handleSaveExam}
      />
    </div>
  );
}
