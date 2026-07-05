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

function playWinFanfare() {
  if (!soundToggle.checked) {
    return;
  }
  if (!ensureAudioContext()) {
    return;
  }

  // Bright ascending arpeggio, then a sustained major chord flourish.
  const arpeggio = [523.25, 659.25, 783.99, 1046.5];
  arpeggio.forEach((freq, index) => {
    playToneAt(freq, 160, 0.07, "triangle", index * 110);
  });

  const finalChord = [523.25, 659.25, 783.99, 1046.5];
  finalChord.forEach((freq) => {
    playToneAt(freq, 780, 0.05, "triangle", 470);
  });
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
  if (bgmMuted) {
    return;
  }
  const masterGain = 0.003 + bgmVolumeValue * 0.022;
  const leadType = bgmStyle === "tense" || bgmStyle === "horror" ? "sawtooth" : "triangle";
  const padType = bgmStyle === "calm" || bgmStyle === "eerie" ? "sine" : "triangle";

  if (step.pad) {
    step.pad.forEach((freq) => {
      playToneAt(freq, step.ms * 0.95, masterGain * 0.52, padType, 0);
      if (bgmStyle === "eerie") {
        // Detuned twin creates an unsettling beating shimmer.
        playToneAt(freq * 1.008, step.ms * 0.95, masterGain * 0.34, padType, 0);
      }
    });
  }

  if (step.bass) {
    playToneAt(step.bass, step.ms * 0.88, masterGain * 0.72, "triangle", 0);
    if (bgmStyle === "horror") {
      // Sub-octave rumble deepens the dread.
      playToneAt(step.bass / 2, step.ms * 0.98, masterGain * 0.9, "sine", 0);
    }
  }

  if (step.lead) {
    step.lead.forEach((freq, index) => {
      const duration = step.ms * (index === 0 ? 0.72 : 0.46);
      const gain = masterGain * (index === 0 ? 1.05 : 0.8);
      const delay = index * Math.max(65, step.ms * 0.24);
      playToneAt(freq, duration, gain, leadType, delay);
      if (bgmStyle === "eerie") {
        // Ghostly detuned echo.
        playToneAt(freq * 1.006, duration, gain * 0.6, leadType, delay);
      }
      if (bgmStyle === "horror") {
        // Harsh dissonant overtone turns stabs into shrieks.
        playToneAt(freq * 1.032, duration * 0.85, gain * 0.55, "sawtooth", delay);
      }
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
