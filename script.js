const BOARD_SIZE = 15;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;

const canvas = document.getElementById("boardCanvas");
const ctx = canvas.getContext("2d");
const modeSelect = document.getElementById("modeSelect");
const difficultySelect = document.getElementById("difficultySelect");
const undoBtn = document.getElementById("undoBtn");
const resetBtn = document.getElementById("resetBtn");
const soundToggle = document.getElementById("soundToggle");
const bgmToggle = document.getElementById("bgmToggle");
const bgmStyleSelect = document.getElementById("bgmStyleSelect");
const bgmVolume = document.getElementById("bgmVolume");
const statusText = document.getElementById("statusText");
const turnDot = document.getElementById("turnDot");
const celebration = document.getElementById("celebration");
const confettiLayer = document.getElementById("confettiLayer");
const winnerBanner = document.getElementById("winnerBanner");

let board = createBoard();
let currentPlayer = BLACK;
let gameOver = false;
let mode = modeSelect.value;
let difficulty = difficultySelect.value;
let cellSize = canvas.width / (BOARD_SIZE + 1);
let moveHistory = [];
let lastMove = null;
let blinkOn = true;
let aiTimerId = null;
let audioCtx = null;
let bgmTimerId = null;
let bgmStep = 0;
let bgmStyle = "happy";
let bgmVolumeValue = 0.36;

const BGM_SCORES = {
  happy: [
    { ms: 300, lead: [659.25, 783.99], pad: [523.25, 659.25, 783.99], bass: 130.81 },
    { ms: 300, lead: [698.46], pad: [523.25, 698.46, 783.99], bass: 146.83 },
    { ms: 320, lead: [783.99, 880], pad: [587.33, 739.99, 880], bass: 146.83 },
    { ms: 280, lead: [698.46], pad: [587.33, 698.46, 880], bass: 164.81 },
    { ms: 300, lead: [659.25, 587.33], pad: [523.25, 659.25, 783.99], bass: 130.81 },
    { ms: 300, lead: [523.25], pad: [440, 554.37, 659.25], bass: 110 },
    { ms: 320, lead: [587.33, 659.25], pad: [493.88, 587.33, 739.99], bass: 123.47 },
    { ms: 260, lead: [523.25], pad: [392, 523.25, 659.25], bass: 98 }
  ],
  calm: [
    { ms: 420, lead: [523.25], pad: [392, 493.88, 587.33], bass: 98 },
    { ms: 420, lead: [587.33], pad: [440, 554.37, 659.25], bass: 110 },
    { ms: 460, lead: [659.25], pad: [493.88, 587.33, 739.99], bass: 123.47 },
    { ms: 420, lead: [587.33], pad: [440, 554.37, 659.25], bass: 110 },
    { ms: 440, lead: [523.25], pad: [392, 493.88, 587.33], bass: 98 },
    { ms: 480, lead: [493.88], pad: [349.23, 440, 523.25], bass: 87.31 },
    { ms: 420, lead: [440], pad: [329.63, 440, 523.25], bass: 82.41 },
    { ms: 500, lead: [392], pad: [293.66, 392, 493.88], bass: 73.42 }
  ],
  tense: [
    { ms: 220, lead: [659.25, 783.99], pad: [523.25, 622.25], bass: 130.81 },
    { ms: 220, lead: [622.25], pad: [493.88, 622.25], bass: 123.47 },
    { ms: 240, lead: [587.33, 698.46], pad: [466.16, 587.33], bass: 116.54 },
    { ms: 220, lead: [554.37], pad: [440, 554.37], bass: 110 },
    { ms: 220, lead: [659.25, 783.99], pad: [523.25, 622.25], bass: 130.81 },
    { ms: 220, lead: [622.25], pad: [493.88, 622.25], bass: 123.47 },
    { ms: 240, lead: [698.46, 830.61], pad: [466.16, 698.46], bass: 116.54 },
    { ms: 220, lead: [587.33], pad: [415.3, 587.33], bass: 103.83 }
  ]
};

const centerIndex = Math.floor(BOARD_SIZE / 2);
const difficultyConfig = {
  easy: {
    attack: 1.02,
    defense: 0.94,
    center: 0.85,
    randomNoise: 230,
    topPool: 5,
    useNeighborFilter: false
  },
  normal: {
    attack: 1.2,
    defense: 1.16,
    center: 1.05,
    randomNoise: 65,
    topPool: 2,
    useNeighborFilter: true
  },
  hard: {
    attack: 1.32,
    defense: 1.3,
    center: 1.12,
    randomNoise: 0,
    topPool: 1,
    useNeighborFilter: true
  }
};

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(EMPTY));
}

function resetGame() {
  if (aiTimerId) {
    clearTimeout(aiTimerId);
    aiTimerId = null;
  }
  board = createBoard();
  currentPlayer = BLACK;
  gameOver = false;
  blinkOn = true;
  moveHistory = [];
  lastMove = null;
  mode = modeSelect.value;
  difficulty = difficultySelect.value;
  hideCelebration();
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

  // Star points: four corners plus the center only.
  const starPoints = [
    [3, 3],
    [3, 11],
    [11, 3],
    [11, 11],
    [7, 7]
  ];
  ctx.fillStyle = "#7a471a";
  for (const [r, c] of starPoints) {
    drawStar(r, c);
  }

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== EMPTY) {
        drawStone(r, c, board[r][c]);
      }
    }
  }

  if (lastMove && blinkOn) {
    drawLastMoveMarker(lastMove.row, lastMove.col);
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

function drawLastMoveMarker(row, col) {
  const x = (col + 1) * cellSize;
  const y = (row + 1) * cellSize;
  const radius = cellSize * 0.48;

  ctx.save();
  ctx.strokeStyle = "#ffeb3b";
  ctx.lineWidth = Math.max(2, cellSize * 0.08);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#ff8a00";
  ctx.lineWidth = Math.max(1.5, cellSize * 0.04);
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.45, y);
  ctx.lineTo(x + radius * 0.45, y);
  ctx.stroke();
  ctx.restore();
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
  lastMove = { row, col, player };
  playSound("place", player);
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
    aiTimerId = setTimeout(() => {
      aiTimerId = null;
      aiMove();
    }, 260);
  } else {
    updateStatus(currentPlayer === BLACK ? "轮到黑棋" : "轮到白棋");
  }
}

function aiMove() {
  if (gameOver || currentPlayer !== WHITE) {
    return;
  }

  const config = difficultyConfig[difficulty] || difficultyConfig.normal;
  const winMove = findInstantWinMove(WHITE);
  if (winMove) {
    placeStone(winMove.row, winMove.col, WHITE);
    if (finishIfEnded(winMove.row, winMove.col, WHITE)) {
      return;
    }
    switchPlayer();
    updateStatus("轮到你啦（黑棋）");
    return;
  }

  const blockMove = findInstantWinMove(BLACK);
  if (blockMove) {
    placeStone(blockMove.row, blockMove.col, WHITE);
    if (finishIfEnded(blockMove.row, blockMove.col, WHITE)) {
      return;
    }
    switchPlayer();
    updateStatus("轮到你啦（黑棋）");
    return;
  }

  const candidates = [];
  const hasAnyMove = moveHistory.length > 0;

  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
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
      const centerBias = (BOARD_SIZE - 1) - (Math.abs(centerIndex - r) + Math.abs(centerIndex - c));
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
    return;
  }

  candidates.sort((a, b) => b.score - a.score);
  const poolSize = Math.min(config.topPool, candidates.length);
  const pickIndex = Math.floor(Math.random() * poolSize);
  const bestMove = candidates[pickIndex];

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
  for (let r = 0; r < BOARD_SIZE; r += 1) {
    for (let c = 0; c < BOARD_SIZE; c += 1) {
      if (board[r][c] !== EMPTY) {
        continue;
      }
      board[r][c] = player;
      const wins = hasFive(r, c, player);
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

function isInside(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function undoMove() {
  if (moveHistory.length === 0) {
    updateStatus("还没有可以悔棋的落子哦");
    return;
  }

  if (aiTimerId) {
    clearTimeout(aiTimerId);
    aiTimerId = null;
  }

  gameOver = false;

  if (mode === "pvp") {
    const move = moveHistory.pop();
    board[move.row][move.col] = EMPTY;
    currentPlayer = move.player;
  } else if (currentPlayer === WHITE) {
    const move = moveHistory.pop();
    board[move.row][move.col] = EMPTY;
    currentPlayer = BLACK;
  } else {
    const aiMoveItem = moveHistory.pop();
    board[aiMoveItem.row][aiMoveItem.col] = EMPTY;

    if (moveHistory.length > 0) {
      const humanMoveItem = moveHistory.pop();
      board[humanMoveItem.row][humanMoveItem.col] = EMPTY;
    }
    currentPlayer = BLACK;
  }

  lastMove = moveHistory.length > 0 ? moveHistory[moveHistory.length - 1] : null;
  playSound("undo");
  drawBoard();

  if (mode === "pvp") {
    updateStatus(currentPlayer === BLACK ? "已悔棋，轮到黑棋" : "已悔棋，轮到白棋");
  } else {
    updateStatus("已悔棋，轮到你啦（黑棋）");
  }
}

function ensureAudioContext() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return null;
    }
    audioCtx = new AudioCtx();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(kind, player) {
  if (!soundToggle.checked) {
    return;
  }
  const ctxAudio = ensureAudioContext();
  if (!ctxAudio) {
    return;
  }

  let freq = 520;
  let duration = 0.08;
  let gainValue = 0.05;

  if (kind === "place") {
    freq = player === BLACK ? 380 : 480;
    duration = 0.055;
    gainValue = 0.045;
  } else if (kind === "undo") {
    freq = 290;
    duration = 0.075;
    gainValue = 0.045;
  } else if (kind === "win") {
    freq = 720;
    duration = 0.16;
    gainValue = 0.06;
  } else if (kind === "draw") {
    freq = 540;
    duration = 0.1;
    gainValue = 0.04;
  }

  const now = ctxAudio.currentTime;
  const osc = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctxAudio.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playTone(freq, durationMs, gainValue, type = "sine") {
  const ctxAudio = ensureAudioContext();
  if (!ctxAudio || !freq) {
    return;
  }

  const now = ctxAudio.currentTime;
  const osc = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctxAudio.destination);
  osc.start(now);
  osc.stop(now + durationMs / 1000 + 0.03);
}

function playToneAt(freq, durationMs, gainValue, type, offsetMs) {
  const ctxAudio = ensureAudioContext();
  if (!ctxAudio || !freq) {
    return;
  }

  const start = ctxAudio.currentTime + offsetMs / 1000;
  const osc = ctxAudio.createOscillator();
  const gain = ctxAudio.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.02);
  gain.gain.linearRampToValueAtTime(gainValue * 0.78, start + durationMs / 1000 * 0.55);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);

  osc.connect(gain);
  gain.connect(ctxAudio.destination);
  osc.start(start);
  osc.stop(start + durationMs / 1000 + 0.04);
}

function playBgmLayers(step) {
  const masterGain = 0.003 + bgmVolumeValue * 0.022;
  const leadType = bgmStyle === "tense" ? "sawtooth" : "triangle";
  const padType = bgmStyle === "calm" ? "sine" : "triangle";

  if (step.pad) {
    step.pad.forEach((freq) => {
      playToneAt(freq, step.ms * 0.95, masterGain * 0.52, padType, 0);
    });
  }

  if (step.bass) {
    playToneAt(step.bass, step.ms * 0.88, masterGain * 0.72, "triangle", 0);
  }

  if (step.lead) {
    step.lead.forEach((freq, index) => {
      playToneAt(
        freq,
        step.ms * (index === 0 ? 0.72 : 0.46),
        masterGain * (index === 0 ? 1.05 : 0.8),
        leadType,
        index * Math.max(65, step.ms * 0.24)
      );
    });
  }
}

function playBgmStep() {
  if (!bgmToggle.checked) {
    stopBgm();
    return;
  }

  const score = BGM_SCORES[bgmStyle] || BGM_SCORES.happy;
  const note = score[bgmStep % score.length];
  bgmStep += 1;

  playBgmLayers(note);

  bgmTimerId = setTimeout(() => {
    bgmTimerId = null;
    playBgmStep();
  }, note.ms);
}

function startBgm() {
  if (!bgmToggle.checked || bgmTimerId) {
    return;
  }
  if (!ensureAudioContext()) {
    return;
  }
  playBgmStep();
}

function stopBgm() {
  if (bgmTimerId) {
    clearTimeout(bgmTimerId);
    bgmTimerId = null;
  }
  bgmStep = 0;
}

function restartBgm() {
  stopBgm();
  startBgm();
}

function showCelebration(text) {
  if (!celebration || !confettiLayer || !winnerBanner) {
    return;
  }

  winnerBanner.textContent = text;
  celebration.classList.remove("hidden");
  confettiLayer.innerHTML = "";

  const colors = ["#ff6b6b", "#ffd93d", "#6bcBff", "#74f089", "#ff9f68", "#c18cff"];
  const count = 34;

  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDelay = `${Math.random() * 0.28}s`;
    piece.style.animationDuration = `${1.1 + Math.random() * 0.8}s`;
    confettiLayer.appendChild(piece);
  }
}

function hideCelebration() {
  if (!celebration || !confettiLayer) {
    return;
  }
  celebration.classList.add("hidden");
  confettiLayer.innerHTML = "";
}

setInterval(() => {
  blinkOn = !blinkOn;
  drawBoard();
}, 420);

function resizeBoard() {
  const base = Math.min(540, Math.max(300, Math.floor(window.innerWidth * 0.88)));
  canvas.width = base;
  canvas.height = base;
  cellSize = canvas.width / (BOARD_SIZE + 1);
  drawBoard();
}

canvas.addEventListener("click", handleHumanMove);
undoBtn.addEventListener("click", () => {
  ensureAudioContext();
  undoMove();
});
resetBtn.addEventListener("click", resetGame);
modeSelect.addEventListener("change", resetGame);
difficultySelect.addEventListener("change", () => {
  difficulty = difficultySelect.value;
  if (mode === "pve") {
    updateStatus(`已切换难度：${difficultySelect.options[difficultySelect.selectedIndex].text}`);
  }
});
soundToggle.addEventListener("change", () => {
  if (soundToggle.checked) {
    ensureAudioContext();
  }
});
bgmToggle.addEventListener("change", () => {
  if (bgmToggle.checked) {
    startBgm();
  } else {
    stopBgm();
  }
});
bgmStyleSelect.addEventListener("change", () => {
  bgmStyle = bgmStyleSelect.value;
  if (bgmToggle.checked) {
    restartBgm();
  }
});
bgmVolume.addEventListener("input", () => {
  bgmVolumeValue = Number(bgmVolume.value) / 100;
});
document.addEventListener("click", () => {
  if (bgmToggle.checked) {
    startBgm();
  }
}, { once: true });
window.addEventListener("resize", resizeBoard);

resizeBoard();
bgmStyle = bgmStyleSelect.value;
bgmVolumeValue = Number(bgmVolume.value) / 100;
updateStatus("黑棋先手，开始吧！");
