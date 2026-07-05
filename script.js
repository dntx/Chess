const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const canvas = document.getElementById("boardCanvas");
const ctx = canvas.getContext("2d");
const modeSelect = document.getElementById("modeSelect");
const resetBtn = document.getElementById("resetBtn");
const statusText = document.getElementById("statusText");
const turnDot = document.getElementById("turnDot");

let board = createBoard();
let currentPlayer = BLACK;
let gameOver = false;
let mode = modeSelect.value;
let cellSize = canvas.width / (BOARD_SIZE + 1);
let moveHistory = [];

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function resetGame() {
  board = createBoard();
  currentPlayer = BLACK;
  gameOver = false;
  moveHistory = [];
  mode = modeSelect.value;
  updateStatus("黑棋先手，开始吧！");
  drawBoard();
}

function updateStatus(text) {
  statusText.textContent = text;
  turnDot.style.background = currentPlayer === BLACK ? "#222" : "#fff";
  turnDot.style.borderColor = currentPlayer === BLACK ? "#fff" : "#333";
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 1; i <= BOARD_SIZE; i += 1) {
    const pos = i * cellSize;
    ctx.strokeStyle = "#8c5a26";
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    ctx.moveTo(cellSize, pos);
    ctx.lineTo(BOARD_SIZE * cellSize, pos);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pos, cellSize);
    ctx.lineTo(pos, BOARD_SIZE * cellSize);
    ctx.stroke();
  }

  // Star points make board reading easier.
  const stars = [4, 8, 12];
  ctx.fillStyle = "#7a471a";
  for (const r of stars) {
    for (const c of stars) {
      drawStar(r, c);
    }
  }

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== EMPTY) {
        drawStone(r, c, board[r][c]);
      }
    }
  }
}

function drawStar(row, col) {
  const x = (col + 1) * cellSize;
  const y = (row + 1) * cellSize;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(2.6, cellSize * 0.07), 0, Math.PI * 2);
  ctx.fill();
}

function drawStone(row, col, player) {
  const x = (col + 1) * cellSize;
  const y = (row + 1) * cellSize;
  const radius = cellSize * 0.43;

  const gradient = ctx.createRadialGradient(
    x - radius * 0.35,
    y - radius * 0.4,
    radius * 0.25,
    x,
    y,
    radius
  );

  if (player === BLACK) {
    gradient.addColorStop(0, "#666");
    gradient.addColorStop(1, "#151515");
  } else {
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(1, "#d8d8d8");
  }

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  if (player === WHITE) {
    ctx.strokeStyle = "#808080";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function getBoardPosition(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;

  const col = Math.round(x / cellSize) - 1;
  const row = Math.round(y / cellSize) - 1;

  if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) {
    return null;
  }
  return { row, col };
}

function placeStone(row, col, player) {
  if (board[row][col] !== EMPTY || gameOver) {
    return false;
  }
  board[row][col] = player;
  moveHistory.push({ row, col, player });
  drawBoard();
  return true;
}

function hasFive(row, col, player) {
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
    if (count >= 5) {
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

function switchPlayer() {
  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
}

function finishIfEnded(row, col, player) {
  if (hasFive(row, col, player)) {
    gameOver = true;
    const winnerText = player === BLACK ? "黑棋" : "白棋";
    updateStatus(`${winnerText}获胜！太棒啦！`);
    return true;
  }

  if (isBoardFull()) {
    gameOver = true;
    updateStatus("平局！棋盘满啦！");
    return true;
  }
  return false;
}

function handleHumanMove(event) {
  if (gameOver) {
    return;
  }

  if (mode === "pve" && currentPlayer !== BLACK) {
    return;
  }

  const pos = getBoardPosition(event);
  if (!pos) {
    return;
  }

  if (!placeStone(pos.row, pos.col, currentPlayer)) {
    return;
  }

  if (finishIfEnded(pos.row, pos.col, currentPlayer)) {
    return;
  }

  switchPlayer();

  if (mode === "pve") {
    updateStatus("电脑正在思考...");
    setTimeout(aiMove, 260);
  } else {
    updateStatus(currentPlayer === BLACK ? "轮到黑棋" : "轮到白棋");
  }
}

function aiMove() {
  if (gameOver || currentPlayer !== WHITE) {
    return;
  }

  let bestScore = -Infinity;
  let bestMove = null;

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== EMPTY) {
        continue;
      }

      const attack = evaluatePoint(r, c, WHITE);
      const defense = evaluatePoint(r, c, BLACK);
      const centerBias = 14 - (Math.abs(7 - r) + Math.abs(7 - c));
      const score = attack * 1.08 + defense * 0.95 + centerBias;

      if (score > bestScore) {
        bestScore = score;
        bestMove = { row: r, col: c };
      }
    }
  }

  if (!bestMove) {
    return;
  }

  placeStone(bestMove.row, bestMove.col, WHITE);

  if (finishIfEnded(bestMove.row, bestMove.col, WHITE)) {
    return;
  }

  switchPlayer();
  updateStatus("轮到你啦（黑棋）");
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

function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function resizeBoard() {
  const base = Math.min(620, Math.max(320, Math.floor(window.innerWidth * 0.92)));
  canvas.width = base;
  canvas.height = base;
  cellSize = canvas.width / (BOARD_SIZE + 1);
  drawBoard();
}

canvas.addEventListener("click", handleHumanMove);
resetBtn.addEventListener("click", resetGame);
modeSelect.addEventListener("change", resetGame);
window.addEventListener("resize", resizeBoard);

resizeBoard();
updateStatus("黑棋先手，开始吧！");
