/**
 * Produces one assistant answer.
 *
 * The deterministic summary is always computed first and is always the
 * fallback. A model answer replaces it only if one is configured, it responds
 * in time, and every identifier it mentions exists in today's plan. Otherwise
 * the planner gets the plain summary plus an honest note about why.
 *
 * The provider is injected so the failure paths can be tested without a key.
 */

import { evidenceFor, knownIdentifiers } from '@/lib/assistant/evidence';
import type { QuestionId } from '@/lib/assistant/questions';
import { QUESTIONS } from '@/lib/assistant/questions';
import { configuredProvider, type Provider } from '@/lib/assistant/provider';
import { citedIdentifiers, rejectionFor } from '@/lib/assistant/verify';
import type { PlanResult } from '@/lib/domain/types';

export type AnswerSource = 'model' | 'deterministic';

export interface AssistantAnswer {
  questionId: QuestionId;
  question: string;
  text: string;
  source: AnswerSource;
  /** Identifiers a reader can look up in the tables above. */
  citations: string[];
  /** Why the model was not used, when it was not. Always shown to the planner. */
  notice?: string;
}

function label(questionId: QuestionId): string {
  return QUESTIONS.find((question) => question.id === questionId)!.label;
}

export async function answerQuestion(
  plan: PlanResult,
  questionId: QuestionId,
  provider: Provider | null = configuredProvider(),
): Promise<AssistantAnswer> {
  const evidence = evidenceFor(plan, questionId);
  const known = knownIdentifiers(plan);

  const fallback: AssistantAnswer = {
    questionId,
    question: label(questionId),
    text: evidence.summary,
    source: 'deterministic',
    citations: evidence.citations.filter((id) => known.has(id)),
  };

  if (!provider) {
    return {
      ...fallback,
      notice: 'No AI model is configured, so this is a generated summary of the computed plan.',
    };
  }

  let reply: string;
  try {
    reply = await provider(
      `Question: ${label(questionId)}\n\nFacts:\n${JSON.stringify(evidence.facts)}`,
    );
  } catch (error) {
    console.error('Assistant provider failed', error);
    return {
      ...fallback,
      notice:
        'The AI model could not be reached, so this is a generated summary of the computed plan.',
    };
  }

  const rejection = rejectionFor(reply, known);
  if (rejection) {
    return {
      ...fallback,
      notice: `The AI answer was rejected because ${rejection.detail}. This is a generated summary of the computed plan instead.`,
    };
  }

  return {
    questionId,
    question: label(questionId),
    text: reply,
    source: 'model',
    citations: citedIdentifiers(reply),
  };
}
