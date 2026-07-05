function updateStatus(text) {
  statusText.textContent = text;
  turnDot.style.background = currentPlayer === BLACK ? "#222" : "#fff";
  turnDot.style.borderColor = currentPlayer === BLACK ? "#fff" : "#333";
}

function updateTurnStatus() {
  if (gameOver) {
    return;
  }
  const who = currentPlayer === BLACK ? "黑棋" : "白棋";
  const budgetNote = stonesLeftThisTurn > 1 ? `（本回合 ${stonesLeftThisTurn} 子）` : "";
  if (mode === "pve" && currentPlayer === BLACK) {
    updateStatus(`轮到你啦（黑棋）${budgetNote}`);
  } else {
    updateStatus(`轮到${who}${budgetNote}`);
  }
}

function drawBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameType === "connect4") {
    drawConnect4Board();
    return;
  }

  if (gameType === "tictactoe") {
    drawTicTacToeBoard();
    return;
  }

  for (let i = 1; i <= boardCols; i += 1) {
    const pos = i * cellSize;
    ctx.strokeStyle = "#8c5a26";
    ctx.lineWidth = 1.4;

    ctx.beginPath();
    ctx.moveTo(cellSize, pos);
    ctx.lineTo(boardCols * cellSize, pos);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pos, cellSize);
    ctx.lineTo(pos, boardCols * cellSize);
    ctx.stroke();
  }

  // Star points depend on board size: 15x15 uses 5 points, 19x19 uses the 9 standard hoshi.
  const starPoints = getStarPoints();
  ctx.fillStyle = "#7a471a";
  for (const [r, c] of starPoints) {
    drawStar(r, c);
  }

  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] !== EMPTY) {
        drawStone(r, c, board[r][c]);
      }
    }
  }

  if (blinkOn) {
    for (const stone of getLastTurnStones()) {
      drawLastMoveMarker(stone.row, stone.col);
    }
  }

  drawThreats();
}

function getStarPoints() {
  if (boardCols === 19) {
    const lines = [3, 9, 15];
    const points = [];
    for (const r of lines) {
      for (const c of lines) {
        points.push([r, c]);
      }
    }
    return points;
  }
  return [
    [3, 3],
    [3, 11],
    [11, 3],
    [11, 11],
    [7, 7]
  ];
}

function getLastTurnStones() {
  if (moveHistory.length === 0) {
    return [];
  }
  const lastPlayer = moveHistory[moveHistory.length - 1].player;
  const stones = [];
  for (let i = moveHistory.length - 1; i >= 0; i -= 1) {
    if (moveHistory[i].player === lastPlayer) {
      stones.push(moveHistory[i]);
    } else {
      break;
    }
  }
  return stones;
}

function drawStar(row, col) {
  const x = (col + 1) * cellSize;
  const y = (row + 1) * cellSize;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(4.5, cellSize * 0.16), 0, Math.PI * 2);
  ctx.fill();
}

function drawStone(row, col, player) {
  const x = (col + 1) * cellSize;
  const y = (row + 1) * cellSize;
  drawDisc(x, y, cellSize * 0.43, player);
}

function drawDisc(x, y, radius, player) {
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
  drawLastMoveRing((col + 1) * cellSize, (row + 1) * cellSize, cellSize * 0.48);
}

function drawLastMoveRing(x, y, radius) {
  ctx.save();
  ctx.strokeStyle = "#ffeb3b";
  ctx.lineWidth = Math.max(2, radius * 0.17);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#ff8a00";
  ctx.lineWidth = Math.max(1.5, radius * 0.08);
  ctx.beginPath();
  ctx.moveTo(x - radius * 0.45, y);
  ctx.lineTo(x + radius * 0.45, y);
  ctx.stroke();
  ctx.restore();
}

function threatCenter(row, col) {
  if (gameType === "connect4") {
    const { cell, originX, originY } = gridGeometry();
    return { x: originX + (col + 0.5) * cell, y: originY + (row + 0.5) * cell, radius: cell * 0.4 };
  }
  if (gameType === "tictactoe") {
    const { cell, originX, originY } = gridGeometry();
    return { x: originX + (col + 0.5) * cell, y: originY + (row + 0.5) * cell, radius: cell * 0.32 };
  }
  return { x: (col + 1) * cellSize, y: (row + 1) * cellSize, radius: cellSize * 0.43 };
}

function drawThreats() {
  if (!threatHighlightEnabled || gameOver || !threats || threats.length === 0) {
    return;
  }

  const criticalCells = new Set();
  for (const threat of threats) {
    if (threat.level === "critical") {
      for (const cell of threat.cells) {
        criticalCells.add(`${cell.row}.${cell.col}`);
      }
    }
  }

  const pulse = blinkOn ? 1 : 0.5;

  // Open three (活三 等): 不堵下一手就成活四，用醒目的橙色光圈标出三颗子。
  for (const threat of threats) {
    if (threat.level !== "danger") {
      continue;
    }
    for (const cell of threat.cells) {
      if (criticalCells.has(`${cell.row}.${cell.col}`)) {
        continue;
      }
      const { x, y, radius } = threatCenter(cell.row, cell.col);
      drawThreatRing(x, y, radius * 1.12, "#ff6f00", 0.5 + 0.45 * pulse, radius * 0.16, 12);
    }
  }

  // Bold red glow on the stones that form the must-block line (stones only, no gaps).
  for (const threat of threats) {
    if (threat.level !== "critical") {
      continue;
    }
    for (const cell of threat.cells) {
      const { x, y, radius } = threatCenter(cell.row, cell.col);
      drawThreatRing(x, y, radius * 1.16, "#ff3b30", 0.55 + 0.45 * pulse, radius * 0.17, 14);
    }
  }
}

function drawThreatRing(x, y, radius, color, alpha, lineWidth, glow) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, lineWidth);
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
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

  if (row < 0 || row >= boardRows || col < 0 || col >= boardCols) {
    return null;
  }
  return { row, col };
}

function gridGeometry() {
  const cell = Math.min(canvas.width / boardCols, canvas.height / boardRows);
  const originX = (canvas.width - cell * boardCols) / 2;
  const originY = (canvas.height - cell * boardRows) / 2;
  return { cell, originX, originY };
}

function drawConnect4Board() {
  const { cell, originX, originY } = gridGeometry();

  ctx.fillStyle = "#e0a95e";
  ctx.fillRect(originX, originY, cell * boardCols, cell * boardRows);

  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      const x = originX + (c + 0.5) * cell;
      const y = originY + (r + 0.5) * cell;
      const radius = cell * 0.4;
      if (board[r][c] === EMPTY) {
        ctx.fillStyle = "#9c6323";
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#00000040";
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        drawDisc(x, y, radius, board[r][c]);
      }
    }
  }

  if (blinkOn) {
    for (const stone of getLastTurnStones()) {
      const x = originX + (stone.col + 0.5) * cell;
      const y = originY + (stone.row + 0.5) * cell;
      drawLastMoveRing(x, y, cell * 0.44);
    }
  }

  drawThreats();
}

function drawTicTacToeBoard() {
  const { cell, originX, originY } = gridGeometry();
  const gridW = cell * boardCols;
  const gridH = cell * boardRows;

  ctx.fillStyle = "#f6e3bd";
  ctx.fillRect(originX, originY, gridW, gridH);

  ctx.strokeStyle = "#a9752f";
  ctx.lineWidth = Math.max(3, cell * 0.045);
  for (let i = 1; i < boardCols; i += 1) {
    const x = originX + i * cell;
    ctx.beginPath();
    ctx.moveTo(x, originY);
    ctx.lineTo(x, originY + gridH);
    ctx.stroke();
  }
  for (let i = 1; i < boardRows; i += 1) {
    const y = originY + i * cell;
    ctx.beginPath();
    ctx.moveTo(originX, y);
    ctx.lineTo(originX + gridW, y);
    ctx.stroke();
  }

  for (let r = 0; r < boardRows; r += 1) {
    for (let c = 0; c < boardCols; c += 1) {
      if (board[r][c] !== EMPTY) {
        const x = originX + (c + 0.5) * cell;
        const y = originY + (r + 0.5) * cell;
        drawDisc(x, y, cell * 0.32, board[r][c]);
      }
    }
  }

  if (blinkOn) {
    for (const stone of getLastTurnStones()) {
      const x = originX + (stone.col + 0.5) * cell;
      const y = originY + (stone.row + 0.5) * cell;
      drawLastMoveRing(x, y, cell * 0.38);
    }
  }

  drawThreats();
}

function getGridCell(event) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (event.clientX - rect.left) * scaleX;
  const y = (event.clientY - rect.top) * scaleY;
  const { cell, originX, originY } = gridGeometry();
  const col = Math.floor((x - originX) / cell);
  const row = Math.floor((y - originY) / cell);
  if (row < 0 || row >= boardRows || col < 0 || col >= boardCols) {
    return null;
  }
  return { row, col };
}

function resizeBoard() {
  if (gameType === "connect4") {
    const cell = 76;
    canvas.width = boardCols * cell;
    canvas.height = boardRows * cell;
    canvas.style.width = `${canvas.width}px`;
    canvas.style.aspectRatio = `${boardCols} / ${boardRows}`;
    cellSize = cell;
    drawBoard();
    return;
  }

  if (gameType === "tictactoe") {
    const size = 420;
    canvas.width = size;
    canvas.height = size;
    canvas.style.width = `${size}px`;
    canvas.style.aspectRatio = "1 / 1";
    cellSize = size / boardCols;
    drawBoard();
    return;
  }

  const base = boardCols === 19 ? 660 : 540;
  canvas.width = base;
  canvas.height = base;
  canvas.style.width = `${base}px`;
  canvas.style.aspectRatio = "1 / 1";
  cellSize = canvas.width / (boardCols + 1);
  drawBoard();
}

function showCelebration(text) {
  if (!celebration || !confettiLayer || !winnerBanner) {
    return;
  }

  winnerBanner.textContent = text;
  winnerBanner.classList.remove("draw");
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

function showDraw(text) {
  if (!celebration || !confettiLayer || !winnerBanner) {
    return;
  }
  winnerBanner.textContent = text;
  winnerBanner.classList.add("draw");
  celebration.classList.remove("hidden");
  confettiLayer.innerHTML = "";
}
