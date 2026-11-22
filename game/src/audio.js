// All of Palmera Heat's sound is synthesised with WebAudio — no audio files, nothing to load.
// Short oscillator blips and filtered noise cover the interface, the crimes and the crashes; a
// two-tone siren and a low engine hum run while they are needed. Everything is wrapped so a
// browser without WebAudio, or one that has not unlocked it yet, simply stays silent.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineNodes = null;
  let sirenNodes = null;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function tone(freq, seconds, type, volume, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
      osc.connect(gain).connect(master);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    } catch { /* a failed blip is silence, never an error */ }
  }

  function noise(seconds, volume, freq) {
    if (!ctx || muted) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      src.connect(filter).connect(gain).connect(master);
      src.start();
    } catch { /* silence */ }
  }

  /** The engine loop: a sawtooth whose pitch follows the car's speed. Call every frame. */
  function engine(speedRatio, running) {
    if (!ctx) return;
    try {
      if (running && !muted) {
        if (!engineNodes) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          gain.gain.value = 0;
          const filter = ctx.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 420;
          osc.connect(filter).connect(gain).connect(master);
          osc.start();
          engineNodes = { osc, gain };
        }
        engineNodes.osc.frequency.value = 55 + speedRatio * 165;
        engineNodes.gain.gain.value = 0.05 + speedRatio * 0.05;
      } else if (engineNodes) {
        engineNodes.gain.gain.value = 0;
      }
    } catch { /* silence */ }
  }

  /** The police siren: two alternating tones while any wanted level is live. */
  function siren(on) {
    if (!ctx) return;
    try {
      if (on && !muted && !sirenNodes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        gain.gain.value = 0.028;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.9;
        lfoGain.gain.value = 160;
        lfo.connect(lfoGain).connect(osc.frequency);
        osc.frequency.value = 760;
        osc.connect(gain).connect(master);
        osc.start();
        lfo.start();
        sirenNodes = { osc, gain, lfo };
      } else if ((!on || muted) && sirenNodes) {
        sirenNodes.osc.stop();
        sirenNodes.lfo.stop();
        sirenNodes = null;
      }
    } catch { /* silence */ }
  }

  return {
    unlock,
    engine,
    siren,
    blip() { tone(660, 0.09, 'square', 0.12, 990); },
    pickup() { tone(520, 0.1, 'square', 0.14, 780); setTimeout(() => tone(780, 0.14, 'square', 0.14, 1040), 70); },
    cash() { tone(880, 0.08, 'square', 0.12); setTimeout(() => tone(1320, 0.16, 'square', 0.12), 60); },
    crash(strength) { noise(0.18 + strength * 0.2, 0.2 + strength * 0.25, 900); },
    punch() { noise(0.08, 0.22, 1400); tone(140, 0.08, 'sine', 0.2, 70); },
    alarm() { tone(1180, 0.12, 'square', 0.1); setTimeout(() => tone(1180, 0.12, 'square', 0.1), 160); },
    fail() { tone(220, 0.3, 'sawtooth', 0.14, 110); },
    toggleMute() {
      muted = !muted;
      if (muted) { engine(0, false); siren(false); }
      return muted;
    },
    get muted() { return muted; },
  };
}
