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

export async function prioritizeTasks(
  tasks: { id: string; title: string; deadline?: string }[]
): Promise<TaskPriority[]> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Oceń priorytety tych zadań (1-5). Odpowiedz TYLKO czystym JSON, zachowaj pole "id" bez zmian:
[{ "id": "...", "priority": 1-5, "note": "krótkie uzasadnienie" }]
Zadania: ${JSON.stringify(tasks)}`,
      },
    ],
  });
  const text = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as TaskPriority[];
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
    messages: [
      {
        role: "user",
        content: `Jesteś asystentem do zarządzania zadaniami. Na podstawie krótkiego opisu wyciągnij dane do formularza.

Dzisiaj jest: ${today}
Dostępne kategorie: ${categoriesJson}

Opis: "${input}"

Zasady:
- title: krótki, konkretny tytuł (max 60 znaków)
- description: dodaj kontekst z opisu jeśli jest przydatny, null jeśli zbędny
- deadline: format "YYYY-MM-DDTHH:mm", null jeśli brak terminu. Słowo "piątek/środa/..." = najbliższy taki dzień tygodnia. "jutro" = ${today} + 1 dzień
- priority: 1-5 (5=krytyczny). Oceń na podstawie pilności i kontekstu
- categoryId: id pasującej kategorii lub null
- suggestedCategoryName: nazwa nowej kategorii jeśli żadna istniejąca nie pasuje, null jeśli pasuje istniejąca lub brak kategorii
Odpowiedz TYLKO czystym JSON bez markdown:
{"title":"...","description":null,"deadline":null,"priority":3,"categoryId":null,"suggestedCategoryName":null}`,
      },
    ],
  });

  const text = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as ParsedTask;
}
