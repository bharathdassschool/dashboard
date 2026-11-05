import { DECISION_LABEL, OUTCOME_LABEL, type Decision, type Paper } from "@/lib/papers";

export function StatusBadge({ paper }: { paper: Pick<Paper, "status" | "outcome"> }) {
  if (paper.status === "draft") return <span className="badge badge-muted">Draft</span>;
  if (paper.status === "in_review") return <span className="badge badge-warn">In review</span>;
  const cls = paper.outcome === "final" ? "badge-good" : paper.outcome === "rejected" ? "badge-bad" : "badge-muted";
  return <span className={`badge ${cls}`}>{paper.outcome ? OUTCOME_LABEL[paper.outcome] : "Closed"}</span>;
}

export function DecisionBadge({ decision, submitted }: { decision: Decision; submitted: boolean }) {
  if (!submitted) return <span className="badge badge-muted">{decision ? "Draft saved" : "Not started"}</span>;
  if (!decision) return <span className="badge badge-muted">—</span>;
  const cls = decision === "approved" ? "badge-good" : decision === "approved_with_changes" ? "badge-warn" : "badge-bad";
  return <span className={`badge ${cls}`}>{DECISION_LABEL[decision]}</span>;
}
