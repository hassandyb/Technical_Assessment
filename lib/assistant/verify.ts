/**
 * Checks a model's wording against the facts it was given.
 *
 * A fluent answer citing farm F47 — which does not exist — is worse than no
 * answer, because it is the kind of mistake a reader cannot catch. Any answer
 * naming an unknown identifier is rejected outright rather than patched up.
 */

/** Farm and client identifiers look like F01 / C10; station ids like STATION-01. */
const IDENTIFIER = /\b[A-Z]{1,8}-?\d{2,}\b/g;

export function citedIdentifiers(text: string): string[] {
  return [...new Set(text.match(IDENTIFIER) ?? [])];
}

export function unknownIdentifiers(text: string, known: Set<string>): string[] {
  return citedIdentifiers(text).filter((id) => !known.has(id));
}

export interface Rejection {
  reason: 'UNKNOWN_IDS' | 'EMPTY';
  detail: string;
}

/** Returns null when the answer is safe to show. */
export function rejectionFor(text: string, known: Set<string>): Rejection | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { reason: 'EMPTY', detail: 'the model returned nothing' };
  }

  const unknown = unknownIdentifiers(trimmed, known);
  if (unknown.length > 0) {
    return {
      reason: 'UNKNOWN_IDS',
      detail: `the model referred to ${unknown.join(', ')}, which is not in today's plan`,
    };
  }

  return null;
}
