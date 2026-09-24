/**
 * The assistant's boundaries.
 *
 * Two things must hold: a grounded answer cites identifiers a reader can look
 * up, and anything the model gets wrong or fails to deliver falls back to the
 * computed summary with the reason stated. A fluent wrong answer is the failure
 * mode that matters here, so it is tested explicitly.
 */

import { describe, expect, it } from 'vitest';
import { readWorkbook } from '@/lib/data/read-workbook';
import { validateWorkbook } from '@/lib/data/validate';
import { plan } from '@/lib/engine/plan';
import { answerQuestion } from '@/lib/assistant/answer';
import { knownIdentifiers } from '@/lib/assistant/evidence';

const result = plan(validateWorkbook(readWorkbook()));
const known = knownIdentifiers(result);

describe('grounded answers', () => {
  it('answers from the computed plan when no model is configured', async () => {
    const answer = await answerQuestion(result, 'CLIENTS_AT_RISK', null);

    expect(answer.source).toBe('deterministic');
    expect(answer.notice).toMatch(/No AI model is configured/);
    // The three genuinely at-risk clients, and the real reasons.
    expect(answer.text).toContain('C02');
    expect(answer.text).toContain('C09');
    expect(answer.text).toContain('C08');
    expect(answer.text).toMatch(/station reached its 500 t limit/i);
    expect(answer.citations).toEqual(expect.arrayContaining(['C02', 'C08', 'C09']));
  });

  it('cites only identifiers that exist in the plan', async () => {
    for (const questionId of ['CLIENTS_AT_RISK', 'FARM_GAPS', 'LOCAL_RESIDUAL'] as const) {
      const answer = await answerQuestion(result, questionId, null);
      for (const id of answer.citations) {
        expect(known.has(id)).toBe(true);
      }
    }
  });

  it('uses the numbers the engine produced, not its own', async () => {
    const answer = await answerQuestion(result, 'LOCAL_RESIDUAL', null);

    expect(answer.text).toContain('60 t');
    expect(answer.text).toContain('€4,500');
    expect(answer.text).toContain('€40,500');
  });

  it('accepts a model answer that stays within the evidence', async () => {
    const answer = await answerQuestion(
      result,
      'CLIENTS_AT_RISK',
      async () => 'C02 and C09 are short of Segment A and B. C08 stopped at the station limit.',
    );

    expect(answer.source).toBe('model');
    expect(answer.notice).toBeUndefined();
    expect(answer.citations).toEqual(expect.arrayContaining(['C02', 'C09', 'C08']));
  });
});

describe('unsupported answers and provider failure', () => {
  it('rejects an answer citing a farm that does not exist', async () => {
    const answer = await answerQuestion(
      result,
      'FARM_GAPS',
      async () => 'Farm F47 missed its Segment A target by 12 t, which is why C02 is short.',
    );

    // Fluent, plausible, and wrong: it must not reach the planner.
    expect(answer.source).toBe('deterministic');
    expect(answer.notice).toMatch(/F47/);
    expect(answer.notice).toMatch(/not in today's plan/);
    expect(answer.text).not.toContain('F47');
  });

  it('falls back honestly when the provider fails', async () => {
    const answer = await answerQuestion(result, 'FARM_GAPS', async () => {
      throw new Error('socket hang up');
    });

    expect(answer.source).toBe('deterministic');
    expect(answer.notice).toMatch(/could not be reached/);
    expect(answer.text.length).toBeGreaterThan(0);
  });

  it('falls back when the provider returns nothing', async () => {
    const answer = await answerQuestion(result, 'LOCAL_RESIDUAL', async () => '   ');

    expect(answer.source).toBe('deterministic');
    expect(answer.notice).toMatch(/returned nothing/);
  });
});
