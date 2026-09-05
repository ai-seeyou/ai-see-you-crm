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

export const LOSING_DEAL_STAGES = [
	DealStage.CLOSED_LOST,
	DealStage.DORMANT,
] as const;

export const WON_DEAL_STAGES = [DealStage.LIVE] as const;

const CLOSED = new Set<DealStage>(CLOSED_DEAL_STAGES);

export function isClosedStage(stage: DealStage): boolean {
	return CLOSED.has(stage);
}
