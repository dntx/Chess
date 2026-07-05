function chooseAiMove() {
  if (gameType === "connect4") {
    return chooseConnect4Move();
  }

  // 三子棋（3x3 连 3）是已解游戏：双方最优必和。困难难度用极小化极大搜索完整
  // 博弈树，做到永不失误——无论先后手电脑都不会输，人类最好的结果只能逼平（想赢只能靠电脑失误）。
  if (gameType === "tictactoe" && difficulty === "hard") {
    const optimal = chooseTicTacToeOptimalMove();
    if (optimal) {
      return optimal;
    }
  }

  const config = difficultyConfig[difficulty] || difficultyConfig.normal;
  const centerIndex = Math.floor(boardCols / 2);

  // 危险棋型“技能”按难度启用（概率见 difficultyConfig）：
  //   简单：按概率抢/堵（ownWinChance / blockKillChance），其余靠打分 —— 明显更弱。
  //   普通：必抢自己的一步杀、必堵对手一步杀（连四等），但不处理活三这类两步杀。
  //   困难：再加抢攻(活四/双威胁)与堵活三(twoStepKill)。
  // 注：自己/对手的“一子致胜”始终处理（下方 findInstantWinMove，属基线而非技能）。
  const winMove = findInstantWinMove(aiColor);
  if (winMove) {
    return winMove;
  }

  if (config.ownWinChance >= 1 || Math.random() < config.ownWinChance) {
    // 本回合多子成杀（六子棋连四补 2 子成 6）——优先于堵：我们这回合先赢。
    const multiStoneWin = findMultiStoneWinMove(aiColor);
    if (multiStoneWin) {
      return multiStoneWin;
    }
  }

  const blockMove = findInstantWinMove(humanColor);
  if (blockMove) {
    return blockMove;
  }

  if (config.blockKillChance >= 1 || Math.random() < config.blockKillChance) {
    const humanThreats = findThreats().filter((t) => t.player === humanColor);

    // 一步杀：对手下一回合就能赢的棋型（冲四、六子棋连四）。
    const criticalBlock = blockBestThreatCell(humanThreats.filter((t) => t.level === "critical"), humanColor);
    if (criticalBlock) {
      return criticalBlock;
    }

    if (config.twoStepKill) {
      // 抢攻不过度堵：能造出对手一回合堵不完的必胜（活三走成活四 等）就先抢自己的。
      const forcedWin = findForcedWinMove(aiColor);
      if (forcedWin) {
        return forcedWin;
      }
      // 否则堵对手的活三（两步杀），以免对手白拿一个活四。
      const dangerBlock = blockBestThreatCell(humanThreats.filter((t) => t.level === "danger"), humanColor);
      if (dangerBlock) {
        return dangerBlock;
      }
    }
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

      const attack = evaluatePoint(r, c, aiColor);
      const defense = evaluatePoint(r, c, humanColor);
      const forkAttack = evaluatePotentialFork(r, c, aiColor);
      const forkDefense = evaluatePotentialFork(r, c, humanColor);
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
    board[r][c] = aiColor;
    const wins = hasWin(r, c, aiColor);
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
    board[r][c] = humanColor;
    const wins = hasWin(r, c, humanColor);
    board[r][c] = EMPTY;
    if (wins) {
      return { row: r, col: c };
    }
  }

  // Force a win via a double threat: a drop that creates two winning drops at once
  // (the opponent can only block one). Only the hard difficulty plays this actively.
  if (config.twoStepKill) {
    const forcedWin = findForcedWinMove(aiColor);
    if (forcedWin) {
      return forcedWin;
    }
  }

  const candidates = [];
  for (let c = 0; c < boardCols; c += 1) {
    const r = gravityDropRow(c);
    if (r < 0) {
      continue;
    }
    const attack = evaluatePoint(r, c, aiColor);
    const defense = evaluatePoint(r, c, humanColor);
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

// 三子棋专用最优走法（困难难度）。3x3 连 3 的博弈树极小，直接极小化极大全搜索：
// 电脑（无论执黑执白）在任何局面下都至少能逼平，对手一旦失误就会被抓住并取胜。
function chooseTicTacToeOptimalMove() {
  const empties = listEmptyCells();
  if (empties.length === 0) {
    return null;
  }

  let bestScore = -Infinity;
  const bestMoves = [];
  for (const cell of empties) {
    board[cell.row][cell.col] = aiColor;
    const score = hasWin(cell.row, cell.col, aiColor)
      ? 10
      : minimaxTicTacToe(humanColor, 1);
    board[cell.row][cell.col] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      bestMoves.length = 0;
      bestMoves.push(cell);
    } else if (score === bestScore) {
      bestMoves.push(cell);
    }
  }

  // 同分的最优走法随机挑一个，避免每局开局都一模一样。
  return bestMoves[Math.floor(Math.random() * bestMoves.length)];
}

// 从“轮到 player 落子”的局面递归求最优分值（站在电脑视角）：
// 电脑获胜 = 10 - 步数（越快赢越好），电脑落败 = 步数 - 10（越晚输越好），平局 = 0。
function minimaxTicTacToe(player, depth) {
  const empties = listEmptyCells();
  if (empties.length === 0) {
    return 0;
  }

  if (player === aiColor) {
    let best = -Infinity;
    for (const cell of empties) {
      board[cell.row][cell.col] = aiColor;
      const score = hasWin(cell.row, cell.col, aiColor)
        ? 10 - depth
        : minimaxTicTacToe(humanColor, depth + 1);
      board[cell.row][cell.col] = EMPTY;
      if (score > best) {
        best = score;
      }
    }
    return best;
  }

  let best = Infinity;
  for (const cell of empties) {
    board[cell.row][cell.col] = humanColor;
    const score = hasWin(cell.row, cell.col, humanColor)
      ? depth - 10
      : minimaxTicTacToe(aiColor, depth + 1);
    board[cell.row][cell.col] = EMPTY;
    if (score < best) {
      best = score;
    }
  }
  return best;
}

function listEmptyCells() {
  const empties = [];
  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] === EMPTY) {
        empties.push({ row: r, col: c });
      }
    }
  }
  return empties;
}

function aiMove() {
  if (gameOver || currentPlayer !== aiColor) {
    return;
  }

  const move = chooseAiMove();
  if (!move) {
    return;
  }

  placeStone(move.row, move.col, aiColor);

  if (finishIfEnded(move.row, move.col, aiColor)) {
    return;
  }

  syncTurnState();

  if (currentPlayer === aiColor) {
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
