"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Compass,
  ExternalLink,
  FileText,
  Flame,
  Layers3,
  LoaderCircle,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
  Waypoints,
  HardHat,
} from "lucide-react";
import type { MineProfile, Source } from "../lib/knowledge";
import { AnswerView } from "./ui/answer-view";
import { Contours, Logo } from "./ui/brand";
import { Dialog, useModalFocus } from "./ui/dialog";
import {
  answerText,
  initialProfile,
  isSource,
  normalizeProfile,
  type Turn,
} from "./ui/conversation";
import { useConversation } from "./ui/use-conversation";

type View = "chat" | "brief" | "cases" | "books";
type Case = {
  id: string;
  title: string;
  year: number;
  date: string;
  sector: string;
  state: string;
  category: string;
  page: number;
  endPage: number;
  event: string;
  summary: string;
  scenario: string;
  fire: boolean;
  deaths: number | null;
};
type Manifest = {
  pages: number;
  indexedPages: number;
  chunks: number;
  cases: number;
  fireCases: number;
  books: {
    id: string;
    title: string;
    filename: string;
    pages: number;
    indexedPages: number;
    shortPages: number[];
  }[];
  method: string;
  dimensions: number;
  limitations: string[];
};
const prompts = [
  {
    icon: Compass,
    label: "Taking over a mine",
    text: "I am a newly transferred mine officer. What should I check first to prevent fire?",
    tag: "Start with a plan",
  },
  {
    icon: Flame,
    label: "Understand a failure",
    text: "Why did the Khadia fuel-tank fire happen, and how could it have been prevented?",
    tag: "Learn from a real case",
  },
  {
    icon: ShieldCheck,
    label: "Check the critical controls",
    text: "What should be checked before working near a burning coal bank?",
    tag: "Turn evidence into action",
  },
];
const topicPrompts: Record<string, string> = {
  "Burning ground":
    "What recurring failures put workers at risk near burning coal banks?",
  "Equipment fires":
    "What caused electrical and fuel-related equipment fires in the SANKET cases?",
  "Fire response":
    "What went wrong during firefighting tasks, and what should officers check?",
  "Escape & rescue":
    "What does the Oil India case teach us about safe escape routes?",
  "Roof & strata":
    "What do the coal cases say about roof support and falling strata?",
};
const formatTitle = (view: View) =>
  ({
    chat: "Ask SANKET",
    brief: "Officer briefing",
    cases: "Case library",
    books: "Knowledge base",
  })[view];

export default function Home() {
  const [view, setView] = useState<View>("chat");
  const [question, setQuestion] = useState("");
  const conversation = useConversation();
  const { turns, briefTurn, busy, online, status } = conversation;
  const [profile, setProfile] = useState<MineProfile>(initialProfile);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState(initialProfile);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [catalog, setCatalog] = useState<Case[]>([]);
  const [libraryError, setLibraryError] = useState("");
  const [libraryRetry, setLibraryRetry] = useState(0);
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const [sourceError, setSourceError] = useState("");
  const [caseQuery, setCaseQuery] = useState("");
  const [fireOnly, setFireOnly] = useState(true);
  const [caseSector, setCaseSector] = useState("all");
  const [limit, setLimit] = useState(24);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const sourceRequest = useRef<AbortController | null>(null);
  const activeSources =
    (view === "brief" ? briefTurn : turns.at(-1))?.answer?.sources || [];
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeProfile = useCallback(() => setProfileOpen(false), []);
  const closeSource = useCallback(() => {
    sourceRequest.current?.abort();
    sourceRequest.current = null;
    setSourceId(null);
    setSource(null);
    setSourceBusy(false);
    setSourceError("");
  }, []);
  useModalFocus(sidebar, menuOpen, closeMenu);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/library", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{
          manifest: Manifest;
          catalog: Case[];
        }>;
      })
      .then((data) => {
        if (controller.signal.aborted) return;
        setManifest(data.manifest);
        setCatalog(data.catalog);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setLibraryError("The knowledge library could not load.");
      });
    return () => controller.abort();
  }, [libraryRetry]);

  useEffect(() => {
    // Browser storage is read after hydration so the server and first render agree.
    try {
      const saved = normalizeProfile(
        JSON.parse(localStorage.getItem("sanket-profile") || "null"),
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(saved);
    } catch {
      // Storage may be unavailable or a previous value may be malformed.
    }
  }, []);

  useEffect(() => () => sourceRequest.current?.abort(), []);
  const latestTurnId = turns.at(-1)?.id;
  useEffect(() => {
    if (view !== "chat" || !latestTurnId) return;
    document
      .getElementById("turn-" + latestTurnId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [latestTurnId, view]);
  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(timeout);
  }, [toast]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 761px)");
    const resized = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", resized);
    return () => desktop.removeEventListener("change", resized);
  }, []);
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === "k" &&
        !profileOpen &&
        !sourceId &&
        !menuOpen
      ) {
        event.preventDefault();
        setView("chat");
        requestAnimationFrame(() => input.current?.focus());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profileOpen, sourceId, menuOpen]);

  function notify(message: string) {
    setToast(message);
  }
  function changeView(next: View) {
    setView(next);
    setMenuOpen(false);
  }
  function editProfile() {
    setMenuOpen(false);
    setProfileDraft({ ...profile });
    setProfileOpen(true);
  }
  function saveProfile() {
    const next = normalizeProfile(profileDraft);
    setProfile(next);
    setProfileOpen(false);
    try {
      localStorage.setItem("sanket-profile", JSON.stringify(next));
      notify("Mine context updated");
    } catch {
      notify(
        "Mine context updated for this session. Browser storage is unavailable.",
      );
    }
  }
  function ask(text: string, briefing = false) {
    if (!conversation.submit(text, profile, briefing)) return;
    setQuestion("");
    changeView(briefing ? "brief" : "chat");
  }
  function retry(turn: Turn) {
    if (conversation.retry(turn)) changeView(turn.briefing ? "brief" : "chat");
  }
  async function openSource(id: string) {
    sourceRequest.current?.abort();
    const controller = new AbortController();
    sourceRequest.current = controller;
    setMenuOpen(false);
    setSourceId(id);
    setSource(null);
    setSourceError("");
    const found = [
      ...activeSources,
      ...turns.flatMap((turn) => turn.answer?.sources || []),
      ...(briefTurn?.answer?.sources || []),
    ].find((item) => item.id === id);
    if (found) {
      setSource(found);
      setSourceBusy(false);
      sourceRequest.current = null;
      return;
    }
    setSourceBusy(true);
    try {
      const response = await fetch("/api/source?id=" + encodeURIComponent(id), {
        signal: controller.signal,
      });
      const data = (await response.json()) as { source?: unknown };
      if (!response.ok || !isSource(data.source)) throw new Error();
      if (sourceRequest.current === controller) setSource(data.source);
    } catch {
      if (sourceRequest.current === controller && !controller.signal.aborted) {
        setSourceError("The passage could not load. Try again.");
      }
    } finally {
      if (sourceRequest.current === controller) {
        setSourceBusy(false);
        sourceRequest.current = null;
      }
    }
  }
  function download(turn: Turn) {
    if (!turn.answer) return;
    const url = URL.createObjectURL(
      new Blob(
        [answerText(turn.answer, turn.question, window.location.origin)],
        { type: "text/plain;charset=utf-8" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "SANKET-" + (turn.briefing ? "officer-briefing" : "answer") + ".txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }
  async function copy(turn: Turn) {
    if (!turn.answer) return;
    try {
      await navigator.clipboard.writeText(
        answerText(turn.answer, turn.question, window.location.origin),
      );
      notify("Answer and citations copied");
    } catch {
      notify("Copy is unavailable. Use Download instead.");
    }
  }
  const shown = catalog.filter(
    (c) =>
      (!fireOnly || c.fire) &&
      (caseSector === "all" || c.sector === caseSector) &&
      `${c.title} ${c.state} ${c.category} ${c.scenario} ${c.year}`
        .toLowerCase()
        .includes(caseQuery.toLowerCase()),
  );
  return (
    <div className="app-shell">
      {menuOpen && (
        <div className="mobile-scrim" onClick={() => setMenuOpen(false)} />
      )}
      <aside
        ref={sidebar}
        id="workspace-navigation"
        className={"sidebar " + (menuOpen ? "is-open" : "")}
        role={menuOpen ? "dialog" : undefined}
        aria-modal={menuOpen || undefined}
        aria-label={menuOpen ? "Workspace navigation" : undefined}
        tabIndex={-1}
      >
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={closeMenu}
        >
          <X size={21} />
        </button>
        <a
          className="brand-home"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeView("chat");
          }}
          aria-label="SANKET home"
        >
          <Logo />
        </a>
        <button
          className="new-chat"
          disabled={busy}
          onClick={() => {
            if (!conversation.clear()) return;
            setQuestion("");
            changeView("chat");
            requestAnimationFrame(() => input.current?.focus());
          }}
        >
          <Plus size={17} />
          New conversation
        </button>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {(
            [
              { id: "chat", icon: MessageSquare, label: "Ask SANKET" },
              { id: "brief", icon: Compass, label: "Officer briefing" },
              { id: "cases", icon: Layers3, label: "Case library" },
              { id: "books", icon: BookOpen, label: "Knowledge base" },
            ] as const
          ).map(({ id, icon: Icon, label }) => (
            <button
              className={view === id ? "selected" : ""}
              key={id}
              aria-current={view === id ? "page" : undefined}
              onClick={() => changeView(id)}
            >
              <Icon size={18} />
              {label}
              {id === "chat" && <span className="nav-dot" />}
              {id === "cases" && (
                <span className="nav-count">{manifest?.cases || "—"}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-label">BUILT ON REAL INQUIRIES</span>
          <p>
            Past incidents.
            <br />
            Practical lessons.
          </p>
          <span>Coal & non-coal · DGMS SANKET</span>
          <Contours />
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="tiny-label">{online ? "ONLINE" : "OFFLINE MODE"}</span>
            <span>{online ? status : "Queries are saved on this device."}</span>
          </div>
          <button className="mine-context" onClick={editProfile}>
            <span className="avatar">
              <HardHat size={20} />
            </span>
            <span>
              <strong>{profile.name || "Your mine context"}</strong>
              <small>
                {profile.sector === "all"
                  ? "Set mine type & conditions"
                  : profile.sector === "coal"
                    ? "Coal · " + profile.method
                    : "Non-coal · " + profile.method}
              </small>
            </span>
            <Settings2 size={15} />
          </button>
          <div className="sidebar-footer">
            <span className="status-dot" />
            {manifest
              ? "Evidence connected"
              : libraryError
                ? "Library unavailable"
                : "Loading evidence"}{" "}
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              aria-expanded={menuOpen}
              aria-controls="workspace-navigation"
              onClick={() => setMenuOpen(true)}
            >
              <Menu size={21} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{formatTitle(view)}</strong>
          </div>
          <div className="top-actions">
            {busy && (
              <button className="request-stop" onClick={conversation.stop}>
                <X size={14} />
                Stop answer
              </button>
            )}
            <button className="context-button" onClick={editProfile}>
              <HardHat size={15} />
              {profile.sector === "all"
                ? "All mining"
                : profile.sector === "coal"
                  ? "Coal mining"
                  : "Non-coal mining"}
              <ChevronDown size={13} />
            </button>
            <span className="evidence-badge">
              <ShieldCheck size={15} />
              Source-grounded
            </span>
          </div>
        </header>
        {libraryError && (
          <div className="inline-error" role="alert">
            {libraryError}
            <button
              onClick={() => {
                setLibraryError("");
                setLibraryRetry((count) => count + 1);
              }}
            >
              Retry library
            </button>
          </div>
        )}
        <div
          className={
            "workspace-body " +
            (view === "chat" || view === "brief" ? "with-evidence" : "")
          }
        >
          <div className="main-content">
            {view === "chat" && (
              <>
                <div
                  className={
                    "chat-scroll " + (!turns.length ? "welcome-scroll" : "")
                  }
                >
                  {!turns.length ? (
                    <div className="welcome">
                      <div className="eyebrow">
                        <span className="status-dot" />
                        YOUR MINING KNOWLEDGE COMPANION
                      </div>
                      <h1>
                        Learn from the past.
                        <br />
                        <span>Prepare for the next shift.</span>
                      </h1>
                      <p className="welcome-description">
                        Ask about a hazard, understand why an accident happened,
                        or build a practical plan for your mine. Every answer
                        starts with evidence.
                      </p>
                      <div className="welcome-stats">
                        <span>
                          <strong>2</strong> source books
                        </span>
                        <i />
                        <span>
                          <strong>{manifest?.cases || "—"}</strong> accident
                          cases
                        </span>
                        <i />
                        <span>
                          <ShieldCheck size={14} />
                          Page-level sources
                        </span>
                      </div>
                      <div className="suggested-heading">
                        <span>A GOOD PLACE TO START</span>
                        <Waypoints size={16} />
                      </div>
                      <div className="prompt-grid">
                        {prompts.map(({ icon: Icon, label, text, tag }) => (
                          <button
                            className="prompt-card"
                            disabled={busy}
                            key={label}
                            onClick={() => ask(text)}
                          >
                            <span className="prompt-icon">
                              <Icon size={20} />
                            </span>
                            <ArrowUpRight className="prompt-arrow" size={17} />
                            <strong>{label}</strong>
                            <p>{text}</p>
                            <small>
                              {tag}
                              <ArrowRight size={12} />
                            </small>
                          </button>
                        ))}
                      </div>
                      <div className="topic-row">
                        <span>Explore</span>
                        {Object.keys(topicPrompts).map((x) => (
                          <button
                            key={x}
                            disabled={busy}
                            onClick={() => ask(topicPrompts[x])}
                          >
                            {x}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="conversation">
                      {turns.map((t) => (
                        <div className="turn" id={"turn-" + t.id} key={t.id}>
                          <div className="user-message">
                            <span>You</span>
                            <p>{t.question}</p>
                          </div>
                          <AnswerView
                            turn={t}
                            busy={busy}
                            onRetry={retry}
                            onSource={openSource}
                            onCopy={copy}
                            onDownload={download}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="composer-wrap">
                  <form
                    className="composer"
                    onSubmit={(e) => {
                      e.preventDefault();
                      ask(question);
                    }}
                  >
                    <textarea
                      ref={input}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      maxLength={1800}
                      placeholder="Ask about mining hazards, past incidents, or prevention…"
                      aria-label="Ask SANKET"
                      rows={2}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          ask(question);
                        }
                      }}
                    />
                    <div className="composer-bottom">
                      <button
                        type="button"
                        className="source-pill"
                        onClick={() => changeView("books")}
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
                            onClick={conversation.stop}
                          >
                            <span />
                          </button>
                        ) : (
                          <button
                            className="send-button"
                            type="submit"
                            disabled={question.trim().length < 2}
                            aria-label="Send question"
                          >
                            <ArrowUp size={20} />
                          </button>
                        )}
                      </div>
                    </div>
                  </form>
                  <p className="composer-caption">
                    Historical evidence supports your judgment. Site conditions
                    and authorized procedures come first.
                  </p>
                </div>
              </>
            )}
            {view === "brief" && (
              <div className="page-content brief-page">
                <div className="eyebrow">
                  <Compass size={14} />
                  FOR THE INCOMING OFFICER
                </div>
                <h1>
                  Take over with
                  <br />
                  <span>a clearer plan.</span>
                </h1>
                <p className="page-intro">
                  Connect the mine’s conditions to lessons from past fires.
                  Build a starting brief for inspection, team discussions and
                  emergency readiness.
                </p>
                <div className="brief-context">
                  <div>
                    <small>MINE CONTEXT</small>
                    <strong>{profile.name || "Add your mine details"}</strong>
                    <p>
                      {profile.sector === "all"
                        ? "Choose a sector and working method to make the brief more relevant."
                        : `${profile.sector === "coal" ? "Coal" : "Non-coal"} · ${profile.method}`}
                    </p>
                    {profile.conditions && <p>{profile.conditions}</p>}
                  </div>
                  <button className="outline-button" onClick={editProfile}>
                    <Settings2 size={15} />
                    Edit context
                  </button>
                </div>
                <div className="brief-steps">
                  {[
                    {
                      n: "01",
                      title: "Know the exposure",
                      body: "Locate similar incidents and the tasks that put people in harm’s way.",
                    },
                    {
                      n: "02",
                      title: "Check the controls",
                      body: "Turn inquiry findings into inspection and handover questions.",
                    },
                    {
                      n: "03",
                      title: "Agree the next steps",
                      body: "Identify owners, evidence to collect and gaps to close.",
                    },
                  ].map((x) => (
                    <div key={x.n}>
                      <span>{x.n}</span>
                      <strong>{x.title}</strong>
                      <p>{x.body}</p>
                    </div>
                  ))}
                </div>
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() =>
                    ask(
                      "Prepare a first-week fire prevention briefing for a newly transferred officer at this mine. Identify relevant past cases, critical control checks, proposed responsible roles and missing site information.",
                      true,
                    )
                  }
                >
                  {busy ? (
                    <LoaderCircle size={18} className="spin" />
                  ) : (
                    <Sparkles size={18} />
                  )}
                  Build my fire briefing
                  <ArrowRight size={17} />
                </button>
                <p className="muted small-text">
                  A proposed inspection plan, not a completed site assessment.
                  Review the cited evidence and confirm local conditions.
                </p>
                {briefTurn && (
                  <div className="brief-result">
                    <AnswerView
                      turn={briefTurn}
                      busy={busy}
                      onRetry={retry}
                      onSource={openSource}
                      onCopy={copy}
                      onDownload={download}
                    />
                  </div>
                )}
              </div>
            )}
            {view === "cases" && (
              <div className="page-content library-page">
                <div className="eyebrow">
                  <Layers3 size={14} />
                  THE ACCIDENT RECORD
                </div>
                <div className="page-title-row">
                  <div>
                    <h1>
                      Real cases.
                      <br />
                      <span>Lessons that stay relevant.</span>
                    </h1>
                    <p className="page-intro">
                      Explore the event, read the inquiry, and ask what it means
                      for your operation.
                    </p>
                  </div>
                  <span className="large-counter">
                    {manifest?.cases || "—"}
                    <small>CASES · 2016–2022</small>
                  </span>
                </div>
                <div className="library-controls">
                  <label className="search-box">
                    <Search size={17} />
                    <input
                      value={caseQuery}
                      onChange={(e) => {
                        setCaseQuery(e.target.value);
                        setLimit(24);
                      }}
                      placeholder="Search mine, hazard, state or year"
                      aria-label="Search cases"
                    />
                  </label>
                  <select
                    value={caseSector}
                    onChange={(e) => {
                      setCaseSector(e.target.value);
                      setLimit(24);
                    }}
                    aria-label="Filter cases by sector"
                  >
                    <option value="all">All sectors</option>
                    <option value="coal">Coal</option>
                    <option value="noncoal">Non-coal</option>
                  </select>
                  <button
                    className={"filter-chip " + (fireOnly ? "active" : "")}
                    onClick={() => {
                      setFireOnly(!fireOnly);
                      setLimit(24);
                    }}
                    aria-pressed={fireOnly}
                  >
                    <Flame size={15} />
                    Fire cases{fireOnly && <Check size={13} />}
                  </button>
                </div>
                <div className="result-count">
                  {shown.length} matching cases{" "}
                  <span>
                    {fireOnly
                      ? "Confirmed fire, firefighting and escape cases. Explosion cases excluded from this subset."
                      : "Structured accident accounts from the two books."}
                  </span>
                </div>
                <div className="case-grid">
                  {shown.slice(0, limit).map((c) => (
                    <article className="case-card" key={c.id}>
                      <div className="case-meta">
                        <span
                          className={
                            c.sector === "coal" ? "coal-tag" : "noncoal-tag"
                          }
                        >
                          {c.sector === "coal" ? "COAL" : "NON-COAL"}
                        </span>
                        <span>{c.year}</span>
                        {c.fire && <Flame size={13} />}
                      </div>
                      <h2>{c.title}</h2>
                      <p className="case-location">
                        {c.state} · PDF p. {c.page}
                      </p>
                      <span className="case-category">
                        {c.scenario || c.category}
                      </span>
                      <p className="case-event">{c.summary || c.event}</p>
                      <div className="case-actions">
                        <button onClick={() => openSource(c.id)}>
                          Read inquiry
                          <ArrowUpRight size={14} />
                        </button>
                        <button
                          aria-label={"Ask about " + c.title}
                          title={"Ask about " + c.title}
                          disabled={busy}
                          onClick={() =>
                            ask(
                              `Explain the ${c.title} accident in ${c.year}, its inquiry findings and the prevention lessons.`,
                            )
                          }
                        >
                          <MessageSquare size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                {shown.length === 0 && (
                  <div className="empty-state">
                    <Search size={28} />
                    <h3>No matching case</h3>
                    <p>
                      Try a different mine name or turn off the fire filter.
                    </p>
                  </div>
                )}
                {shown.length > limit && (
                  <button
                    className="outline-button load-more"
                    onClick={() => setLimit((n) => n + 24)}
                  >
                    Show more cases
                    <ChevronDown size={15} />
                  </button>
                )}
              </div>
            )}
            {view === "books" && (
              <div className="page-content books-page">
                <div className="eyebrow">
                  <BookOpen size={14} />
                  WHERE THE ANSWERS BEGIN
                </div>
                <h1>
                  Grounded in SANKET.
                  <br />
                  <span>Open to inspection.</span>
                </h1>
                <p className="page-intro">
                  The original DGMS books stay one click away. Answers link to
                  PDF page numbers so the evidence can be checked.
                </p>
                <div className="book-cards">
                  {(manifest?.books || []).map((b) => (
                    <article className="book-card" key={b.id}>
                      <div className={"book-cover " + b.id}>
                        <span>DGMS</span>
                        <strong>SANKET</strong>
                        <em>
                          {b.id === "coal" ? "COAL MINE" : "NON-COAL MINE"}
                          <br />
                          ACCIDENTS
                        </em>
                        <div>2016—2022</div>
                        <Layers3 size={43} />
                      </div>
                      <div className="book-details">
                        <span className="tiny-label">PRIMARY SOURCE</span>
                        <h2>
                          {b.id === "coal"
                            ? "Coal mine accidents"
                            : "Non-coal mine accidents"}
                        </h2>
                        <p>
                          {b.pages} PDF pages · {b.indexedPages} text-bearing
                          pages indexed
                        </p>
                        <p>
                          Accident accounts, inquiry findings and statistical
                          tables published by the Directorate General of Mines
                          Safety.
                        </p>
                        <a
                          className="outline-button"
                          href={"/sources/" + b.filename}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open original book
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="method-block">
                  <h2>How an answer is built</h2>
                  <div className="method-flow">
                    {[
                      {
                        n: "1",
                        t: "Retrieve",
                        d: "Keyword and learned semantic search find relevant passages.",
                      },
                      {
                        n: "2",
                        t: "Reason",
                        d: "The assistant connects the evidence to your question and mine context.",
                      },
                      {
                        n: "3",
                        t: "Verify",
                        d: "Open the cited passages and confirm the conditions at your mine.",
                      },
                    ].map((x) => (
                      <div key={x.n}>
                        <span>{x.n}</span>
                        <h3>{x.t}</h3>
                        <p>{x.d}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <details className="technical-details">
                  <summary>
                    Scope, model and limitations
                    <ChevronDown size={16} />
                  </summary>
                  <div>
                    <p>
                      <strong>Coverage:</strong> {manifest?.cases} structured
                      cases and {manifest?.chunks} searchable case/page
                      passages. {manifest?.indexedPages} of {manifest?.pages}{" "}
                      PDF pages contain at least 80 extracted text characters.
                      Covers, separators and short/image pages are not treated
                      as searchable passages; they remain in the original PDFs.
                    </p>
                    <p>
                      <strong>Retrieval:</strong> {manifest?.method}. The
                      64-dimensional latent search model is fitted to the book
                      corpus. Answers use retrieved case accounts and inquiry
                      evidence, with source links for review.
                    </p>
                    <p>
                      <strong>Fire scope:</strong> 14 confirmed cases from
                      2016–2022, including burning ground, firefighting and
                      escape. Three uncertain cases, explosion cases and older
                      historical lists are excluded from the fire subset. Counts
                      are not mine risk probabilities.
                    </p>
                    <p>
                      <strong>Source quality:</strong> PDF extraction can lose
                      table layout. Check the original pages for numbers,
                      equations and case-specific dimensions. Historical legal
                      references do not establish current requirements.
                    </p>
                    <p>
                      <strong>Privacy:</strong> Mine context is saved in this
                      browser. Questions, recent conversation, context and
                      selected passages are processed by the server and its
                      configured language-model service to prepare answers.
                      Credentials stay on the server; the app does not store
                      chat histories in a database.
                    </p>
                  </div>
                </details>
              </div>
            )}
          </div>
          {(view === "chat" || view === "brief") && (
            <aside className="evidence-panel">
              <div className="panel-heading">
                <BookOpen size={17} />
                <strong>Evidence desk</strong>
                <span>{activeSources.length || 2}</span>
              </div>
              {activeSources.length ? (
                <>
                  <div className="panel-kicker">PASSAGES FOR THIS ANSWER</div>
                  {activeSources.map((s, i) => (
                    <button
                      className="evidence-card"
                      key={s.id}
                      onClick={() => openSource(s.id)}
                    >
                      <div>
                        <span className="source-number">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span>{s.sector === "coal" ? "COAL" : "NON-COAL"}</span>
                        <ArrowUpRight size={14} />
                      </div>
                      <strong>{s.title}</strong>
                      <p>{s.summary || s.event || s.text.slice(0, 150)}</p>
                      <small>
                        PDF p. {s.page}
                        {s.endPage > s.page ? "–" + s.endPage : ""} ·{" "}
                        {s.kind === "case" ? "Case inquiry" : "Book passage"}
                      </small>
                    </button>
                  ))}
                </>
              ) : (
                <>
                  <div className="panel-kicker">YOUR CONNECTED SOURCES</div>
                  {[
                    {
                      title: "Coal mine accidents",
                      sector: "coal",
                      pages: 316,
                    },
                    {
                      title: "Non-coal mine accidents",
                      sector: "noncoal",
                      pages: 355,
                    },
                  ].map((b) => (
                    <a
                      className="source-book"
                      key={b.sector}
                      href={
                        "/sources/SANKET_" +
                        (b.sector === "coal" ? "Coal" : "NonCoal") +
                        ".pdf"
                      }
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className={"mini-cover " + b.sector}>
                        <Layers3 size={20} />
                      </span>
                      <div>
                        <strong>{b.title}</strong>
                        <small>SANKET · {b.pages} pages</small>
                      </div>
                      <ArrowUpRight size={13} />
                    </a>
                  ))}
                  <div className="evidence-empty">
                    <div className="evidence-orbit">
                      <FileText size={25} />
                      <span>
                        <Check size={10} />
                      </span>
                    </div>
                    <h3>
                      See the reasoning.
                      <br />
                      Read the source.
                    </h3>
                    <p>
                      Relevant cases and book pages appear here when you ask a
                      question.
                    </p>
                  </div>
                  <div className="field-note">
                    <span>
                      <Compass size={15} />
                      FIELD NOTE
                    </span>
                    <h3>New to the mine?</h3>
                    <p>
                      Start with an officer briefing to organize your first
                      checks.
                    </p>
                    <button onClick={() => changeView("brief")}>
                      Build a briefing
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </>
              )}
              <div className="evidence-footer">
                <ShieldCheck size={15} />
                <p>Historical lessons, with a clear trail back to the books.</p>
              </div>
            </aside>
          )}
        </div>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={15} />
          {toast}
        </div>
      )}
      {sourceId && (
        <Dialog drawer label="Source passage" onClose={closeSource}>
          <div className="drawer-top">
            <span className="eyebrow">
              <BookOpen size={14} />
              SOURCE PASSAGE
            </span>
            <button
              className="icon-button"
              onClick={closeSource}
              aria-label="Close source"
            >
              <X size={21} />
            </button>
          </div>
          {sourceBusy && (
            <p className="thinking" role="status">
              <LoaderCircle className="spin" size={18} />
              Opening the source…
            </p>
          )}
          {sourceError && (
            <div className="error-note" role="alert">
              <p>{sourceError}</p>
              <button onClick={() => openSource(sourceId)}>
                Try again <ArrowRight size={15} />
              </button>
            </div>
          )}
          {source && (
            <>
              <h2>{source.title}</h2>
              <p className="drawer-meta">
                {source.reference}
                {source.printedPage
                  ? " · Printed p. " + source.printedPage
                  : ""}
              </p>
              <div className="source-badges">
                <span>{source.category}</span>
                {source.year && <span>{source.year}</span>}
              </div>
              {source.inquiry && (
                <div className="inquiry-summary">
                  <small>INQUIRY · PLAIN-WORD SUMMARY</small>
                  <p>{source.inquiry}</p>
                </div>
              )}
              <h3>Original extracted passage</h3>
              <p className="extraction-note">
                Whitespace normalized. Check the PDF for original layout,
                numbers and context.
              </p>
              <div className="original-passage">{source.text}</div>
              <a
                className="primary-button"
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                Open this page in the book
                <ExternalLink size={15} />
              </a>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  const q = `What are the practical prevention lessons from ${source.title}${source.year ? " in " + source.year : ""}?`;
                  closeSource();
                  ask(q);
                }}
              >
                Ask about this case
                <ArrowRight size={15} />
              </button>
            </>
          )}
        </Dialog>
      )}
      {profileOpen && (
        <Dialog labelledBy="profile-title" onClose={closeProfile}>
          <div className="modal-top">
            <span className="modal-icon">
              <HardHat size={23} />
            </span>
            <button
              className="icon-button"
              onClick={closeProfile}
              aria-label="Close mine context"
            >
              <X size={21} />
            </button>
          </div>
          <h2 id="profile-title">Give the evidence some context.</h2>
          <p>
            The more relevant the conditions, the more useful the briefing.
            Unknown details can stay blank.
          </p>
          <label>
            Mine or working area
            <input
              value={profileDraft.name}
              maxLength={80}
              placeholder="e.g. North opencast project"
              onChange={(e) =>
                setProfileDraft({ ...profileDraft, name: e.target.value })
              }
            />
          </label>
          <div className="form-row">
            <label>
              Sector
              <select
                value={profileDraft.sector}
                onChange={(e) =>
                  setProfileDraft({
                    ...profileDraft,
                    sector: e.target.value as MineProfile["sector"],
                  })
                }
              >
                <option value="all">Not specified</option>
                <option value="coal">Coal</option>
                <option value="noncoal">Non-coal / oil</option>
              </select>
            </label>
            <label>
              Working method
              <select
                value={profileDraft.method}
                onChange={(e) =>
                  setProfileDraft({ ...profileDraft, method: e.target.value })
                }
              >
                <option>Not specified</option>
                <option>Opencast</option>
                <option>Underground</option>
                <option>Oil / workover</option>
                <option>Surface facilities</option>
              </select>
            </label>
          </div>
          <label>
            Known conditions
            <textarea
              rows={4}
              maxLength={1200}
              value={profileDraft.conditions}
              onChange={(e) =>
                setProfileDraft({
                  ...profileDraft,
                  conditions: e.target.value,
                })
              }
              placeholder="e.g. Old workings near the active bench, heating in a coal dump, diesel equipment, contractor repair work…"
            />
          </label>
          <p className="small-text muted">
            Saved on this browser and included with your questions to tailor the
            answer. Avoid confidential mine information.
          </p>
          <button className="primary-button full" onClick={saveProfile}>
            Save mine context
            <Check size={17} />
          </button>
        </Dialog>
      )}
    </div>
  );
}
