/**
 * Display formatting.
 *
 * Fixed to en-GB rather than the viewer's locale so that a number read aloud in
 * the meeting matches the number in everyone else's browser.
 */

const TONNES = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 });

const EUROS = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

export function tonnes(value: number): string {
  return `${TONNES.format(value)} t`;
}

export function euros(value: number): string {
  return EUROS.format(value);
}

export function percent(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

/** Variances need their sign kept: "-11.7 t" is the whole point of the number. */
export function signedTonnes(value: number): string {
  const rounded = Math.abs(value) < 0.05 ? 0 : value;
  return rounded > 0 ? `+${tonnes(rounded)}` : tonnes(rounded);
}
