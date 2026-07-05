function handleHumanMove(event) {
  if (gameOver) {
    return;
  }

  if (mode === "pve" && currentPlayer !== humanColor) {
    return;
  }

  let pos;
  if (gameType === "connect4" || gameType === "tictactoe") {
    const cell = getGridCell(event);
    if (!cell) {
      return;
    }
    if (gameType === "connect4") {
      const row = gravityDropRow(cell.col);
      if (row < 0) {
        return;
      }
      pos = { row, col: cell.col };
    } else {
      pos = cell;
    }
  } else {
    pos = getBoardPosition(event);
    if (!pos) {
      return;
    }
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

  if (mode === "pve" && currentPlayer === aiColor) {
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

  // 人机模式下你执白时，若盘上只有电脑的开局手（你还没落子），悔棋回到“让电脑先下”的状态。
  if (mode === "pve" && !moveHistory.some((m) => m.player === humanColor)) {
    if (aiTimerId) {
      clearTimeout(aiTimerId);
      aiTimerId = null;
    }
    for (const move of moveHistory) {
      board[move.row][move.col] = EMPTY;
    }
    moveHistory = [];
    awaitingAiStart = true;
    syncTurnState();
    refreshThreats();
    refreshStartOverlay();
    playSound("undo");
    drawBoard();
    updateStatus("已收回，电脑执黑先手～点“让小熊先下”或棋盘开始");
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
      !(deriveTurnState(moveHistory.length).player === humanColor && isFreshTurnStart(moveHistory.length))
    );
  }

  syncTurnState();
  refreshThreats();
  playSound("undo");
  drawBoard();

  const budgetNote = stonesLeftThisTurn > 1 ? `（本回合 ${stonesLeftThisTurn} 子）` : "";
  if (mode === "pvp") {
    updateStatus(`已悔棋，${currentPlayer === BLACK ? "轮到黑棋" : "轮到白棋"}${budgetNote}`);
  } else {
    updateStatus(`已悔棋，轮到你啦（${humanColor === BLACK ? "黑棋" : "白棋"}）${budgetNote}`);
  }
}

function startAiOpening() {
  if (!awaitingAiStart || gameOver) {
    return;
  }
  ensureAudioContext();
  awaitingAiStart = false;
  refreshStartOverlay();
  updateStatus("电脑落子中...");
  aiTimerId = setTimeout(() => {
    aiTimerId = null;
    aiMove();
  }, 320);
}

function showConfirmDialog(message) {
  confirmMessage.textContent = message;
  confirmModal.classList.remove("hidden");
  confirmCancelBtn.focus();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirmDialog(result) {
  if (confirmModal.classList.contains("hidden")) {
    return;
  }
  confirmModal.classList.add("hidden");
  const resolve = confirmResolver;
  confirmResolver = null;
  if (resolve) {
    resolve(result);
  }
}

function confirmDiscardIfInProgress() {
  if (moveHistory.length > 0 && !gameOver) {
    return showConfirmDialog("当前棋局还没结束，切换后会清空当前棋局，确定要切换吗？");
  }
  return Promise.resolve(true);
}

setInterval(() => {
  blinkOn = !blinkOn;
  drawBoard();
}, 420);

canvas.addEventListener("click", handleHumanMove);
startOverlay.addEventListener("click", startAiOpening);
undoBtn.addEventListener("click", () => {
  ensureAudioContext();
  undoMove();
});
resetBtn.addEventListener("click", () => resetGame(true));
modeSelect.addEventListener("change", () => {
  confirmDiscardIfInProgress().then((ok) => {
    if (ok) {
      resetGame();
    } else {
      modeSelect.value = mode;
    }
  });
});
gameTypeSelect.addEventListener("change", () => {
  confirmDiscardIfInProgress().then((ok) => {
    if (ok) {
      resetGame();
    } else {
      gameTypeSelect.value = gameType;
    }
  });
});
sideSelect.addEventListener("change", () => {
  confirmDiscardIfInProgress().then((ok) => {
    if (ok) {
      resetGame();
    } else {
      sideSelect.value = humanColor === WHITE ? "white" : "black";
    }
  });
});
confirmOkBtn.addEventListener("click", () => closeConfirmDialog(true));
confirmCancelBtn.addEventListener("click", () => closeConfirmDialog(false));
confirmModal.addEventListener("click", (event) => {
  if (event.target === confirmModal) {
    closeConfirmDialog(false);
  }
});
document.addEventListener("keydown", (event) => {
  if (confirmModal.classList.contains("hidden")) {
    return;
  }
  if (event.key === "Escape") {
    closeConfirmDialog(false);
  }
});
difficultySelect.addEventListener("change", () => {
  difficulty = difficultySelect.value;
  if (mode === "pve") {
    updateStatus(`已切换难度：${difficultySelect.options[difficultySelect.selectedIndex].text}`);
  }
});
threatToggle.addEventListener("change", () => {
  threatHighlightEnabled = threatToggle.checked;
  refreshThreats();
  drawBoard();
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
  if (bgmMuted) {
    bgmMuted = false;
    muteBtn.textContent = "🔊";
    muteBtn.classList.remove("muted");
    if (bgmToggle.checked) {
      ensureAudioContext();
      startBgm();
    }
  }
});
muteBtn.addEventListener("click", () => {
  bgmMuted = !bgmMuted;
  muteBtn.textContent = bgmMuted ? "🔇" : "🔊";
  muteBtn.classList.toggle("muted", bgmMuted);
  if (!bgmMuted && bgmToggle.checked) {
    ensureAudioContext();
    startBgm();
  }
});
document.addEventListener("click", () => {
  if (bgmToggle.checked) {
    startBgm();
  }
}, { once: true });
window.addEventListener("resize", resizeBoard);

bgmStyle = bgmStyleSelect.value;
bgmVolumeValue = Number(bgmVolume.value) / 100;
threatHighlightEnabled = threatToggle.checked;
resetGame();
