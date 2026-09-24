/**
 * The optional model path.
 *
 * Configured by setting ANTHROPIC_API_KEY. Without it the app says so plainly
 * and falls back to the deterministic summary — it never pretends a model
 * answered.
 *
 * The model is given the evidence and nothing else: no workbook, no engine
 * internals, no conversation history. It rephrases; it does not compute.
 */

import Anthropic from '@anthropic-ai/sdk';

export type Provider = (prompt: string) => Promise<string>;

/** Ten seconds: past that the committee is better served by the plain summary. */
const TIMEOUT_MS = 10_000;

export const SYSTEM_PROMPT = [
  'You explain a produced agricultural export plan to a Production and Commercial committee.',
  'Use only the JSON facts in the user message. Never calculate, estimate or infer a number that is not present.',
  'Only mention farm, client, segment or station identifiers that appear in those facts.',
  'If the facts do not answer the question, say that it is unavailable.',
  'Reply with two to four plain sentences. No preamble, no markdown, no bullet points.',
].join(' ');

export function configuredProvider(): Provider | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });

  return async (prompt) => {
    const response = await client.messages.create(
      {
        model: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',
        max_tokens: 4096,
        // Phrasing supplied facts is simple work; low effort keeps it quick and cheap.
        output_config: { effort: 'low' },
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      },
      // The SDK takes milliseconds, and retries can multiply this, so keep it tight.
      { timeout: TIMEOUT_MS, maxRetries: 1 },
    );

    if (response.stop_reason === 'refusal') {
      throw new Error('The model declined to answer.');
    }

    return response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();
  };
}
