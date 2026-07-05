function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
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
  board = createBoard();
  gameOver = false;
  blinkOn = true;
  moveHistory = [];
  lastMove = null;
  mode = modeSelect.value;
  difficulty = difficultySelect.value;
  gameType = gameTypeSelect.value;
  winLength = gameType === "connect6" ? 6 : 5;
  syncTurnState();
  hideCelebration();
  updateStatus(
    gameType === "connect6"
      ? "六子棋：黑棋先手，第一手只下 1 子"
      : "黑棋先手，开始吧！"
  );
  drawBoard();
}

function placeStone(row, col, player) {
  if (board[row][col] !== EMPTY || gameOver) {
    return false;
  }
  board[row][col] = player;
  moveHistory.push({ row, col, player });
  lastMove = { row, col, player };
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
    r < BOARD_SIZE &&
    c >= 0 &&
    c < BOARD_SIZE &&
    board[r][c] === player
  ) {
    count += 1;
    r += dr;
    c += dc;
  }
  return count;
}

function isBoardFull() {
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] === EMPTY) {
        return false;
      }
    }
  }
  return true;
}

function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function finishIfEnded(row, col, player) {
  if (hasWin(row, col, player)) {
    gameOver = true;
    const winnerText = player === BLACK ? "黑棋" : "白棋";
    playSound("win");
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
