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

  const mover = currentPlayer;
  if (!placeStone(pos.row, pos.col, mover)) {
    return;
  }

  if (finishIfEnded(pos.row, pos.col, mover)) {
    return;
  }

  syncTurnState();

  if (currentPlayer === mover) {
    updateStatus(`${mover === BLACK ? "黑棋" : "白棋"}还需落子 ${stonesLeftThisTurn} 子`);
    return;
  }

  if (mode === "pve" && currentPlayer === WHITE) {
    updateStatus("电脑正在思考...");
    aiTimerId = setTimeout(() => {
      aiTimerId = null;
      aiMove();
    }, 300);
  } else {
    updateTurnStatus();
  }
}

function undoMove() {
  if (gameOver) {
    updateStatus("棋局已结束，请点击“重新开始”");
    return;
  }

  if (moveHistory.length === 0) {
    updateStatus("还没有可以悔棋的落子哦");
    return;
  }

  if (aiTimerId) {
    clearTimeout(aiTimerId);
    aiTimerId = null;
  }

  if (mode === "pvp") {
    const move = moveHistory.pop();
    board[move.row][move.col] = EMPTY;
  } else {
    do {
      const move = moveHistory.pop();
      board[move.row][move.col] = EMPTY;
    } while (
      moveHistory.length > 0 &&
      !(deriveTurnState(moveHistory.length).player === BLACK && isFreshTurnStart(moveHistory.length))
    );
  }

  syncTurnState();
  playSound("undo");
  drawBoard();

  const budgetNote = stonesLeftThisTurn > 1 ? `（本回合 ${stonesLeftThisTurn} 子）` : "";
  if (mode === "pvp") {
    updateStatus(`已悔棋，${currentPlayer === BLACK ? "轮到黑棋" : "轮到白棋"}${budgetNote}`);
  } else {
    updateStatus(`已悔棋，轮到你啦（黑棋）${budgetNote}`);
  }
}

setInterval(() => {
  blinkOn = !blinkOn;
  drawBoard();
}, 420);

canvas.addEventListener("click", handleHumanMove);
undoBtn.addEventListener("click", () => {
  ensureAudioContext();
  undoMove();
});
resetBtn.addEventListener("click", resetGame);
modeSelect.addEventListener("change", resetGame);
gameTypeSelect.addEventListener("change", resetGame);
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

bgmStyle = bgmStyleSelect.value;
bgmVolumeValue = Number(bgmVolume.value) / 100;
resetGame();
