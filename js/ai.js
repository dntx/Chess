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

  const blockMove = findInstantWinMove(BLACK);
  if (blockMove) {
    return blockMove;
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
