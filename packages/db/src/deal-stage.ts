import { DealStage } from "./generated/prisma/enums";

export const OPEN_DEAL_STAGES = [
	DealStage.IDENTIFIED,
	DealStage.CONTACTED,
	DealStage.ENGAGED,
	DealStage.EVALUATING,
	DealStage.PROPOSAL_SENT,
	DealStage.IN_CONTRACT,
] as const;

export const CLOSED_DEAL_STAGES = [
	DealStage.LIVE,
	DealStage.CLOSED_LOST,
	DealStage.DORMANT,
] as const;

export const WON_DEAL_STAGES = [DealStage.LIVE] as const;

// DORMANT is not a loss. An opportunity that has gone quiet is paused, and
// counting it as lost makes every win rate wrong. It stays out of the losing set
// and stays in the set that has to explain itself.
export const LOSING_DEAL_STAGES = [DealStage.CLOSED_LOST] as const;

export const PAUSED_DEAL_STAGES = [DealStage.DORMANT] as const;

export const STAGES_NEEDING_A_REASON = [
	...LOSING_DEAL_STAGES,
	...PAUSED_DEAL_STAGES,
] as const;

const CLOSED = new Set<DealStage>(CLOSED_DEAL_STAGES);

export function isClosedStage(stage: DealStage): boolean {
	return CLOSED.has(stage);
}
