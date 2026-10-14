"use client";

import { ChevronDown, HardHat, Menu, PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import type { MineProfile } from "../../lib/knowledge";

export function Navbar({
  profile,
  busy,
  collapsed,
  onProfileChange,
  onToggleSidebar,
  onOpenMenu,
}: {
  profile: MineProfile;
  busy: boolean;
  collapsed: boolean;
  onProfileChange: (profile: MineProfile) => void;
  onToggleSidebar: () => void;
  onOpenMenu: () => void;
}) {
  const update = (changes: Partial<MineProfile>) => onProfileChange({ ...profile, ...changes });
  return (
    <header className="topbar enterprise-navbar">
      <div className="breadcrumb">
        <button className="mobile-menu icon-button" onClick={onOpenMenu} aria-label="Open navigation">
          <Menu size={20} />
        </button>
        <button
          className="sidebar-toggle-desktop icon-button"
          onClick={onToggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title="Toggle sidebar (Ctrl+B)"
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <span>Workspace</span>
        <span className="navbar-divider">/</span>
        <strong>SANKET Mine Intelligence</strong>
      </div>
      <div className="navbar-context-controls">
        <label className="navbar-select">
          <HardHat size={14} />
          <span>Mine Type</span>
          <select
            value={profile.mineType}
            disabled={busy}
            onChange={(event) => update({ mineType: event.target.value as MineProfile["mineType"] })}
            aria-label="Mine type"
          >
            <option value="unspecified">Not specified</option>
            <option value="underground-coal">Underground Coal</option>
            <option value="opencast-coal">Opencast Coal</option>
            <option value="metal-mine">Metal Mine</option>
          </select>
          <ChevronDown size={13} />
        </label>
        <label className="navbar-select">
          <ShieldCheck size={14} />
          <span>Gassiness</span>
          <select
            value={profile.gassiness}
            disabled={busy}
            onChange={(event) => update({ gassiness: event.target.value as MineProfile["gassiness"] })}
            aria-label="Gassiness level"
          >
            <option value="unspecified">Not specified</option>
            <option value="degree-i">Degree I</option>
            <option value="degree-ii">Degree II</option>
            <option value="degree-iii">Degree III</option>
            <option value="non-gassy">Non-Gassy</option>
          </select>
          <ChevronDown size={13} />
        </label>
      </div>
    </header>
  );
}
