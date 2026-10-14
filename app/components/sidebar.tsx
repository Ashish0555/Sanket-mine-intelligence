"use client";

import {
  BookOpen,
  ChevronRight,
  Compass,
  Layers3,
  Menu,
  MessageSquare,
  Plus,
  Settings2,
  ShieldCheck,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { Logo } from "../ui/brand";

export type WorkspaceView = "chat" | "brief" | "cases" | "books";

export function Sidebar({
  view,
  open,
  collapsed,
  busy,
  online,
  status,
  cases,
  profileName,
  profileSummary,
  onViewChange,
  onNewChat,
  onEditProfile,
  onClose,
  onToggleCollapse,
  theme,
  onToggleTheme,
}: {
  view: WorkspaceView;
  open: boolean;
  collapsed: boolean;
  busy: boolean;
  online: boolean;
  status: string;
  cases?: number;
  profileName: string;
  profileSummary: string;
  onViewChange: (view: WorkspaceView) => void;
  onNewChat: () => void;
  onEditProfile: () => void;
  onClose: () => void;
  onToggleCollapse: () => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const sections = [
    {
      label: "WORKSPACES",
      items: [
        { id: "chat" as const, icon: MessageSquare, label: "Ask SANKET" },
        { id: "brief" as const, icon: Compass, label: "Officer briefing" },
      ],
    },
    {
      label: "INTELLIGENCE",
      items: [
        { id: "cases" as const, icon: Layers3, label: "Case library" },
        { id: "books" as const, icon: BookOpen, label: "Knowledge base" },
      ],
    },
  ];

  return (
    <aside
      id="workspace-navigation"
      className={
        "sidebar enterprise-sidebar fixed-viewport-sidebar " +
        (open ? "is-open " : "") +
        (collapsed ? "is-collapsed" : "")
      }
      aria-label="Workspace navigation"
    >
      <div className="sidebar-header">
        <a
          className="brand-home"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            onViewChange("chat");
          }}
          aria-label="SANKET home"
        >
          <Logo />
        </a>
        <button
          className="sidebar-collapse icon-button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <Menu size={17} /> : <ChevronRight size={17} />}
        </button>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>

      <button
        className="new-chat"
        disabled={busy}
        onClick={onNewChat}
        title="New conversation"
      >
        <Plus size={17} />
        <span>New conversation</span>
      </button>

      <div className="sidebar-nav-groups">
        {sections.map((section) => (
          <section className="sidebar-nav-group" key={section.label}>
            <p className="nav-label">{section.label}</p>
            <nav aria-label={section.label}>
              {section.items.map(({ id, icon: Icon, label }) => (
                <button
                  className={view === id ? "selected" : ""}
                  key={id}
                  aria-current={view === id ? "page" : undefined}
                  onClick={() => onViewChange(id)}
                  title={label}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                  {id === "chat" && <span className="nav-dot" />}
                  {id === "cases" && (
                    <span className="nav-count">{cases || "—"}</span>
                  )}
                </button>
              ))}
            </nav>
          </section>
        ))}
      </div>

      <div className="sidebar-lower">
        <section className="sidebar-nav-group sidebar-settings">
          <p className="nav-label">SETTINGS</p>
          <button className="sidebar-settings-button" onClick={onEditProfile}>
            <Settings2 size={18} />
            <span>Mine context</span>
          </button>
        </section>
        <div className="sidebar-status-card">
          <div className="status-card-heading">
            <span className="status-pulse" />
            <span>SYSTEM STATUS</span>
            <ShieldCheck size={14} />
          </div>
          <strong>Database: 622 DGMS Cases Indexed</strong>
          <span>LLM Status: Operational</span>
          <div className="status-card-divider" />
          <small>
            <span className={"status-dot " + (online ? "" : "offline")} />
            {online ? status || "Evidence connected" : "Offline · saved locally"}
          </small>
        </div>

        <button className="mine-context" onClick={onEditProfile}>
          <span className="avatar">
            <Settings2 size={17} />
          </span>
          <span>
            <strong>{profileName || "Your mine context"}</strong>
            <small>{profileSummary}</small>
          </span>
          <ChevronRight size={15} />
        </button>
        <div className="sidebar-bottom-controls">
          <button onClick={onToggleTheme} title="Toggle color theme">
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
          </button>
          <span className="sidebar-avatar" aria-label={profileName || "User profile"}>
            {(profileName || "S").slice(0, 1).toUpperCase()}
          </span>
        </div>
      </div>
    </aside>
  );
}
