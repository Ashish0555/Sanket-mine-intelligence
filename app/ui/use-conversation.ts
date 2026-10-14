import { useEffect, useRef, useState } from "react";
import type { MineProfile } from "../../lib/knowledge";
import { conversationHistory, isAnswer, type Turn } from "./conversation";

type Pending = { controller: AbortController; turn: Turn };

export function useConversation() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [briefTurn, setBriefTurn] = useState<Turn | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<Pending | null>(null);

  useEffect(
    () => () => {
      const request = pending.current;
      pending.current = null;
      request?.controller.abort();
    },
    [],
  );

  function updateTurn(turn: Turn) {
    if (turn.briefing) setBriefTurn(turn);
    else
      setTurns((previous) =>
        previous.map((item) => (item.id === turn.id ? turn : item)),
      );
  }

  async function run(turn: Turn) {
    if (pending.current) return;
    const request = { controller: new AbortController(), turn };
    pending.current = request;
    setBusy(true);
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      request.controller.abort();
    }, 65000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: turn.question,
          profile: turn.profile,
          history: turn.history,
          briefing: turn.briefing,
        }),
        signal: request.controller.signal,
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "The answer could not be loaded. Please try again.";
        throw new Error(message);
      }
      if (!isAnswer(data))
        throw new Error("The answer was incomplete. Please try again.");
      if (pending.current === request) updateTurn({ ...turn, answer: data });
    } catch (error) {
      if (pending.current !== request) return;
      const message = timedOut
        ? "The request took too long. Please try again."
        : request.controller.signal.aborted
          ? "Request stopped."
          : error instanceof Error
            ? error.message
            : "Could not reach the assistant. Please try again.";
      updateTurn({ ...turn, error: message });
    } finally {
      clearTimeout(timeout);
      if (pending.current === request) {
        pending.current = null;
        setBusy(false);
      }
    }
  }

  function submit(
    text: string,
    profile: MineProfile,
    briefing = false,
  ): boolean {
    const question = text.trim();
    if (pending.current || question.length < 2 || question.length > 1800)
      return false;
    const turn: Turn = {
      id: crypto.randomUUID(),
      question,
      profile: { ...profile },
      briefing,
      history: briefing ? [] : conversationHistory(turns),
    };
    if (briefing) setBriefTurn(turn);
    else setTurns((previous) => [...previous, turn]);
    void run(turn);
    return true;
  }

  function retry(turn: Turn) {
    if (pending.current) return false;
    const next = { ...turn, answer: undefined, error: undefined };
    updateTurn(next);
    void run(next);
    return true;
  }

  function stop() {
    const request = pending.current;
    if (!request) return;
    pending.current = null;
    request.controller.abort();
    updateTurn({ ...request.turn, error: "Request stopped." });
    setBusy(false);
  }

  function clear() {
    if (pending.current) return false;
    setTurns([]);
    return true;
  }

  return { turns, briefTurn, busy, submit, retry, stop, clear };
}
