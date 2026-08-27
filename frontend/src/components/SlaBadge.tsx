import type { SlaState } from "../api/tickets";

const LABELS: Record<SlaState, string> = {
  ON_TRACK: "🟢 On Track",
  AT_RISK: "🟠 At Risk",
  BREACHED: "🔴 Breached",
};

export default function SlaBadge({ state }: { state: SlaState }) {
  return <span className={`sla-badge sla-${state.toLowerCase()}`}>{LABELS[state]}</span>;
}
