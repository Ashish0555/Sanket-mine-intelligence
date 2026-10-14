import { useEffect, useRef, useState } from "react";
import type { MineProfile } from "../../lib/knowledge";
import { conversationHistory, isAnswer, type Turn } from "./conversation";
import { deleteAllTurns, loadTurns, saveTurn } from "../../lib/storage/offline-db";

type Pending = { controller: AbortController; turn: Turn };

export function useConversation() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [briefTurn, setBriefTurn] = useState<Turn | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [online, setOnline] = useState(true);
  const pending = useRef<Pending | null>(null);

  useEffect(
    () => () => {
      const request = pending.current;
      pending.current = null;
      request?.controller.abort();
    },
    [],
  );
  useEffect(() => {
    setOnline(navigator.onLine);
    const onlineHandler = () => setOnline(true);
    const offlineHandler = () => setOnline(false);
    window.addEventListener("online", onlineHandler);
    window.addEventListener("offline", offlineHandler);
    void loadTurns().then((saved) => {
      if (saved.length) setTurns(saved);
    }).catch(() => undefined);
    return () => {
      window.removeEventListener("online", onlineHandler);
      window.removeEventListener("offline", offlineHandler);
    };
  }, []);
  useEffect(() => {
    if (!online || pending.current) return;
    const queued = turns.find((turn) => turn.error?.startsWith("Offline."));
    if (queued) {
      const retryTurn = { ...queued, error: undefined };
      updateTurn(retryTurn);
      void run(retryTurn);
    }
  }, [online, turns]);

  function updateTurn(turn: Turn) {
    void saveTurn(turn).catch(() => undefined);
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
    setStatus(online ? "Retrieving DGMS case records..." : "Offline: saved locally; waiting to sync...");
    if (!online) {
      updateTurn({ ...turn, error: "Offline. This query is saved and will retry when the connection returns." });
      setBusy(false);
      pending.current = null;
      return;
    }
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      request.controller.abort();
    }, 65000);
    try {
      setStatus("Retrieving DGMS case records...");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          question: turn.question,
          profile: turn.profile,
          history: turn.history,
          briefing: turn.briefing,
        }),
        signal: request.controller.signal,
      });
      setStatus("Synthesizing safety guidance...");
      let data: unknown = null;
      if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffer += decoder.decode(chunk.value, { stream: true });
          for (const block of buffer.split("\n\n").slice(0, -1)) {
            const type = block.match(/^event:\s*(.+)$/m)?.[1];
            const payload = block.match(/^data:\s*(.+)$/m)?.[1];
            if (!payload) continue;
            const parsed = JSON.parse(payload) as { message?: string };
            if (type === "status" && parsed.message) setStatus(parsed.message);
            if (type === "answer") data = parsed;
            if (type === "error") throw new Error(parsed.message || "The answer service could not be reached.");
          }
          buffer = buffer.split("\n\n").at(-1) || "";
        }
      } else data = await response.json().catch(() => null);
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
        setStatus("Ready");
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
    void deleteAllTurns().catch(() => undefined);
    return true;
  }

  return { turns, briefTurn, busy, online, status, submit, retry, stop, clear };
}
