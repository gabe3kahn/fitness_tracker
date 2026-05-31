export type NYTGame = 'wordle' | 'connections' | 'mini' | 'strands';
export const NYT_GAMES: NYTGame[] = ['wordle', 'connections', 'mini', 'strands'];

export interface ParsedGame {
  game: NYTGame;
  displayName: string;
  puzzleId: string;
  solved: boolean;
  guesses?: number;    // Wordle only: 1–6, or 7 = missed (X/6)
  mistakes?: number;   // Connections only
  sessionId: string;   // stable dedup key e.g. "wordle-1234"
  xp: number;
}

const DISPLAY_NAMES: Record<NYTGame, string> = {
  wordle: 'Wordle',
  connections: 'Connections',
  mini: 'Mini Crossword',
  strands: 'Strands',
};

// XP by guess count — fewer guesses = more XP
const WORDLE_XP: Record<number, number> = { 1: 100, 2: 80, 3: 65, 4: 50, 5: 40, 6: 30 };

export function parseNYTResult(text: string): ParsedGame | null {
  const t = text.trim();
  if (!t) return null;

  // Wordle: "Wordle 1,234 4/6" or "Wordle 1,234 X/6"
  const wordleMatch = t.match(/Wordle\s+([\d,]+)\s+([1-6X])\/6/i);
  if (wordleMatch) {
    const puzzleId = wordleMatch[1].replace(/,/g, '');
    const guessStr = wordleMatch[2];
    const solved = guessStr !== 'X';
    const guesses = solved ? parseInt(guessStr, 10) : 7; // 7 = missed sentinel
    return {
      game: 'wordle',
      displayName: DISPLAY_NAMES.wordle,
      puzzleId,
      solved,
      guesses,
      sessionId: `wordle-${puzzleId}`,
      xp: solved ? (WORDLE_XP[guesses!] ?? 50) : 10,
    };
  }

  // Connections: "Connections\nPuzzle #XXX"
  const connMatch = t.match(/Connections[\s\S]*?Puzzle\s+#(\d+)/i);
  if (connMatch) {
    const puzzleId = connMatch[1];
    const rows = t.split(/[\n\r]+/).filter(l =>
      /[\u{1F7E5}\u{1F7E6}\u{1F7E8}\u{1F7E9}\u{1F7EA}]/u.test(l)
    );
    // A correct row has 4 squares all the same color
    const correctRows = rows.filter(row => {
      const squares = [...row.matchAll(/[\u{1F7E5}\u{1F7E6}\u{1F7E8}\u{1F7E9}\u{1F7EA}]/gu)];
      return squares.length === 4 && new Set(squares.map(m => m[0])).size === 1;
    });
    const solved = correctRows.length === 4;
    const mistakes = rows.length - correctRows.length;
    return {
      game: 'connections',
      displayName: DISPLAY_NAMES.connections,
      puzzleId,
      solved,
      mistakes,
      sessionId: `connections-${puzzleId}`,
      xp: solved ? Math.max(0, 60 - mistakes * 15) : 10,
    };
  }

  // NYT Mini: share text always contains "Mini Crossword"
  if (/Mini Crossword/i.test(t)) {
    const date = new Date().toLocaleDateString('en-CA');
    return {
      game: 'mini',
      displayName: DISPLAY_NAMES.mini,
      puzzleId: date,
      solved: true,
      sessionId: `mini-${date}`,
      xp: 50,
    };
  }

  // Strands: "Strands #XXX"
  const strandsMatch = t.match(/Strands\s+#(\d+)/i);
  if (strandsMatch) {
    const puzzleId = strandsMatch[1];
    return {
      game: 'strands',
      displayName: DISPLAY_NAMES.strands,
      puzzleId,
      solved: true,
      sessionId: `strands-${puzzleId}`,
      xp: 50,
    };
  }

  return null;
}
