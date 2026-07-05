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

  if (gameType === "connect4") {
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
  syncTurnState();

  const titleMap = {
    connect4: "森林小熊四子棋",
    connect6: "森林小熊六子棋"
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

function finishIfEnded(row, col, player) {
  if (hasWin(row, col, player)) {
    gameOver = true;
    const winnerText = player === BLACK ? "黑棋" : "白棋";
    playWinFanfare();
    showCelebration(`${winnerText}胜利啦！`);
    updateStatus(`${winnerText}获胜！太棒啦！`);
    return true;
  }

  if (isBoardFull()) {
    gameOver = true;
    playSound("draw");
    updateStatus("平局！棋盘满啦！");
    return true;
  }
  return false;
}
