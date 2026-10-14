"use client";

import { ArrowUp, ArrowUpRight, BookOpen, ChevronDown } from "lucide-react";
import type { RefObject } from "react";

export function ChatInput({
  value,
  busy,
  suggestions,
  inputRef,
  onChange,
  onSubmit,
  onQuickAction,
  onStop,
  onOpenBooks,
}: {
  value: string;
  busy: boolean;
  suggestions: { label: string; prompt: string }[];
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
        {suggestions.map((item) => (
          <button
            className="quick-action-pill"
            key={item.label}
            type="button"
            disabled={busy}
            onClick={() => onQuickAction(item.prompt)}
          >
            <span>{item.label}</span>
            <ArrowUpRight size={13} aria-hidden="true" />
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
          placeholder="Ask a question or explore a follow-up…"
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
            SANKET sources
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
