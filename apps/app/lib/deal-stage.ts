import {
	LOSING_DEAL_STAGES,
	STAGES_NEEDING_A_REASON,
} from "@crm/db/deal-stage";
import { DealStage } from "@crm/db/enums";
import type { StatusTone } from "@crm/ui/components/status-indicator";

export const OPEN_STAGES: readonly DealStage[] = [
	DealStage.IDENTIFIED,
	DealStage.CONTACTED,
	DealStage.ENGAGED,
	DealStage.EVALUATING,
	DealStage.PROPOSAL_SENT,
	DealStage.IN_CONTRACT,
];

export const WON_STAGE = DealStage.LIVE;

export const LOSING_STAGES: readonly DealStage[] = LOSING_DEAL_STAGES;

export const NEEDS_A_REASON: readonly DealStage[] = STAGES_NEEDING_A_REASON;

const ORDER: readonly DealStage[] = [
	...OPEN_STAGES,
	WON_STAGE,
	...STAGES_NEEDING_A_REASON,
];

type StagePresentation = { label: string; tone: StatusTone };

type DealStagePresentation = Record<DealStage, StagePresentation>;

const PRESENTATION: DealStagePresentation = {
	IDENTIFIED: { label: "Identified", tone: "neutral" },
	CONTACTED: { label: "Contacted", tone: "neutral" },
	ENGAGED: { label: "Engaged", tone: "info" },
	EVALUATING: { label: "Evaluating", tone: "info" },
	PROPOSAL_SENT: { label: "Proposal sent", tone: "warning" },
	IN_CONTRACT: { label: "In contract", tone: "warning" },
	LIVE: { label: "Live", tone: "success" },
	CLOSED_LOST: { label: "Closed lost", tone: "error" },
	DORMANT: { label: "Dormant", tone: "neutral" },
};

// A STAGE_CHANGE activity written before the travel pipeline landed holds a stage
// name the enum no longer has. The timeline still renders those rows, so an unknown
// name reads as itself rather than throwing on a lookup that cannot succeed.
const RETIRED = {
	label: "Retired stage",
	tone: "neutral",
} satisfies StagePresentation;

export const DEAL_STAGE_OPTIONS = ORDER.map((value) => ({
	value,
	label: PRESENTATION[value].label,
}));

const OPEN_STAGE_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
	"var(--chart-6)",
] as const;

export function isClosedStage(stage: DealStage): boolean {
	return !OPEN_STAGES.includes(stage);
}

export function dealStageColor(stage: DealStage): string {
	return OPEN_STAGE_COLORS[OPEN_STAGES.indexOf(stage)] ?? "var(--chart-7)";
}

export function dealStageLabel(stage: DealStage): string {
	return dealStagePresentation(stage).label;
}

export function dealStagePresentation(stage: DealStage) {
	return PRESENTATION[stage] ?? RETIRED;
}
