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

function createReverbImpulse(ctxAudio, seconds, decay) {
  const rate = ctxAudio.sampleRate;
  const length = Math.max(1, Math.floor(seconds * rate));
  const impulse = ctxAudio.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch += 1) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i += 1) {
      const t = i / length;
      // Exponentially decaying white noise = a smooth, natural hall tail.
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return impulse;
}

function buildBgmChain(ctxAudio) {
  if (bgmChain && bgmChain.ctx === ctxAudio) {
    return bgmChain;
  }

  // Shared bus: voices -> (dry + reverb) -> tone lowpass -> compressor -> out.
  const input = ctxAudio.createGain();
  input.gain.value = 1;

  const dry = ctxAudio.createGain();
  dry.gain.value = 0.82;

  const convolver = ctxAudio.createConvolver();
  convolver.buffer = createReverbImpulse(ctxAudio, 2.6, 2.4);
  const wet = ctxAudio.createGain();
  wet.gain.value = 0.3;

  const tone = ctxAudio.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 2600;
  tone.Q.value = 0.4;

  const comp = ctxAudio.createDynamicsCompressor();
  comp.threshold.value = -20;
  comp.knee.value = 26;
  comp.ratio.value = 2.6;
  comp.attack.value = 0.006;
  comp.release.value = 0.22;

  input.connect(dry);
  input.connect(convolver);
  convolver.connect(wet);
  dry.connect(tone);
  wet.connect(tone);
  tone.connect(comp);
  comp.connect(ctxAudio.destination);

  bgmChain = { ctx: ctxAudio, input, dry, wet, tone, comp };
  return bgmChain;
}

function bgmProfileFor(style) {
  switch (style) {
    case "calm":
      return {
        lead: { type: "sine", voices: 2, detune: 6, vibrato: 5, attack: 0.05, release: 0.5, sustain: 0.78, cutoff: 2600 },
        pad: { type: "sine", voices: 2, detune: 6, attack: 0.35, release: 0.7, sustain: 0.85, cutoff: 1900 },
        bassType: "triangle",
        arp: true, arpGain: 0.14, arpType: "sine",
        perc: null,
        toneCutoff: 2200, wet: 0.42
      };
    case "tense":
      return {
        lead: { type: "sawtooth", voices: 2, detune: 12, vibrato: 0, attack: 0.008, release: 0.18, sustain: 0.6, cutoff: 3000, filterSweep: true },
        pad: { type: "triangle", voices: 2, detune: 9, attack: 0.03, release: 0.2, sustain: 0.7, cutoff: 2400 },
        bassType: "triangle",
        arp: false,
        perc: "pulse", percGain: 0.55,
        toneCutoff: 3000, wet: 0.2
      };
    case "eerie":
      return {
        lead: { type: "triangle", voices: 2, detune: 11, vibrato: 7, attack: 0.06, release: 0.6, sustain: 0.72, cutoff: 2600 },
        pad: { type: "sine", voices: 2, detune: 12, attack: 0.5, release: 0.9, sustain: 0.85, cutoff: 1700 },
        bassType: "sine",
        arp: false,
        perc: null,
        toneCutoff: 2000, wet: 0.5
      };
    case "horror":
      return {
        lead: { type: "sawtooth", voices: 2, detune: 16, vibrato: 4, attack: 0.01, release: 0.4, sustain: 0.6, cutoff: 2800, clash: 0.5 },
        pad: { type: "triangle", voices: 2, detune: 10, attack: 0.3, release: 0.8, sustain: 0.8, cutoff: 1500 },
        bassType: "sine", subBass: true,
        bass: { type: "triangle", gain: 1.15, cutoff: 2400, sub: 0.9, octaveUp: 0.6, octaveUpType: "sawtooth" },
        arp: false,
        perc: null,
        toneCutoff: 1900, wet: 0.45
      };
    case "happy":
    default:
      return {
        lead: { type: "triangle", voices: 2, detune: 9, vibrato: 4, attack: 0.015, release: 0.28, sustain: 0.7, cutoff: 3600 },
        pad: { type: "triangle", voices: 2, detune: 7, attack: 0.06, release: 0.32, sustain: 0.75, cutoff: 2600 },
        bassType: "triangle",
        arp: true, arpGain: 0.2, arpType: "triangle",
        perc: "shaker", percGain: 0.35,
        toneCutoff: 2800, wet: 0.28
      };
  }
}

function playBgmVoice(freq, durationMs, peakGain, options) {
  const ctxAudio = ensureAudioContext();
  if (!ctxAudio || !freq) {
    return;
  }

  const chain = buildBgmChain(ctxAudio);
  const opts = options || {};
  const start = ctxAudio.currentTime + (opts.delayMs || 0) / 1000;
  const dur = durationMs / 1000;
  const voices = opts.voices || 1;
  const attack = opts.attack != null ? opts.attack : 0.02;
  const release = opts.release != null ? opts.release : 0.3;
  const peak = Math.max(0.0001, peakGain / Math.sqrt(voices));
  const sustain = Math.max(0.0001, peak * (opts.sustain != null ? opts.sustain : 0.7));
  const stopAt = start + dur + release + 0.06;

  // Per-voice warmth filter, optionally sweeping down for organic movement.
  const filter = ctxAudio.createBiquadFilter();
  filter.type = "lowpass";
  const cutoff = opts.cutoff || 3200;
  filter.frequency.setValueAtTime(cutoff, start);
  if (opts.filterSweep) {
    filter.frequency.linearRampToValueAtTime(Math.max(400, cutoff * 0.5), start + dur);
  }
  filter.Q.value = opts.resonance || 0.5;

  // ADSR envelope with a smooth exponential-style release tail.
  const attackEnd = start + Math.min(attack, dur * 0.5);
  const sustainStart = attackEnd + Math.min(0.2, dur * 0.4);
  const amp = ctxAudio.createGain();
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(peak, attackEnd);
  amp.gain.linearRampToValueAtTime(sustain, sustainStart);
  amp.gain.setTargetAtTime(0.0001, start + dur, release / 3);

  filter.connect(amp);
  amp.connect(chain.input);

  let vibratoGain = null;
  if (opts.vibrato) {
    const lfo = ctxAudio.createOscillator();
    vibratoGain = ctxAudio.createGain();
    lfo.frequency.value = opts.vibratoRate || 5;
    vibratoGain.gain.value = opts.vibrato;
    lfo.connect(vibratoGain);
    lfo.start(start);
    lfo.stop(stopAt);
  }

  // Layered, slightly detuned oscillators create a warm, chorus-like body.
  const detune = opts.detune || 0;
  for (let v = 0; v < voices; v += 1) {
    const osc = ctxAudio.createOscillator();
    osc.type = opts.type || "triangle";
    osc.frequency.setValueAtTime(freq, start);
    if (voices > 1) {
      osc.detune.setValueAtTime(detune * (v / (voices - 1) - 0.5) * 2, start);
    }
    if (vibratoGain) {
      vibratoGain.connect(osc.detune);
    }
    osc.connect(filter);
    osc.start(start);
    osc.stop(stopAt);
  }

  // Dissonant overtone turns horror stabs into shrieks.
  if (opts.clash) {
    const clash = ctxAudio.createOscillator();
    const clashGain = ctxAudio.createGain();
    clash.type = "sawtooth";
    clash.frequency.setValueAtTime(freq, start);
    clash.detune.setValueAtTime(52, start);
    clashGain.gain.setValueAtTime(0.0001, start);
    clashGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * opts.clash), attackEnd);
    clashGain.gain.setTargetAtTime(0.0001, start + dur, release / 3);
    clash.connect(clashGain);
    clashGain.connect(filter);
    clash.start(start);
    clash.stop(stopAt);
  }

  // Sub-octave sine adds weight and warmth beneath a voice.
  if (opts.sub) {
    const sub = ctxAudio.createOscillator();
    const subGain = ctxAudio.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(freq / 2, start);
    subGain.gain.setValueAtTime(0.0001, start);
    subGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * opts.sub), attackEnd + 0.02);
    subGain.gain.setTargetAtTime(0.0001, start + dur, release / 3);
    sub.connect(subGain);
    subGain.connect(chain.input);
    sub.start(start);
    sub.stop(stopAt);
  }
}

function playBgmPerc(kind, peakGain, delayMs) {
  const ctxAudio = ensureAudioContext();
  if (!ctxAudio) {
    return;
  }

  const chain = buildBgmChain(ctxAudio);
  const start = ctxAudio.currentTime + (delayMs || 0) / 1000;
  const dur = kind === "pulse" ? 0.14 : 0.06;

  const length = Math.max(1, Math.floor(ctxAudio.sampleRate * dur));
  const buffer = ctxAudio.createBuffer(1, length, ctxAudio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  }

  const noise = ctxAudio.createBufferSource();
  noise.buffer = buffer;

  const band = ctxAudio.createBiquadFilter();
  band.type = kind === "pulse" ? "bandpass" : "highpass";
  band.frequency.value = kind === "pulse" ? 220 : 7200;
  band.Q.value = kind === "pulse" ? 1.2 : 0.7;

  const g = ctxAudio.createGain();
  g.gain.setValueAtTime(Math.max(0.0001, peakGain), start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

  noise.connect(band);
  band.connect(g);
  g.connect(chain.input);
  noise.start(start);
  noise.stop(start + dur + 0.02);
}

function playBgmLayers(step) {
  if (bgmMuted) {
    return;
  }

  const ctxAudio = ensureAudioContext();
  if (!ctxAudio) {
    return;
  }

  const chain = buildBgmChain(ctxAudio);
  const profile = bgmProfileFor(bgmStyle);
  const masterGain = 0.004 + bgmVolumeValue * 0.026;

  // Re-shape the shared bus to match the current mood.
  chain.tone.frequency.setTargetAtTime(profile.toneCutoff, ctxAudio.currentTime, 0.1);
  chain.wet.gain.setTargetAtTime(profile.wet, ctxAudio.currentTime, 0.1);

  if (step.pad) {
    step.pad.forEach((freq) => {
      playBgmVoice(freq, step.ms * 1.05, masterGain * 0.5, {
        type: profile.pad.type,
        voices: profile.pad.voices,
        detune: profile.pad.detune,
        attack: profile.pad.attack,
        release: profile.pad.release,
        sustain: profile.pad.sustain,
        cutoff: profile.pad.cutoff
      });
    });
  }

  if (step.bass) {
    const bass = profile.bass || {};
    const bassGain = masterGain * (bass.gain != null ? bass.gain : 0.7);
    playBgmVoice(step.bass, step.ms * 0.92, bassGain, {
      type: bass.type || profile.bassType,
      voices: 1,
      attack: 0.02,
      release: profile.pad.release,
      sustain: 0.8,
      cutoff: bass.cutoff || 1400,
      sub: profile.subBass ? (bass.sub != null ? bass.sub : 0.9) : 0
    });
    // Octave-up growl keeps the very low horror bass audible on small speakers.
    if (bass.octaveUp) {
      playBgmVoice(step.bass * 2, step.ms * 0.9, bassGain * bass.octaveUp, {
        type: bass.octaveUpType || bass.type || profile.bassType,
        voices: 1,
        attack: 0.02,
        release: profile.pad.release,
        sustain: 0.8,
        cutoff: bass.cutoff || 1400
      });
    }
  }

  // Arpeggiated inner voice derived from the chord adds shimmer and motion.
  if (step.pad && profile.arp) {
    const subdiv = Math.max(2, Math.round(step.ms / 150));
    const slot = step.ms / subdiv;
    for (let i = 0; i < subdiv; i += 1) {
      const note = step.pad[i % step.pad.length] * 2;
      playBgmVoice(note, slot * 1.4, masterGain * profile.arpGain, {
        type: profile.arpType,
        voices: 1,
        attack: 0.006,
        release: 0.14,
        sustain: 0.5,
        cutoff: 4200,
        delayMs: slot * i
      });
    }
  }

  if (step.lead && step.lead.length) {
    step.lead.forEach((freq, index) => {
      const duration = step.ms * (index === 0 ? 0.78 : 0.5);
      const gain = masterGain * (index === 0 ? 1.0 : 0.75);
      const delay = index * Math.max(60, step.ms * 0.24);
      playBgmVoice(freq, duration, gain, {
        type: profile.lead.type,
        voices: profile.lead.voices,
        detune: profile.lead.detune,
        vibrato: profile.lead.vibrato,
        vibratoRate: 5.2,
        attack: profile.lead.attack,
        release: profile.lead.release,
        sustain: profile.lead.sustain,
        cutoff: profile.lead.cutoff,
        filterSweep: profile.lead.filterSweep,
        clash: profile.lead.clash,
        delayMs: delay
      });
    });
  }

  if (profile.perc) {
    playBgmPerc(profile.perc, masterGain * profile.percGain, 0);
    if (profile.perc === "shaker") {
      playBgmPerc("shaker", masterGain * profile.percGain * 0.6, step.ms * 0.5);
    }
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
