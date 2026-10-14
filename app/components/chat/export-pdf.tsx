"use client";

import { FileText, Printer } from "lucide-react";
import type { Turn } from "../../ui/conversation";

export function ExportBriefingButton({ turn }: { turn: Turn }) {
  function printBriefing() {
    if (!turn.answer) return;
    const answer = turn.answer;
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return;
    const actions = answer.actions
      .slice(0, 3)
      .map((item, index) => `<li><strong>${String(index + 1).padStart(2, "0")}</strong> ${item.text}</li>`)
      .join("");
    const references = answer.sources
      .map((source) => `<li>${source.title}${source.year ? ` (${source.year})` : ""} · ${source.reference}</li>`)
      .join("");
    popup.document.write(`<!doctype html><html><head><title>SANKET Mine Safety Briefing Sheet</title><style>
      body{font:12px Arial,sans-serif;color:#182230;margin:38px;line-height:1.5}h1{font-size:22px;margin:0 0 4px}h2{font-size:13px;border-bottom:1px solid #ccd4dd;padding-bottom:5px;margin-top:24px}li{margin:8px 0}.header{border-bottom:3px solid #24594d;padding-bottom:14px}.meta{color:#5c6877}.sign{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:48px}.line{border-top:1px solid #52606f;padding-top:6px}</style></head><body>
      <div class="header"><h1>SANKET Mine Safety Briefing Sheet</h1><div class="meta">${answer.title}</div><div class="meta">Prepared from DGMS inquiry evidence · ${new Date().toLocaleDateString()}</div></div>
      <h2>Emergency Action Points</h2><ol>${actions}</ol>
      <h2>Statutory Regulation References</h2><ul>${references || "<li>Verify applicable CMR 2017 / MMR 1961 provisions before action.</li>"}</ul>
      <div class="sign"><div class="line">Mine Manager signature</div><div class="line">Safety Officer signature</div></div>
      </body></html>`);
    popup.document.close();
    popup.focus();
    popup.print();
  }
  return (
    <button className="export-briefing-button" onClick={printBriefing} title="Export printable briefing">
      <Printer size={14} /><FileText size={14} /> Export Printable Briefing
    </button>
  );
}
