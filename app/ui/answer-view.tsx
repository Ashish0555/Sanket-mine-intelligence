import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  LoaderCircle,
} from "lucide-react";
import { Logo } from "./brand";
import type { Turn } from "./conversation";

export function AnswerView({
  turn,
  busy,
  onRetry,
  onSource,
  onCopy,
  onDownload,
}: {
  turn: Turn;
  busy: boolean;
  onRetry: (turn: Turn) => void;
  onSource: (id: string) => void;
  onCopy: (turn: Turn) => void;
  onDownload: (turn: Turn) => void;
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
      className={"answer " + (a.mode === "emergency" ? "emergency" : "")}
    >
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
      <h2>{a.title}</h2>
      {a.lead.split(/\n\s*\n/).map((paragraph, i) => (
        <p className="answer-lead" key={i} style={{ whiteSpace: "pre-line" }}>{paragraph}</p>
      ))}
      {a.actions.length > 0 && (
        <section className="actions">
          <h3>
            <ClipboardCheck size={16} />
            {a.mode === "book"
              ? "Prevention lessons to review"
              : "Proposed actions"}
          </h3>
          {a.actions.map((f, i) => (
            <div className="action-row" key={i}>
              <span className="action-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <p>{f.text}</p>
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
        </section>
      )}
      {a.questions.length > 0 && (
        <section className="confirm">
          <h3>Confirm at your mine</h3>
          <ul>
            {a.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
      )}
      {a.findings.length > 0 && (
        <section>
          <h3>
            <BookOpen size={16} />
            Similar cases and SANKET evidence
          </h3>
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
      <p className="answer-notice">{a.notice}</p>
      <div className="answer-tools">
        <button onClick={() => onCopy(turn)}>
          <Copy size={14} />
          Copy with sources
        </button>
        <button onClick={() => onDownload(turn)}>
          <Download size={14} />
          Download
        </button>
        <span>{a.sources.length} cited passages</span>
      </div>
    </article>
  );
}
