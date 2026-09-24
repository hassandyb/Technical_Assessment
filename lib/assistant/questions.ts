/**
 * The questions the assistant is allowed to answer.
 *
 * A closed list, not free text. The assistant exists to explain a plan the
 * engine already computed, so anything outside these three has no grounded
 * answer and must be refused rather than improvised.
 */

export const QUESTIONS = [
  {
    id: 'CLIENTS_AT_RISK',
    label: 'Which clients are at risk, and why?',
  },
  {
    id: 'FARM_GAPS',
    label: 'Which farm and segment gaps matter most today?',
  },
  {
    id: 'LOCAL_RESIDUAL',
    label: 'Why is fruit going to the local market, and what is it worth?',
  },
] as const;

export type QuestionId = (typeof QUESTIONS)[number]['id'];

export function isQuestionId(value: unknown): value is QuestionId {
  return QUESTIONS.some((question) => question.id === value);
}
