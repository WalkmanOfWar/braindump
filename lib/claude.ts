import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface TaskPriority {
  id: string;
  priority: number;
  note: string;
}

export interface ParsedTask {
  title: string;
  description: string | null;
  deadline: string | null;
  priority: number;
  categoryId: string | null;
  suggestedCategoryName: string | null;
}

// Static system prompt for prioritizeTasks — cached on first call, reused on subsequent calls.
const PRIORITIZE_SYSTEM = `Jesteś ekspertem w zarządzaniu czasem i produktywnością. Twoim zadaniem jest ocena priorytetów zadań użytkownika.

Zasady oceny priorytetu (1-5):
- 5 (krytyczny): deadline dziś lub jutro, wysokie konsekwencje za niewykonanie
- 4 (wysoki): deadline w ciągu 3 dni lub ważne zadanie bez konkretnej daty
- 3 (średni): deadline w ciągu tygodnia lub średniej ważności
- 2 (niski): deadline ponad tydzień lub małej wagi
- 1 (znikomy): brak presji czasowej, możliwe do pominięcia

Weź pod uwagę:
- Pilność (czy zbliża się termin)
- Ważność (potencjalny wpływ na życie/pracę użytkownika)
- Kontekst tytułu (np. "egzamin", "praca", "spotkanie" = ważniejsze niż "sprzątnąć")

Odpowiedz WYŁĄCZNIE czystym JSON — tablicą obiektów, bez żadnego markdown ani dodatkowego tekstu:
[{ "id": "dokładnie to samo co w zadaniu", "priority": 1-5, "note": "jedno zdanie po polsku dlaczego taki priorytet" }]

WAŻNE: Zachowaj pole "id" bez żadnych zmian. Odpowiedź musi być poprawnym JSON.`;

// Static system prompt for parseTaskFromText — cached on first call.
const PARSE_TASK_SYSTEM = `Jesteś inteligentnym asystentem do zarządzania zadaniami. Na podstawie nieformalnego opisu użytkownika wyciągasz dane do formularza tworzenia zadania.

Zasady parsowania:
- title: krótki, konkretny tytuł w bezokoliczniku lub rzeczowniku (max 60 znaków, bez cudzysłowów)
- description: dodatkowy kontekst z opisu jeśli jest przydatny dla wykonawcy; null jeśli opis nie wnosi nic poza tytułem
- deadline: format ISO "YYYY-MM-DDTHH:mm" (np. "2025-01-20T14:00"), null jeśli brak terminu
  • "jutro" → dzień następny względem today
  • "pojutrze" → today + 2 dni
  • "w piątek/środę/..." → najbliższy taki dzień tygodnia (jeśli today to ten dzień, weź za tydzień)
  • "za tydzień" → today + 7 dni
  • "rano" = 09:00, "południe" = 12:00, "po południu" = 15:00, "wieczorem" = 19:00
  • jeśli godzina nie podana → użyj 09:00
- priority: 1-5 (5=krytyczny). Oceń na podstawie pilności terminu i słów kluczowych ("pilne", "ważne", "egzamin", "praca" = wyższy)
- categoryId: id pasującej kategorii lub null jeśli żadna nie pasuje
- suggestedCategoryName: zaproponuj nazwę nowej kategorii jeśli żadna istniejąca nie pasuje, null jeśli użyłeś istniejącej lub brak kategorii

Odpowiedz WYŁĄCZNIE czystym JSON bez markdown:
{"title":"...","description":null,"deadline":null,"priority":3,"categoryId":null,"suggestedCategoryName":null}`;

export async function prioritizeTasks(
  tasks: { id: string; title: string; deadline?: string }[]
): Promise<TaskPriority[]> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [
      {
        type: "text",
        text: PRIORITIZE_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Zadania do oceny:\n${JSON.stringify(tasks)}`,
      },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as TaskPriority[];
}

// Static system prompt for batchParseTasksFromText — cached on first call.
const BATCH_PARSE_SYSTEM = `Jesteś asystentem do zarządzania zadaniami. Otrzymujesz ponumerowaną listę luźnych notatek i parseujesz każdą w strukturalne zadanie.

Zasady parsowania (identyczne jak dla pojedynczego zadania):
- title: krótki tytuł w bezokoliczniku lub rzeczowniku (max 60 znaków, bez cudzysłowów)
- description: dodatkowy kontekst jeśli jest przydatny; null jeśli nic nie wnosi poza tytułem
- deadline: format ISO "YYYY-MM-DDTHH:mm", null jeśli brak terminu
  • "jutro" → dzień następny, "pojutrze" → today + 2 dni
  • "w piątek/środę/..." → najbliższy taki dzień tygodnia
  • "za tydzień" → today + 7 dni, "za miesiąc" → today + 30 dni
  • "rano" = 09:00, "południe" = 12:00, "po południu" = 15:00, "wieczorem" = 19:00
  • brak godziny → 09:00
- priority: 1-5 (5=krytyczny, 1=znikomy); oceń na podstawie słów kluczowych i terminu
- categoryId: id pasującej kategorii z listy lub null
- suggestedCategoryName: krótka nazwa nowej kategorii jeśli żadna nie pasuje, null jeśli użyłeś istniejącej

Zwróć tablicę JSON — jeden element per linia wejściowa, w tej samej kolejności.
Dla pustych lub całkowicie nieczytelnych linii zwróć null zamiast obiektu.

Odpowiedz WYŁĄCZNIE czystym JSON — tablicą bez markdown ani dodatkowego tekstu:
[{"title":"...","description":null,"deadline":null,"priority":3,"categoryId":null,"suggestedCategoryName":null}, ...]`;

// Static prompt for generateWeeklyReview — cached on first call.
const WEEKLY_REVIEW_SYSTEM = `Jesteś coachem produktywności analizującym tygodniowe wyniki użytkownika polskojęzycznej aplikacji do zarządzania zadaniami i nauką.

Na podstawie danych tygodniowych napisz zwięzłe podsumowanie (4-6 zdań) zawierające:
1. Co poszło dobrze w tym tygodniu (ukończone zadania, sesje nauki)
2. Co wymaga uwagi (zaległe lub nieukończone zadania)
3. Konkretny plan / priorytety na następny tydzień

Styl: bezpośredni, motywujący, nie nadmiernie entuzjastyczny. Pisz po polsku, do drugiej osoby ("ukończyłeś/aś", "masz", "warto").
Odpowiedz WYŁĄCZNIE czystym tekstem — bez markdown, bez list, bez nagłówków.`;

export async function batchParseTasksFromText(
  lines: string[],
  categories: { id: string; name: string }[],
  today: string
): Promise<(ParsedTask | null)[]> {
  const categoriesJson =
    categories.length > 0
      ? JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name })))
      : "[]";

  const numbered = lines.map((l, i) => `${i + 1}. ${l}`).join("\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: BATCH_PARSE_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Dzisiaj jest: ${today}\nDostępne kategorie: ${categoriesJson}\n\nNotatki:\n${numbered}`,
      },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as (ParsedTask | null)[];
}

export async function generateWeeklyReview(context: {
  weekStart: string;
  weekEnd: string;
  completedTasks: { title: string; doneAt: string }[];
  missedTasks: { title: string; deadline: string }[];
  completedSessions: { topic: string; examTitle: string; hours: number }[];
  activeTasks: { title: string; deadline?: string; priority: number }[];
}): Promise<string> {
  const summary = `
Tydzień: ${context.weekStart} – ${context.weekEnd}
Ukończone zadania (${context.completedTasks.length}): ${context.completedTasks.map((t) => t.title).join(", ") || "brak"}
Nieukończone / zaległe zadania (${context.missedTasks.length}): ${context.missedTasks.map((t) => `${t.title} (termin: ${t.deadline})`).join(", ") || "brak"}
Sesje nauki ukończone (${context.completedSessions.length}): ${context.completedSessions.map((s) => `${s.topic} (${s.hours}h, ${s.examTitle})`).join(", ") || "brak"}
Aktywne zadania do następnego tygodnia (${context.activeTasks.length}): ${context.activeTasks.slice(0, 10).map((t) => `${t.title} [P${t.priority}]`).join(", ") || "brak"}
  `.trim();

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: WEEKLY_REVIEW_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: summary }],
  });

  return (msg.content[0] as { type: string; text: string }).text.trim();
}

// Static prompt for extractTasksFromProse — cached on first call.
const EXTRACT_PROSE_SYSTEM = `Jesteś asystentem do zarządzania zadaniami. Otrzymujesz dowolny tekst — może to być e-mail, notatka ze spotkania, fragment Slacka, wiadomość, lista, cokolwiek. Twoim zadaniem jest **wyodrębnić wszystkie ukryte action items** i zwrócić je jako tablicę zadań.

Zasady ekstrakcji:
- Szukaj wszystkiego co wymaga AKCJI od czytelnika (zrobić, wysłać, przygotować, zarezerwować, sprawdzić, zadzwonić, kupić, odpowiedzieć).
- Ignoruj kontekst, pozdrowienia, podpisy ("Pozdrawiam", "Dzięki!", "FYI", stopki maili), cytowane fragmenty.
- Jedna proza może dać 0, 1 lub wiele zadań — nie wymuszaj liczby.
- Jeśli brak action itemów, zwróć pustą tablicę [].

Dla każdego zadania:
- title: krótki tytuł w bezokoliczniku (max 60 znaków, bez cudzysłowów). Pisz "Przygotować raport", nie "Przygotuj raport".
- description: dodatkowy kontekst z tekstu źródłowego jeśli pomocny; null jeśli tytuł wystarcza.
- deadline: ISO "YYYY-MM-DDTHH:mm" jeśli wzmianka o terminie (do piątku, na koniec miesiąca, jutro itp.); null jeśli brak.
  • "jutro" → dzień następny 09:00, "pojutrze" → today+2 09:00
  • "do piątku/środy/..." → najbliższy taki dzień tygodnia 18:00 (jeśli today to ten dzień, weź za tydzień)
  • "za tydzień" → today+7 09:00, "za miesiąc" → today+30 09:00
  • "do końca tygodnia" → najbliższa niedziela 18:00, "do końca miesiąca" → ostatni dzień miesiąca 18:00
  • "rano" = 09:00, "po południu" = 15:00, "wieczorem" = 19:00, "ASAP/pilnie" = today 18:00
- priority: 1-5 oceniaj słowa kluczowe + ton:
  • 5: "pilnie", "asap", "krytyczne", "natychmiast", deadline dziś/jutro
  • 4: "ważne", "do jutra"/"do końca tygodnia", obowiązek z konsekwencjami
  • 3: typowe (default)
  • 2: "kiedyś", "jak będziesz miał czas"
  • 1: "ewentualnie", "może", luźne sugestie
- categoryId: id pasującej kategorii z listy lub null
- suggestedCategoryName: nazwa nowej kategorii jeśli żadna nie pasuje, null w przeciwnym razie

Zwróć WYŁĄCZNIE czystą tablicę JSON bez markdown, bez tekstu wstępnego, bez komentarzy:
[{"title":"...","description":null,"deadline":null,"priority":3,"categoryId":null,"suggestedCategoryName":null}]`;

export interface ExtractedTask {
  title: string;
  description: string | null;
  deadline: string | null;
  priority: number;
  categoryId: string | null;
  suggestedCategoryName: string | null;
}

export async function extractTasksFromProse(
  text: string,
  categories: { id: string; name: string }[],
  today: string
): Promise<ExtractedTask[]> {
  const catsJson = categories.length > 0 ? JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name }))) : "[]";

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [
      {
        type: "text",
        text: EXTRACT_PROSE_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Dzisiaj jest: ${today}\nDostępne kategorie: ${catsJson}\n\nTekst:\n${text}`,
      },
    ],
  });

  const responseText = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(responseText.replace(/```json|```/g, "").trim()) as ExtractedTask[];
}

// ─── Quiz generation ─────────────────────────────────────────────────────────

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correct: number; // 0–3
  explanation: string;
}

const QUIZ_SYSTEM = `Jesteś nauczycielem akademickim tworzącym pytania sprawdzające wiedzę.
Generujesz pytania wielokrotnego wyboru (MCQ) z 4 opcjami na podstawie podanego tematu i egzaminu.

Zasady:
- Pytania muszą dotyczyć KONKRETNEJ wiedzy z tematu (fakty, definicje, zrozumienie)
- Każda opcja powinna być realistyczna (żadnych oczywistych błędnych odpowiedzi)
- Jedno pytanie = jedna wyraźna poprawna odpowiedź
- explanation: 1-2 zdania dlaczego to jest poprawna odpowiedź
- Pisz po polsku, zwięźle

Odpowiedz WYŁĄCZNIE czystym JSON — tablicą bez markdown:
[{"question":"...","options":["a","b","c","d"],"correct":0,"explanation":"..."}]`;

export async function generateQuiz(
  topic: string,
  examTitle: string,
  count = 5
): Promise<QuizQuestion[]> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: [{ type: "text", text: QUIZ_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Egzamin: ${examTitle}\nTemat sesji nauki: ${topic}\nLiczba pytań: ${count}\n\nWygeneruj ${count} pytań MCQ.`,
      },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as QuizQuestion[];
}

// ─── Study prompts (Elaborative Interrogation + Concrete Examples) ───────────

const STUDY_PROMPTS_SYSTEM = `Jesteś tutorem akademickim. Dla podanego tematu egzaminu generujesz dwa zestawy:
1. Pytania pogłębiające (Elaborative Interrogation) — pytania "Dlaczego?", "Jak?", "Skąd to wynika?" które zmuszają do aktywnego myślenia
2. Konkretne przykłady — 2-3 przykłady z życia codziennego lub praktyki ilustrujące abstrakcyjne pojęcia

Zasady:
- Pytania: 3-4 pytania, każde zaczyna się od "Dlaczego", "Jak", "Co łączy", "Skąd", "W jaki sposób"
- Przykłady: krótkie, konkretne, zrozumiałe, powiązane z tematem
- Pisz po polsku, zwięźle

Odpowiedz WYŁĄCZNIE czystym JSON:
{"questions":["...","...","..."],"examples":["...","...","..."]}`;

export async function generateStudyPrompts(
  topic: string,
  examTitle: string
): Promise<{ questions: string[]; examples: string[] }> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: [{ type: "text", text: STUDY_PROMPTS_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Egzamin: ${examTitle}\nTemat: ${topic}`,
      },
    ],
  });
  const text = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as { questions: string[]; examples: string[] };
}

// ─── Feynman reflection evaluation ──────────────────────────────────────────

const REFLECTION_SYSTEM = `Jesteś tutorem akademickim oceniającym wyjaśnienie tematu techniką Feynmana.
Uczeń właśnie ukończył sesję nauki i wyjaśnia temat własnymi słowami.

Twoja odpowiedź powinna:
1. Podkreślić co zostało dobrze wyjaśnione (1-2 zdania)
2. Wskazać konkretne luki lub błędy w rozumieniu (jeśli są)
3. Zaproponować jedno konkretne zagadnienie do pogłębienia

Styl: bezpośredni, konstruktywny, motywujący. Pisz po polsku, do drugiej osoby.
Długość: 3-5 zdań. Odpowiedz WYŁĄCZNIE tekstem — bez markdown, bez list.`;

export async function evaluateReflection(topic: string, reflection: string): Promise<string> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: [{ type: "text", text: REFLECTION_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: `Temat sesji: ${topic}\n\nWyjaśnienie ucznia:\n${reflection}`,
      },
    ],
  });
  return (msg.content[0] as { type: string; text: string }).text.trim();
}

export async function parseTaskFromText(
  input: string,
  categories: { id: string; name: string }[],
  today: string
): Promise<ParsedTask> {
  const categoriesJson =
    categories.length > 0
      ? JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name })))
      : "[]";

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    system: [
      {
        type: "text",
        text: PARSE_TASK_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Dzisiaj jest: ${today}\nDostępne kategorie: ${categoriesJson}\n\nOpis zadania: "${input}"`,
      },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as ParsedTask;
}
