'use client';

/**
 * The assistant panel: it explains the plan, it never decides it.
 *
 * Three fixed questions, because those are the three the engine can evidence.
 * Every answer states where it came from, and an answer produced without a
 * model says so in the panel rather than passing itself off as one.
 */

import { useState } from 'react';
import { Bot, Info, Loader2 } from 'lucide-react';
import type { AssistantAnswer } from '@/lib/assistant/answer';
import { QUESTIONS, type QuestionId } from '@/lib/assistant/questions';

type State =
  | { status: 'idle' }
  | { status: 'asking'; questionId: QuestionId }
  | { status: 'answered'; answer: AssistantAnswer }
  | { status: 'failed'; message: string };

export function AssistantPanel() {
  const [state, setState] = useState<State>({ status: 'idle' });

  async function ask(questionId: QuestionId) {
    setState({ status: 'asking', questionId });
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        setState({
          status: 'failed',
          message: body.message ?? 'The assistant could not answer just now.',
        });
        return;
      }
      setState({ status: 'answered', answer: (await response.json()) as AssistantAnswer });
    } catch {
      setState({
        status: 'failed',
        message: 'The assistant could not be reached. The tables above are unaffected.',
      });
    }
  }

  return (
    <section aria-labelledby="assistant-heading" className="rounded-lg border bg-card p-5">
      <div className="flex items-start gap-3">
        <Bot className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="assistant-heading" className="font-semibold">
            Explain this plan
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Answers describe the plan the server calculated. The assistant never changes an
            allocation or approves anything.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {QUESTIONS.map((question) => {
              const busy = state.status === 'asking' && state.questionId === question.id;
              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => ask(question.id)}
                  disabled={state.status === 'asking'}
                  className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
                >
                  {busy && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
                  {question.label}
                </button>
              );
            })}
          </div>

          <div aria-live="polite" className="mt-4">
            {state.status === 'asking' && (
              <p className="text-sm text-muted-foreground">Reading the computed plan…</p>
            )}

            {state.status === 'failed' && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                {state.message}
              </p>
            )}

            {state.status === 'answered' && (
              <article className="space-y-3">
                <p className="text-sm font-medium">{state.answer.question}</p>
                <p className="text-sm leading-relaxed">{state.answer.text}</p>

                {state.answer.citations.length > 0 && (
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Evidence:</span>
                    {state.answer.citations.map((id) => (
                      <span key={id} className="rounded bg-muted px-1.5 py-0.5 font-mono">
                        {id}
                      </span>
                    ))}
                  </p>
                )}

                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span>
                    {state.answer.notice ??
                      'Written by the configured AI model from the computed plan, with every identifier checked against it.'}
                  </span>
                </p>
              </article>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
