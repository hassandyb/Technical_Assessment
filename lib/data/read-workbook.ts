/**
 * Reads the supplied Atlas Fresh workbook into raw rows.
 *
 * This module only extracts cells; it does not judge them. Deciding whether a
 * value is acceptable belongs to the validator, so that a bad workbook produces
 * one clear report instead of a parser crash.
 *
 * Server-side only: it touches the filesystem and must never reach the browser.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';

/** The authoritative input. Never written to, only read. */
export const WORKBOOK_PATH = path.join(
  process.cwd(),
  'data',
  'Atlas_Fresh_Production_Commercial_Data.xlsx',
);

export type RawRow = Record<string, unknown>;

export interface RawWorkbook {
  farms: RawRow[];
  clients: RawRow[];
  /** The Station sheet holds one station row... */
  station: RawRow[];
  /** ...and, lower down, a separate reference-price table per segment. */
  referencePrices: RawRow[];
}

/** Raised when the workbook cannot be read at all, as opposed to holding bad values. */
export class WorkbookReadError extends Error {
  readonly sheet?: string;

  constructor(message: string, options: { sheet?: string; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'WorkbookReadError';
    this.sheet = options.sheet;
  }
}

type Grid = (string | number | null)[][];

function sheetGrid(book: XLSX.WorkBook, sheet: string): Grid {
  const worksheet = book.Sheets[sheet];
  if (!worksheet) {
    throw new WorkbookReadError(
      `Sheet "${sheet}" is missing from the workbook. Expected sheets: Farms, Clients, Station.`,
      { sheet },
    );
  }
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
    header: 1,
    blankrows: true,
    defval: null,
  });
}

function isBlank(row: (string | number | null)[] | undefined): boolean {
  return !row || row.every((cell) => cell === null || String(cell).trim() === '');
}

/**
 * Locates a table by a column name instead of a fixed row number, so the
 * decorative title and note rows above each table cannot shift the parse.
 */
function findHeaderRow(grid: Grid, column: string, sheet: string): number {
  const index = grid.findIndex((row) =>
    row?.some((cell) => typeof cell === 'string' && cell.trim() === column),
  );
  if (index === -1) {
    throw new WorkbookReadError(
      `Sheet "${sheet}": no header row containing the column "${column}".`,
      { sheet },
    );
  }
  return index;
}

/** Reads rows under a header until the first fully blank row ends the table. */
function readTable(grid: Grid, column: string, sheet: string): RawRow[] {
  const headerIndex = findHeaderRow(grid, column, sheet);
  const header = (grid[headerIndex] ?? []).map((cell) => String(cell ?? '').trim());

  const rows: RawRow[] = [];
  for (let i = headerIndex + 1; i < grid.length; i++) {
    if (isBlank(grid[i])) break;
    const cells = grid[i] ?? [];
    const row: RawRow = {};
    header.forEach((name, column) => {
      if (name) row[name] = cells[column] ?? null;
    });
    rows.push(row);
  }
  return rows;
}

/**
 * Loads the workbook from disk. The path is injectable so tests can run against
 * fixtures without touching the delivered file.
 */
export function readWorkbook(filePath: string = WORKBOOK_PATH): RawWorkbook {
  let book: XLSX.WorkBook;
  try {
    // The ESM build of SheetJS has no bundled filesystem, so read the bytes here.
    book = XLSX.read(readFileSync(filePath), { type: 'buffer' });
  } catch (cause) {
    throw new WorkbookReadError(
      `Could not open the workbook at ${filePath}. Check that the file exists and is a valid .xlsx.`,
      { cause },
    );
  }

  const station = sheetGrid(book, 'Station');

  return {
    farms: readTable(sheetGrid(book, 'Farms'), 'farm_id', 'Farms'),
    clients: readTable(sheetGrid(book, 'Clients'), 'client_id', 'Clients'),
    station: readTable(station, 'station_id', 'Station'),
    referencePrices: readTable(station, 'segment', 'Station'),
  };
}
