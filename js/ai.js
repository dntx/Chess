function chooseAiMove() {
  if (gameType === "connect4") {
    return chooseConnect4Move();
  }

  const config = difficultyConfig[difficulty] || difficultyConfig.normal;
  const centerIndex = Math.floor(boardCols / 2);

  const winMove = findInstantWinMove(WHITE);
  if (winMove) {
    return winMove;
  }

  // 一回合可下多子的棋种（六子棋）：若本回合就能连成获胜（如连四补 2 子成 6），
  // 直接赢 —— 优先于去堵对手：我们这回合先赢，对手根本没有落子机会。
  const multiStoneWin = findMultiStoneWinMove(WHITE);
  if (multiStoneWin) {
    return multiStoneWin;
  }

  const blockMove = findInstantWinMove(BLACK);
  if (blockMove) {
    return blockMove;
  }

  const humanThreats = findThreats().filter((t) => t.player === BLACK);

  // Must-block: the human could win on their very next turn (六子棋连四 等需多子完成的)。
  const criticalBlock = blockBestThreatCell(humanThreats.filter((t) => t.level === "critical"), BLACK);
  if (criticalBlock) {
    return criticalBlock;
  }

  // If we can force our own win this move — create more winning spots than the opponent
  // can block in one turn (e.g. turn our own 活三 into 活四) — race instead of passively
  // blocking the human's 活三: our 活四 wins before their 活三 ever matures.
  const forcedWin = findForcedWinMove(WHITE);
  if (forcedWin) {
    return forcedWin;
  }

  // Otherwise block the human's 活三 (danger) so it can't become a 活四 for free.
  const dangerBlock = blockBestThreatCell(humanThreats.filter((t) => t.level === "danger"), BLACK);
  if (dangerBlock) {
    return dangerBlock;
  }

  const candidates = [];
  const hasAnyMove = moveHistory.length > 0;

  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] !== EMPTY) {
        continue;
      }

      if (config.useNeighborFilter && hasAnyMove && !hasNeighbor(r, c, 1)) {
        continue;
      }

      const attack = evaluatePoint(r, c, WHITE);
      const defense = evaluatePoint(r, c, BLACK);
      const forkAttack = evaluatePotentialFork(r, c, WHITE);
      const forkDefense = evaluatePotentialFork(r, c, BLACK);
      const centerBias = (boardCols - 1) - (Math.abs(centerIndex - r) + Math.abs(centerIndex - c));
      const score =
        attack * config.attack +
        defense * config.defense +
        forkAttack * 0.6 +
        forkDefense * 0.52 +
        centerBias * config.center +
        Math.random() * config.randomNoise;

      candidates.push({ row: r, col: c, score });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  const poolSize = Math.min(config.topPool, candidates.length);
  const pickIndex = Math.floor(Math.random() * poolSize);
  return candidates[pickIndex];
}

function chooseConnect4Move() {
  const config = difficultyConfig[difficulty] || difficultyConfig.normal;
  const centerCol = Math.floor(boardCols / 2);

  // Immediate winning drop.
  for (let c = 0; c < boardCols; c += 1) {
    const r = gravityDropRow(c);
    if (r < 0) {
      continue;
    }
    board[r][c] = WHITE;
    const wins = hasWin(r, c, WHITE);
    board[r][c] = EMPTY;
    if (wins) {
      return { row: r, col: c };
    }
  }

  // Block opponent's immediate winning drop.
  for (let c = 0; c < boardCols; c += 1) {
    const r = gravityDropRow(c);
    if (r < 0) {
      continue;
    }
    board[r][c] = BLACK;
    const wins = hasWin(r, c, BLACK);
    board[r][c] = EMPTY;
    if (wins) {
      return { row: r, col: c };
    }
  }

  // Force a win via a double threat: a drop that creates two winning drops at once
  // (the opponent can only block one). Same helper the intersection games use.
  const forcedWin = findForcedWinMove(WHITE);
  if (forcedWin) {
    return forcedWin;
  }

  const candidates = [];
  for (let c = 0; c < boardCols; c += 1) {
    const r = gravityDropRow(c);
    if (r < 0) {
      continue;
    }
    const attack = evaluatePoint(r, c, WHITE);
    const defense = evaluatePoint(r, c, BLACK);
    const centerBias = (boardCols - Math.abs(centerCol - c)) * 2;
    const score =
      attack * config.attack +
      defense * config.defense +
      centerBias * config.center +
      Math.random() * config.randomNoise;
    candidates.push({ row: r, col: c, score });
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b.score - a.score);
  const poolSize = Math.min(config.topPool, candidates.length);
  const pickIndex = Math.floor(Math.random() * poolSize);
  return candidates[pickIndex];
}

function aiMove() {
  if (gameOver || currentPlayer !== WHITE) {
    return;
  }

  const move = chooseAiMove();
  if (!move) {
    return;
  }

  placeStone(move.row, move.col, WHITE);

  if (finishIfEnded(move.row, move.col, WHITE)) {
    return;
  }

  syncTurnState();

  if (currentPlayer === WHITE) {
    updateStatus("电脑落子中...");
    aiTimerId = setTimeout(() => {
      aiTimerId = null;
      aiMove();
    }, 320);
  } else {
    updateTurnStatus();
  }
}

function evaluatePoint(row, col, player) {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  let totalScore = 0;

  for (const [dr, dc] of dirs) {
    let count = 1;
    let openEnds = 0;

    let r = row + dr;
    let c = col + dc;
    while (isInside(r, c) && board[r][c] === player) {
      count += 1;
      r += dr;
      c += dc;
    }
    if (isInside(r, c) && board[r][c] === EMPTY) {
      openEnds += 1;
    }

    r = row - dr;
    c = col - dc;
    while (isInside(r, c) && board[r][c] === player) {
      count += 1;
      r -= dr;
      c -= dc;
    }
    if (isInside(r, c) && board[r][c] === EMPTY) {
      openEnds += 1;
    }

    totalScore += scorePattern(count, openEnds);
  }

  return totalScore;
}

function hasNeighbor(row, col, distance) {
  for (let dr = -distance; dr <= distance; dr += 1) {
    for (let dc = -distance; dc <= distance; dc += 1) {
      if (dr === 0 && dc === 0) {
        continue;
      }
      const nr = row + dr;
      const nc = col + dc;
      if (isInside(nr, nc) && board[nr][nc] !== EMPTY) {
        return true;
      }
    }
  }
  return false;
}

function findInstantWinMove(player) {
  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] !== EMPTY) {
        continue;
      }
      board[r][c] = player;
      const wins = hasWin(r, c, player);
      board[r][c] = EMPTY;
      if (wins) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

// Find a move that neutralizes the opponent's dangerous shapes in `threatList`.
// Picks the cell that leaves the opponent with the fewest remaining threats
// (critical weighs far more than danger); ties broken by our own offensive value.
// Works for every difficulty and independent of the on-screen hint toggle.
function blockBestThreatCell(threatList, opponent) {
  if (threatList.length === 0) {
    return null;
  }

  const me = opponent === BLACK ? WHITE : BLACK;
  const seen = new Set();
  const candidates = [];
  for (const threat of threatList) {
    for (const gain of threat.gains) {
      const key = `${gain.row}.${gain.col}`;
      if (!seen.has(key) && board[gain.row][gain.col] === EMPTY && isPlayableCell(gain.row, gain.col)) {
        seen.add(key);
        candidates.push(gain);
      }
    }
  }
  if (candidates.length === 0) {
    return null;
  }

  let best = null;
  for (const cell of candidates) {
    board[cell.row][cell.col] = me;
    let crit = 0;
    let dang = 0;
    for (const threat of findThreats()) {
      if (threat.player !== opponent) {
        continue;
      }
      if (threat.level === "critical") {
        crit += 1;
      } else {
        dang += 1;
      }
    }
    board[cell.row][cell.col] = EMPTY;
    const attack = evaluatePoint(cell.row, cell.col, me);
    if (
      best === null ||
      crit < best.crit ||
      (crit === best.crit && dang < best.dang) ||
      (crit === best.crit && dang === best.dang && attack > best.attack)
    ) {
      best = { row: cell.row, col: cell.col, crit, dang, attack };
    }
  }

  return best ? { row: best.row, col: best.col } : null;
}

// A move that creates MORE immediate winning spots than the opponent can block in one
// turn is a forced win (the opponent blocks stonesPerTurn of them, at least one remains).
// 五子棋/四子棋/三子棋 need >=2 spots (活四/双四); 六子棋(每回合 2 子) need >=3.
function findForcedWinMove(player) {
  const stonesPerTurn = gameType === "connect6" ? 2 : 1;
  const needed = stonesPerTurn + 1;
  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] !== EMPTY || !isPlayableCell(r, c) || !hasNeighbor(r, c, 1)) {
        continue;
      }
      board[r][c] = player;
      const spots = countImmediateWinSpots(player, needed);
      board[r][c] = EMPTY;
      if (spots >= needed) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

// Count distinct empty cells where `player` could immediately complete a win, capped.
function countImmediateWinSpots(player, cap) {
  let count = 0;
  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] !== EMPTY || !isPlayableCell(r, c)) {
        continue;
      }
      board[r][c] = player;
      const wins = hasWin(r, c, player);
      board[r][c] = EMPTY;
      if (wins) {
        count += 1;
        if (count >= cap) {
          return count;
        }
      }
    }
  }
  return count;
}

// A game that places several stones per turn (六子棋) can finish THIS turn even when it
// needs more than one stone: if we own a critical line whose empty gaps fit within the
// remaining stone budget, play one gap now — the chained follow-up stone completes the win.
// This must beat blocking: we finish before the opponent ever gets to move.
function findMultiStoneWinMove(player) {
  if (stonesLeftThisTurn < 2) {
    return null;
  }
  // Try each candidate first stone; if it leaves an immediate one-stone win, the chained
  // follow-up stone finishes the win THIS turn (e.g. 六子棋 connecting a 连四 into 6).
  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] !== EMPTY || !isPlayableCell(r, c) || !hasNeighbor(r, c, 1)) {
        continue;
      }
      board[r][c] = player;
      const followUp = findInstantWinMove(player);
      board[r][c] = EMPTY;
      if (followUp) {
        return { row: r, col: c };
      }
    }
  }
  return null;
}

function evaluatePotentialFork(row, col, player) {
  board[row][col] = player;
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  let strongLines = 0;

  for (const [dr, dc] of dirs) {
    let count = 1;
    let openEnds = 0;

    let r = row + dr;
    let c = col + dc;
    while (isInside(r, c) && board[r][c] === player) {
      count += 1;
      r += dr;
      c += dc;
    }
    if (isInside(r, c) && board[r][c] === EMPTY) {
      openEnds += 1;
    }

    r = row - dr;
    c = col - dc;
    while (isInside(r, c) && board[r][c] === player) {
      count += 1;
      r -= dr;
      c -= dc;
    }
    if (isInside(r, c) && board[r][c] === EMPTY) {
      openEnds += 1;
    }

    if (count >= 3 && openEnds >= 1) {
      strongLines += 1;
    }
  }

  board[row][col] = EMPTY;
  if (strongLines >= 2) {
    return 1800;
  }
  if (strongLines === 1) {
    return 460;
  }
  return 0;
}

function scorePattern(count, openEnds) {
  if (count >= 5) {
    return 100000;
  }
  if (count === 4 && openEnds === 2) {
    return 18000;
  }
  if (count === 4 && openEnds === 1) {
    return 4000;
  }
  if (count === 3 && openEnds === 2) {
    return 2200;
  }
  if (count === 3 && openEnds === 1) {
    return 500;
  }
  if (count === 2 && openEnds === 2) {
    return 260;
  }
  if (count === 2 && openEnds === 1) {
    return 80;
  }
  if (count === 1 && openEnds === 2) {
    return 20;
  }
  return 4;
}
