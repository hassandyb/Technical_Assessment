/**
 * Answers one of the supported questions about today's plan.
 *
 * The plan is rebuilt here rather than accepted from the browser: an answer
 * must describe what the server computed, not what a client claims it computed.
 */

import { answerQuestion } from '@/lib/assistant/answer';
import { isQuestionId } from '@/lib/assistant/questions';
import { loadPlan } from '@/lib/plan-service';

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'BAD_REQUEST', message: 'Expected a JSON body.' }, { status: 400 });
  }

  const questionId = (body as { questionId?: unknown } | null)?.questionId;
  if (!isQuestionId(questionId)) {
    return Response.json(
      {
        error: 'UNSUPPORTED_QUESTION',
        message:
          'That question is outside what this assistant can answer from the computed plan.',
      },
      { status: 400 },
    );
  }

  const outcome = loadPlan();
  if (!outcome.ok) {
    return Response.json(outcome.failure, { status: outcome.status });
  }

  return Response.json(await answerQuestion(outcome.plan, questionId));
}
