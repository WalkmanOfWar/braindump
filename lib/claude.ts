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
