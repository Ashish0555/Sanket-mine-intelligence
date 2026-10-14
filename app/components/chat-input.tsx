"use client";

import { ArrowUp, BookOpen, ChevronDown } from "lucide-react";
import type { RefObject } from "react";

const quickActions = [
  ["Slope stability check", "What controls should be checked for slope stability?"],
  [
    "Spontaneous combustion",
    "What are the warning signs and controls for spontaneous combustion?",
  ],
  ["CMR 2017 search", "Find the relevant CMR 2017 regulations for this hazard."],
];

export function ChatInput({
  value,
  busy,
  inputRef,
  onChange,
  onSubmit,
  onQuickAction,
  onStop,
  onOpenBooks,
}: {
  value: string;
  busy: boolean;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onQuickAction: (value: string) => void;
  onStop: () => void;
  onOpenBooks: () => void;
}) {
  return (
    <div className="composer-wrap">
      <div className="quick-action-row" aria-label="Quick actions">
        {quickActions.map(([label, prompt], index) => (
          <button
            className="quick-action-pill"
            key={label}
            disabled={busy}
            onClick={() => onQuickAction(prompt)}
          >
            <span>{index === 1 ? "🔥" : "⚡"}</span>
            {label}
          </button>
        ))}
      </div>
      <form
        className="composer floating-composer"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={1800}
          placeholder="Ask about mining hazards, past incidents, or prevention…"
          aria-label="Ask SANKET"
          rows={2}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              onSubmit();
            }
          }}
        />
        <div className="composer-bottom">
          <button
            type="button"
            className="source-pill"
            onClick={onOpenBooks}
          >
            <BookOpen size={14} />
            SANKET · Coal + Non-coal
            <ChevronDown size={11} />
          </button>
          <div className="composer-right">
            <span>Enter to send</span>
            {busy ? (
              <button
                className="send-button stop-button"
                type="button"
                aria-label="Stop answer"
                onClick={onStop}
              >
                <span />
              </button>
            ) : (
              <button
                className="send-button"
                type="submit"
                disabled={value.trim().length < 2}
                aria-label="Send question"
              >
                <ArrowUp size={20} />
              </button>
            )}
          </div>
        </div>
      </form>
      <p className="composer-caption">
        Historical evidence supports your judgment. Site conditions and
        authorized procedures come first.
      </p>
    </div>
  );
}
