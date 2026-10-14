import type { Turn } from "./conversation";

type Suggestion = { label: string; prompt: string };

export function suggestionsForTurn(turn?: Turn): Suggestion[] {
  if (!turn?.answer) return [
    { label: "Prepare for a mine visit", prompt: "How should I prepare for my first mine visit?" },
    { label: "Build an officer briefing", prompt: "What should a newly transferred mine officer check first?" },
    { label: "Explore accident lessons", prompt: "What can mine officers learn from historical SANKET accidents?" },
  ];
  // Use the latest response, never scan broad keywords across old exchanges.
  const generated = turn.answer.suggestions;
  if (Array.isArray(generated)) {
    const valid = generated.filter(item => item && typeof item.label === "string" && typeof item.prompt === "string" && item.label.trim() && item.prompt.trim());
    if (valid.length) return valid.slice(0, 3);
  }
  // Older saved answers and book-only responses have no generated suggestions.
  // Derive useful prompts from their actual content rather than a fixed hazard menu.
  const questions = turn.answer.questions.slice(0, 2).map(question => ({
    label: question.length > 65 ? question.slice(0, 62) + "…" : question,
    prompt: `For my question "${turn.question.slice(0, 180)}", explain how to verify: ${question}`,
  }));
  const topic = turn.answer.title.replace(/[.!?]+$/, "").slice(0, 65);
  const candidates = [...questions,
    { label: `Checklist: ${topic}`.slice(0, 65), prompt: `Turn your answer about "${turn.question.slice(0, 180)}" into a concise practical checklist.` },
    { label: `Key risks: ${topic}`.slice(0, 65), prompt: `For "${turn.question.slice(0, 180)}", explain the most important risks and how to recognize them.` },
    { label: "Explain the reasoning", prompt: `Explain the reasoning behind your most important recommendation for "${turn.question.slice(0, 180)}".` },
  ];
  return candidates.slice(0, 3);
}
