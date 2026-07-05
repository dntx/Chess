function createBoard() {
  return Array.from({ length: boardRows }, () => Array(boardCols).fill(EMPTY));
}

function gravityDropRow(col) {
  for (let r = boardRows - 1; r >= 0; r -= 1) {
    if (board[r][col] === EMPTY) {
      return r;
    }
  }
  return -1;
}

function deriveTurnState(n) {
  if (gameType !== "connect6") {
    return { player: n % 2 === 0 ? BLACK : WHITE, stonesLeft: 1 };
  }
  if (n === 0) {
    return { player: BLACK, stonesLeft: 1 };
  }
  const r = n - 1;
  const turnIndexAfterFirst = Math.floor(r / 2);
  const posInTurn = r % 2;
  const player = turnIndexAfterFirst % 2 === 0 ? WHITE : BLACK;
  return { player, stonesLeft: 2 - posInTurn };
}

function isFreshTurnStart(n) {
  if (n === 0) {
    return true;
  }
  const fullSize = gameType === "connect6" ? 2 : 1;
  return deriveTurnState(n).stonesLeft === fullSize;
}

function syncTurnState() {
  const state = deriveTurnState(moveHistory.length);
  currentPlayer = state.player;
  stonesLeftThisTurn = state.stonesLeft;
}

function resetGame() {
  if (aiTimerId) {
    clearTimeout(aiTimerId);
    aiTimerId = null;
  }
  mode = modeSelect.value;
  difficulty = difficultySelect.value;
  gameType = gameTypeSelect.value;

  if (gameType === "tictactoe") {
    boardRows = 3;
    boardCols = 3;
    winLength = 3;
  } else if (gameType === "connect4") {
    boardRows = 6;
    boardCols = 7;
    winLength = 4;
  } else if (gameType === "connect6") {
    boardRows = 19;
    boardCols = 19;
    winLength = 6;
  } else {
    boardRows = 15;
    boardCols = 15;
    winLength = 5;
  }

  board = createBoard();
  gameOver = false;
  blinkOn = true;
  moveHistory = [];
  threats = [];
  syncTurnState();

  const titleMap = {
    connect4: "森林小熊四子棋",
    connect6: "森林小熊六子棋",
    tictactoe: "森林小熊三子棋"
  };
  const title = titleMap[gameType] || "森林小熊五子棋";
  gameTitle.textContent = title;
  document.title = title;
  canvas.setAttribute("aria-label", `${title}棋盘`);

  hideCelebration();
  let startMessage = "黑棋先手，开始吧！";
  if (gameType === "connect6") {
    startMessage = "六子棋：黑棋先手，第一手只下 1 子，之后每回合下 2 子";
  } else if (gameType === "connect4") {
    startMessage = "四子棋：点击一列落子，棋子会落到底部，先连成 4 子获胜";
  } else if (gameType === "tictactoe") {
    startMessage = "三子棋：点击空格落子，先连成 3 子获胜";
  }
  updateStatus(startMessage);
  resizeBoard();
}

function placeStone(row, col, player) {
  if (board[row][col] !== EMPTY || gameOver) {
    return false;
  }
  board[row][col] = player;
  moveHistory.push({ row, col, player });
  playSound("place", player);
  refreshThreats();
  drawBoard();
  return true;
}

function hasWin(row, col, player) {
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  for (const [dr, dc] of dirs) {
    let count = 1;
    count += countOneDirection(row, col, dr, dc, player);
    count += countOneDirection(row, col, -dr, -dc, player);
    if (count >= winLength) {
      return true;
    }
  }
  return false;
}

function countOneDirection(row, col, dr, dc, player) {
  let count = 0;
  let r = row + dr;
  let c = col + dc;
  while (
    r >= 0 &&
    r < boardRows &&
    c >= 0 &&
    c < boardCols &&
    board[r][c] === player
  ) {
    count += 1;
    r += dr;
    c += dc;
  }
  return count;
}

function isBoardFull() {
  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] === EMPTY) {
        return false;
      }
    }
  }
  return true;
}

function isInside(row, col) {
  return row >= 0 && row < boardRows && col >= 0 && col < boardCols;
}

function isPlayableCell(row, col) {
  if (!isInside(row, col) || board[row][col] !== EMPTY) {
    return false;
  }
  if (gameType === "connect4") {
    return gravityDropRow(col) === row;
  }
  return true;
}

// Detect "must-block" shapes for both colors so the UI can highlight them.
// Generalised by winLength + how many stones a side plays per turn:
//   critical = opponent can WIN on their very next turn. A winLength window with no
//              opponent stones whose reachable empty count <= stonesPerTurn.
//              单子棋种(五/四/三子棋) => 差 1 子(冲四类); 六子棋每回合 2 子 => 差 1~2 子
//              (连四 或 连五) 都必须堵，否则对手一回合补 2 子直接连成 6。
//   danger   = a TRUE open three: one move from an open four (活四) that then wins.
//              Needs BOTH ends of a (winLength+1) window empty, so a 眠三 (blocked one
//              side) is correctly ignored. Only meaningful when winLength >= 5.
function findThreats() {
  // NOTE: intentionally NOT gated by threatHighlightEnabled — the AI relies on this
  // for defense regardless of whether the on-screen hint is switched on. The display
  // toggle is applied in refreshThreats() instead.
  if (winLength < 3) {
    return [];
  }

  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];
  const grouped = new Map();
  const detectOpenThree = winLength >= 5;
  // 六子棋一回合下 2 子，对手下一回合能补满 2 个空的连线也算必堵；其余棋种每回合 1 子。
  const stonesPerTurn = gameType === "connect6" ? 2 : 1;

  const addThreat = (player, level, cells, gains) => {
    const key = `${player}|${level}|${cells.map((p) => `${p.row}.${p.col}`).join("_")}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = { player, level, cells, gains: [] };
      grouped.set(key, entry);
    }
    for (const gain of gains) {
      if (!entry.gains.some((g) => g.row === gain.row && g.col === gain.col)) {
        entry.gains.push(gain);
      }
    }
  };

  // Read `span` cells from (r,c) along (dr,dc). Returns null if an opponent stone
  // is inside the window, otherwise the player's stones and the empty cells.
  const scanWindow = (player, r, c, dr, dc, span) => {
    const cells = [];
    const empties = [];
    for (let k = 0; k < span; k += 1) {
      const rr = r + dr * k;
      const cc = c + dc * k;
      const value = board[rr][cc];
      if (value === player) {
        cells.push({ row: rr, col: cc });
      } else if (value === EMPTY) {
        empties.push({ row: rr, col: cc });
      } else {
        return null;
      }
    }
    return { cells, empties };
  };

  for (const player of [BLACK, WHITE]) {
    for (let r = 0; r < boardRows; r += 1) {
      for (let c = 0; c < boardCols; c += 1) {
        for (const [dr, dc] of dirs) {
          // critical: opponent can win on their very next turn — a winLength window
          // with no opponent stones whose (reachable) empty count <= stonesPerTurn.
          // 单子棋种 => 差 1 子(冲四/连三/连二); 六子棋一回合 2 子 => 差 1~2 子(连四/连五)都必堵。
          if (isInside(r + dr * (winLength - 1), c + dc * (winLength - 1))) {
            const win = scanWindow(player, r, c, dr, dc, winLength);
            if (
              win &&
              win.empties.length >= 1 &&
              win.empties.length <= stonesPerTurn &&
              win.empties.every((e) => isPlayableCell(e.row, e.col))
            ) {
              addThreat(player, "critical", win.cells, win.empties);
            }
          }

          // danger (open three): winLength+1 window, both ends empty, winLength-2 stones.
          // The two empty ends guarantee it can grow into an open four (活四).
          if (detectOpenThree && isInside(r + dr * winLength, c + dc * winLength)) {
            const open = scanWindow(player, r, c, dr, dc, winLength + 1);
            if (
              open &&
              open.cells.length === winLength - 2 &&
              board[r][c] === EMPTY &&
              board[r + dr * winLength][c + dc * winLength] === EMPTY
            ) {
              addThreat(player, "danger", open.cells, open.empties);
            }
          }
        }
      }
    }
  }

  return Array.from(grouped.values());
}

function refreshThreats() {
  threats = threatHighlightEnabled ? findThreats() : [];
}

function finishIfEnded(row, col, player) {
  if (hasWin(row, col, player)) {
    gameOver = true;
    threats = [];
    drawBoard();
    const winnerText = player === BLACK ? "黑棋" : "白棋";
    playWinFanfare();
    showCelebration(`${winnerText}胜利啦！`);
    updateStatus(`${winnerText}获胜！太棒啦！`);
    return true;
  }

  if (isBoardFull()) {
    gameOver = true;
    threats = [];
    drawBoard();
    playSound("draw");
    showDraw("平局！棋盘满啦！");
    updateStatus("平局！棋盘满啦！");
    return true;
  }
  return false;
}
