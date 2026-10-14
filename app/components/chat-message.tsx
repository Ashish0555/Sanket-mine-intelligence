"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  LoaderCircle,
  Share2,
} from "lucide-react";
import { Logo } from "../ui/brand";
import type { Turn } from "../ui/conversation";
import { ExportBriefingButton } from "./chat/export-pdf";

const statutoryReference =
  /\b(?:Regulation|Reg\.|Rule|Section)\s+\d+(?:\([^)]+\))?(?:\s*[-–]\s*\w+)?|\b(?:CMR|MMR)\s*(?:2017|1961)\b(?:\s*(?:Regulation|Reg\.)\s*\d+(?:\([^)]+\))?)?/gi;

function renderHighlightedText(text: string) {
  const parts = text.split(statutoryReference);
  const matches = text.match(statutoryReference) || [];
  return parts.flatMap((part, index) => {
    const output = part ? [<span key={`text-${index}`}>{part}</span>] : [];
    const match = matches[index];
    return match
      ? [
          ...output,
          <code className="statutory-badge" key={`reference-${index}`}>
            {match}
          </code>,
        ]
      : output;
  });
}

function renderLead(lead: string) {
  return lead.split(/\n\s*\n/).map((paragraph, index) => {
    const sentences = paragraph
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(Boolean);
    if (sentences.length > 1) {
      return (
        <ul className="executive-takeaways" key={index}>
          {sentences.map((sentence) => (
            <li key={sentence}>{renderHighlightedText(sentence)}</li>
          ))}
        </ul>
      );
    }
    return (
      <p className="answer-lead" key={index}>
        {renderHighlightedText(paragraph)}
      </p>
    );
  });
}

export function ChatMessage({
  turn,
  busy,
  onRetry,
  onSource,
  onCopy,
  onDownload,
  onShare,
}: {
  turn: Turn;
  busy: boolean;
  onRetry: (turn: Turn) => void;
  onSource: (id: string) => void;
  onCopy: (turn: Turn) => void;
  onDownload: (turn: Turn) => void;
  onShare: (turn: Turn) => void;
}) {
  const a = turn.answer;
  if (turn.error)
    return (
      <div className="error-note" role="alert">
        <p>{turn.error}</p>
        <button disabled={busy} onClick={() => onRetry(turn)}>
          Try again <ArrowRight size={15} />
        </button>
      </div>
    );
  if (!a)
    return (
      <div className="thinking" role="status">
        <Logo small />
        <div>
          <strong>Reading the evidence</strong>
          <span>Finding relevant cases and inquiry findings…</span>
        </div>
        <LoaderCircle className="spin" size={18} />
      </div>
    );

  return (
    <article
      className={"answer enterprise-answer " + (a.mode === "emergency" ? "emergency" : "")}
    >
      <div className="answer-card-toolbar">
        <div className="answer-byline">
          <Logo small />
          <strong>SANKET</strong>
          <span className="answer-mode">
            {a.mode === "synthesis"
              ? "SANKET analysis"
              : a.mode === "book"
                ? "Book evidence"
                : a.mode === "emergency"
                  ? "Immediate guidance"
                  : "Evidence boundary"}
          </span>
        </div>
        <div className="answer-quick-tools">
          <ExportBriefingButton turn={turn} />
          <button onClick={() => onCopy(turn)} title="Copy Markdown">
            <Copy size={14} /> <span>Copy Markdown</span>
          </button>
          <button onClick={() => onDownload(turn)} title="Export inquiry">
            <Download size={14} /> <span>Export</span>
          </button>
          <button onClick={() => onShare(turn)} title="Share inquiry">
            <Share2 size={14} /> <span>Share</span>
          </button>
        </div>
      </div>
      <h2>{a.title}</h2>
      <div className="lead-summary">{renderLead(a.lead)}</div>
      {a.actions.length > 0 && (
        <section className="actions">
          <h3>
            <ClipboardCheck size={16} />
            {a.mode === "book" ? "Prevention lessons to review" : "Proposed actions"}
          </h3>
          <div className="action-grid">
            {a.actions.map((f, i) => (
              <div className="action-row" key={i}>
                <span className="action-number">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <p>{f.text}</p>
                  <span className="role-badge">{i === 0 ? "Mine Manager" : i === 1 ? "Safety Officer" : "Shift Supervisor"}</span>
                  <div className="citations">
                    {f.citations.map((id) => (
                      <button key={id} onClick={() => onSource(id)}>
                        Source {a.sources.findIndex((s) => s.id === id) + 1}
                        <ArrowUpRight size={11} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {a.questions.length > 0 && (
        <section className="confirm verification-callout">
          <h3><ClipboardCheck size={16} /> Confirm at your mine</h3>
          <ul>
            {a.questions.map((q) => (
              <li key={q}>
                <label>
                  <input type="checkbox" />
                  <span>{q}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
      {a.findings.length > 0 && (
        <section>
          <h3><BookOpen size={16} /> Similar cases and SANKET evidence</h3>
          {a.findings.map((f, i) => (
            <div className="finding" key={i}>
              <p>{f.text}</p>
              <div className="citations">
                {f.citations.map((id) => {
                  const s = a.sources.find((x) => x.id === id);
                  return (
                    <button key={id} onClick={() => onSource(id)}>
                      <FileText size={12} />
                      {s ? s.title + " · p. " + s.page : id}
                      <ArrowUpRight size={11} />
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
      {a.notice && <p className="answer-notice">{a.notice}</p>}
      <div className="answer-tools">
        <span><Check size={13} /> {a.sources.length} cited passages</span>
      </div>
    </article>
  );
}
