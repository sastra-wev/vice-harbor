// audio.js — all of Vice Harbor's sound, synthesized with the WebAudio API:
// a tropical chord loop, engine hum, patrol sirens, gunshots, pickups and UI.
// No audio files exist; everything is oscillators and filtered noise.

/** The whole sound engine. Created once; init() must run on a user gesture. */
export class GameAudio {
  constructor() {
    this.ctx = null; this.muted = false; this.master = null;
    this.engineOsc = null; this.engineGain = null; this.musicTimer = null; this.chordIndex = 0;
  }

  /** Build the AudioContext and start the ambient music loop. Call on first click/key. */
  initAudioOnGesture() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineHum();
    this.startTropicalMusicLoop();
  }

  /** Toggle mute (M key / HUD button). Returns the new muted flag. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime, 0.05);
    return this.muted;
  }

  /** A short oscillator blip — the building block of most effects. */
  playTone(freqFrom, freqTo, duration, type, volume, when = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain); gain.connect(this.master);
    osc.start(t); osc.stop(t + duration + 0.02);
  }

  /** Filtered noise burst — gunshots, crashes, splashes. */
  playNoiseBurst(duration, filterFreq, volume) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain(); gain.gain.value = volume;
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(t);
  }

  /** Looping engine hum whose pitch follows the player's car speed (0..1). */
  startEngineHum() {
    this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 40;
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 320;
    this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter); filter.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  /** Set engine loudness/pitch from speed ratio. */
  setEngineSound(speedRatio) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(40 + speedRatio * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(this.muted ? 0 : speedRatio * 0.06, t, 0.1);
  }

  /** Sunny marimba-ish chord loop: Cmaj7 – Am7 – Fmaj7 – G6, one chord every 2.4 s. */
  startTropicalMusicLoop() {
    const chords = [[261.6, 329.6, 392, 493.9], [220, 261.6, 329.6, 392], [174.6, 220, 261.6, 329.6], [196, 246.9, 293.7, 392]];
    const playChord = () => {
      if (!this.ctx) return;
      const chord = chords[this.chordIndex % chords.length]; this.chordIndex += 1;
      chord.forEach((freq, i) => {
        this.playTone(freq, freq, 1.5, 'triangle', 0.055, i * 0.13);
        this.playTone(freq * 2, freq * 2, 0.7, 'sine', 0.02, i * 0.13 + 0.05);
      });
      this.playTone(chord[0] / 2, chord[0] / 2, 2.0, 'sine', 0.07, 0);
    };
    playChord();
    this.musicTimer = setInterval(playChord, 2400);
  }

  playGunshotSound(far) { this.playNoiseBurst(0.13, far ? 900 : 2400, far ? 0.12 : 0.3); this.playTone(160, 50, 0.1, 'square', far ? 0.04 : 0.1); }
  playSwingSound() { this.playNoiseBurst(0.07, 1400, 0.08); }
  playThudSound() { this.playTone(120, 45, 0.16, 'sine', 0.3); this.playNoiseBurst(0.08, 500, 0.14); }
  playCrashSound() { this.playNoiseBurst(0.3, 700, 0.32); this.playTone(90, 32, 0.3, 'sawtooth', 0.14); }
  playDoorSound() { this.playTone(300, 140, 0.09, 'square', 0.1); this.playTone(190, 120, 0.08, 'square', 0.08, 0.07); }
  playPickupSound() { this.playTone(660, 660, 0.09, 'sine', 0.14); this.playTone(990, 990, 0.14, 'sine', 0.14, 0.08); }
  playSirenBlip() { this.playTone(740, 990, 0.16, 'triangle', 0.028); }
  playMissionCompleteSound() { [523, 659, 784, 1046].forEach((f, i) => this.playTone(f, f, 0.22, 'triangle', 0.13, i * 0.11)); }
  playBustedSound() { [392, 330, 262, 196].forEach((f, i) => this.playTone(f, f * 0.94, 0.26, 'square', 0.1, i * 0.15)); }
}
