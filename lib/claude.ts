import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface TaskPriority {
  title: string;
  priority: number;
  note: string;
}

export async function prioritizeTasks(
  tasks: { title: string; deadline?: string }[]
): Promise<TaskPriority[]> {
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Oceń priorytety tych zadań (1-5). Odpowiedz TYLKO czystym JSON:
[{ "title": "...", "priority": 1-5, "note": "krótkie uzasadnienie" }]
Zadania: ${JSON.stringify(tasks)}`,
      },
    ],
  });
  const text = (msg.content[0] as { type: string; text: string }).text;
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as TaskPriority[];
}
