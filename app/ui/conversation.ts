import type { Answer, MineProfile, Source } from "../../lib/knowledge";

export type HistoryMessage = { role: "user" | "assistant"; text: string };
export type Turn = {
  id: string;
  question: string;
  profile: MineProfile;
  briefing: boolean;
  history: HistoryMessage[];
  answer?: Answer;
  error?: string;
};

export const initialProfile: MineProfile = {
  name: "",
  sector: "all",
  method: "Not specified",
  mineType: "unspecified",
  gassiness: "unspecified",
  conditions: "",
};
export const workingMethods = [
  "Not specified",
  "Opencast",
  "Underground",
  "Oil / workover",
  "Surface facilities",
];

export function normalizeProfile(value: unknown): MineProfile {
  if (!value || typeof value !== "object") return { ...initialProfile };
  const input = value as Record<string, unknown>;
  return {
    name: typeof input.name === "string" ? input.name.trim().slice(0, 80) : "",
    sector:
      input.sector === "coal" || input.sector === "noncoal"
        ? input.sector
        : "all",
    method:
      typeof input.method === "string" && workingMethods.includes(input.method)
        ? input.method
        : "Not specified",
    mineType:
      input.mineType === "underground-coal" ||
      input.mineType === "opencast-coal" ||
      input.mineType === "metal-mine"
        ? input.mineType
        : "unspecified",
    gassiness:
      input.gassiness === "degree-i" ||
      input.gassiness === "degree-ii" ||
      input.gassiness === "degree-iii" ||
      input.gassiness === "non-gassy"
        ? input.gassiness
        : "unspecified",
    conditions:
      typeof input.conditions === "string"
        ? input.conditions.trim().slice(0, 1200)
        : "",
  };
}

export function conversationHistory(turns: Turn[]): HistoryMessage[] {
  return turns
    .filter((turn) => turn.answer && !turn.error)
    .slice(-3)
    .flatMap((turn) => [
      { role: "user" as const, text: turn.question.slice(0, 1800) },
      {
        role: "assistant" as const,
        text: [
          turn.answer!.lead,
          ...turn.answer!.findings.map((finding) => finding.text),
          ...turn.answer!.actions.map((action) => action.text),
        ]
          .join(" ")
          .slice(0, 1800),
      },
    ]);
}

export function isSource(value: unknown): value is Source {
  if (!value || typeof value !== "object") return false;
  const source = value as Record<string, unknown>;
  return (
    ["id", "title", "text", "reference", "url"].every(
      (key) => typeof source[key] === "string",
    ) &&
    typeof source.page === "number" &&
    Number.isInteger(source.page) &&
    source.page > 0 &&
    typeof source.endPage === "number" &&
    source.endPage >= source.page &&
    /^\/sources\/SANKET_(Coal|NonCoal)\.pdf#page=\d+$/.test(
      source.url as string,
    )
  );
}

export function isAnswer(value: unknown): value is Answer {
  if (!value || typeof value !== "object") return false;
  const answer = value as Record<string, unknown>;
  const evidence = (items: unknown) =>
    Array.isArray(items) &&
    items.every(
      (item) =>
        item &&
        typeof item.text === "string" &&
        Array.isArray(item.citations) &&
        item.citations.every((id: unknown) => typeof id === "string"),
    );
  return (
    typeof answer.title === "string" &&
    typeof answer.lead === "string" &&
    typeof answer.mode === "string" &&
    evidence(answer.findings) &&
    evidence(answer.actions) &&
    Array.isArray(answer.questions) &&
    answer.questions.every((question) => typeof question === "string") &&
    Array.isArray(answer.sources) &&
    answer.sources.every(isSource) &&
    (answer.notice === undefined || typeof answer.notice === "string")
  );
}

export function answerText(
  answer: Answer,
  question: string,
  origin: string,
): string {
  const lines = (items: Answer["findings"]) =>
    items
      .map(
        (item) =>
          `- ${item.text}${item.citations.length ? ` [${item.citations.join(", ")}]` : ""}`,
      )
      .join("\n\n");
  return [
    `SANKET — ${answer.title}`,
    `Question: ${question}`,
    answer.lead,
    ...(answer.actions.length
      ? [`Proposed prevention actions\n${lines(answer.actions)}`]
      : []),
    ...(answer.questions.length
      ? [
          `To confirm at the mine\n${answer.questions.map((item) => `- ${item}`).join("\n")}`,
        ]
      : []),
    ...(answer.findings.length ? [`Similar cases and SANKET evidence\n${lines(answer.findings)}`] : []),
    `Sources\n${answer.sources.map((source) => `${source.id}: ${source.title}; ${source.reference}; ${origin + source.url}`).join("\n") || "No source passage cited."}`,
    answer.notice || "",
    "Historical evidence, not a site safety clearance.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
