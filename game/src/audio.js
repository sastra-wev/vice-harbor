// audio.js — every sound in Vice Harbor is synthesized with WebAudio:
// a tropical chord loop, an engine hum that follows speed, police sirens,
// gunshots, thuds and pickups. No audio files, nothing fetched.

const TROPICAL_CHORDS = [
  [261.63, 329.63, 392.0, 493.88], // Cmaj7
  [220.0, 261.63, 329.63, 392.0], // Am7
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [196.0, 246.94, 293.66, 392.0], // G add
];

export class HarborAudio {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.muted = false;
    this.chordIndex = 0;
    this.nextChordAt = 0;
    this.engineOscillator = null;
    this.engineGain = null;
    this.sirenOscillator = null;
    this.sirenGain = null;
  }

  unlockAudio() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.context = new AudioCtor();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.5;
    this.masterGain.connect(this.context.destination);

    this.engineOscillator = this.context.createOscillator();
    this.engineOscillator.type = 'sawtooth';
    this.engineOscillator.frequency.value = 55;
    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0;
    this.engineOscillator.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);
    this.engineOscillator.start();

    this.sirenOscillator = this.context.createOscillator();
    this.sirenOscillator.type = 'triangle';
    this.sirenOscillator.frequency.value = 700;
    this.sirenGain = this.context.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOscillator.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);
    this.sirenOscillator.start();
    this.nextChordAt = this.context.currentTime + 0.1;
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.5, this.context.currentTime, 0.05);
    }
  }

  playTone(freqFrom, freqTo, duration, type, volume, delay = 0) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqTo), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  playNoise(duration, volume, filterFreq) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime;
    const length = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start(t0);
  }

  playGunshot() {
    this.playNoise(0.13, 0.5, 2600);
    this.playTone(160, 45, 0.1, 'square', 0.22);
  }

  playCrash(strength) {
    this.playNoise(0.22, Math.min(0.6, 0.2 + strength * 0.05), 700);
    this.playTone(90, 40, 0.2, 'sawtooth', 0.2);
  }

  playPickup() {
    this.playTone(660, 660, 0.09, 'sine', 0.25);
    this.playTone(880, 880, 0.12, 'sine', 0.25, 0.08);
  }

  playCashReward() {
    this.playTone(523, 523, 0.09, 'triangle', 0.3);
    this.playTone(659, 659, 0.09, 'triangle', 0.3, 0.08);
    this.playTone(784, 784, 0.16, 'triangle', 0.32, 0.16);
  }

  playBustedSting() {
    this.playTone(392, 392, 0.16, 'square', 0.2);
    this.playTone(311, 311, 0.16, 'square', 0.2, 0.16);
    this.playTone(233, 220, 0.34, 'square', 0.22, 0.32);
  }

  playDoorSlam() {
    this.playNoise(0.07, 0.3, 500);
  }

  updateAudio(dt, game) {
    if (!this.context) return;
    const now = this.context.currentTime;
    // Music: slow tropical chords with a soft marimba-style pluck on top.
    if (now >= this.nextChordAt) {
      const chord = TROPICAL_CHORDS[this.chordIndex % TROPICAL_CHORDS.length];
      for (const freq of chord) this.playTone(freq, freq, 2.6, 'triangle', 0.05);
      this.playTone(chord[1] * 2, chord[1] * 2, 0.5, 'sine', 0.05, 0.15);
      this.playTone(chord[2] * 2, chord[2] * 2, 0.4, 'sine', 0.04, 0.55);
      this.chordIndex++;
      this.nextChordAt = now + 2.8;
    }
    // Engine hum follows the player's car speed.
    const car = game.player.car;
    const speed = car ? Math.abs(car.speed) : 0;
    const engineLevel = car && !this.muted ? Math.min(0.11, speed / 2600) : 0;
    this.engineGain.gain.setTargetAtTime(engineLevel, now, 0.08);
    if (car) this.engineOscillator.frequency.setTargetAtTime(50 + speed * 0.55, now, 0.08);
    // Siren swells when a patrol car is close.
    let sirenLevel = 0;
    if (game.wanted > 0 && game.policeCars.length > 0) {
      let nearest = Infinity;
      for (const cop of game.policeCars) {
        const d = Math.hypot(cop.x - game.player.x, cop.y - game.player.y);
        if (d < nearest) nearest = d;
      }
      sirenLevel = nearest < 560 ? Math.max(0, 0.055 * (1 - nearest / 640)) : 0;
    }
    this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : sirenLevel, now, 0.12);
    if (sirenLevel > 0) this.sirenOscillator.frequency.setTargetAtTime(690 + Math.sin(now * 5.2) * 190, now, 0.03);
    void dt;
  }
}
