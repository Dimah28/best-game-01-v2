// Stormkite: sound. Everything is synthesized with WebAudio — wind, thunder,
// chimes, bells — so the game ships no audio files. The context is created on
// the first gesture; before that every call is a silent no-op.

/** Build the sound board. Call unlock() from the first user gesture. */
export function createAudio() {
  const audio = {
    ctx: null,
    master: null,
    windGain: null,
    enabled: false,
  };

  /** Create the context and start the wind bed. Safe to call twice. */
  audio.unlock = () => {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new Ctx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = 0.5;
      audio.master.connect(audio.ctx.destination);
      audio.enabled = true;
      startWind(audio);
    } catch {
      audio.enabled = false;
    }
  };

  /** Set the wind bed's strength (0..1) from the gale. */
  audio.setWind = (level) => {
    if (!audio.enabled || !audio.windGain) return;
    audio.windGain.gain.setTargetAtTime(0.02 + level * 0.1, audio.ctx.currentTime, 0.4);
  };

  /** Short helpers, each guarded so silence never throws. */
  audio.blip = (freq, dur, type, vol) => tone(audio, freq, dur, type, vol, 0);
  audio.chime = () => {
    tone(audio, 880, 0.18, 'sine', 0.12, 0);
    tone(audio, 1318, 0.22, 'sine', 0.08, 0.05);
  };
  audio.zap = () => {
    tone(audio, 1600, 0.12, 'sawtooth', 0.1, 0);
    tone(audio, 220, 0.3, 'sine', 0.16, 0);
    thunder(audio, 0.5);
  };
  audio.bell = () => {
    tone(audio, 523, 0.9, 'sine', 0.14, 0);
    tone(audio, 784, 0.7, 'sine', 0.07, 0.02);
    tone(audio, 1046, 0.5, 'sine', 0.04, 0.04);
  };
  audio.thunder = (power) => thunder(audio, power);
  audio.peck = () => tone(audio, 180, 0.12, 'square', 0.12, 0);
  audio.gust = () => noiseBurst(audio, 0.25, 0.1);
  audio.click = () => tone(audio, 660, 0.06, 'sine', 0.08, 0);
  audio.fanfare = () => {
    [523, 659, 784, 1046].forEach((f, i) => tone(audio, f, 0.5, 'sine', 0.12, i * 0.12));
  };
  audio.doom = () => {
    [392, 311, 233].forEach((f, i) => tone(audio, f, 0.7, 'sine', 0.12, i * 0.18));
  };
  return audio;
}

function tone(audio, freq, dur, type, vol, delay) {
  if (!audio.enabled) return;
  try {
    const t0 = audio.ctx.currentTime + delay;
    const osc = audio.ctx.createOscillator();
    const gain = audio.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  } catch { /* silence is fine */ }
}

function noiseBurst(audio, dur, vol) {
  if (!audio.enabled) return;
  try {
    const len = Math.floor(audio.ctx.sampleRate * dur);
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    const gain = audio.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
  } catch { /* silence is fine */ }
}

function thunder(audio, power) {
  noiseBurst(audio, 0.7 * power + 0.3, 0.22 * power);
}

function startWind(audio) {
  try {
    const len = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      last = last * 0.98 + (Math.random() * 2 - 1) * 0.02;
      data[i] = last * 3;
    }
    const src = audio.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = audio.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;
    const gain = audio.ctx.createGain();
    gain.gain.value = 0.03;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start();
    audio.windGain = gain;
  } catch { /* the wind stays silent */ }
}
