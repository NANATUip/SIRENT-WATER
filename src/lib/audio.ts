// Web Audio API Synthesizer for Submarine Sonar Game
class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;
  private backgroundNoiseNode: BiquadFilterNode | null = null;

  constructor() {
    // Lazy initialized on first user gesture
  }

  private init() {
    if (this.ctx) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.startAmbientSeaNoise();
    } catch (e) {
      console.error('Web Audio API not supported', e);
    }
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    this.init();
    if (this.ctx) {
      if (muted) {
        this.ctx.suspend();
      } else {
        this.ctx.resume();
      }
    }
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('No context');
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private startAmbientSeaNoise() {
    if (!this.ctx || this.isMuted) return;

    try {
      // Create continuous low-frequency water hum
      const buffer = this.createNoiseBuffer();
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(80, this.ctx.currentTime); // Deep ocean murmur

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      source.start();
    } catch (e) {
      console.warn('Failed to start ambient sea noise:', e);
    }
  }

  // Classical submarine "PING!" sound
  public playSonarPing(volume: number = 0.8, pitchMult: number = 1.0) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    
    // Core pitch oscillator
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    
    // High-to-low ping frequency sweep
    const startFreq = 1600 * pitchMult;
    const endFreq = 1000 * pitchMult;
    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.15);
    osc.frequency.setValueAtTime(endFreq, t + 0.15);
    osc.frequency.linearRampToValueAtTime(endFreq * 0.9, t + 1.2);

    // Sonar decay curve
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume * 0.8, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(volume * 0.4, t + 0.25);
    // long reverberation trail
    gain.gain.exponentialRampToValueAtTime(0.001, t + 1.8);

    // Filter to give it a submarine "metallic resonant" shell
    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(1100 * pitchMult, t);
    bandpass.Q.setValueAtTime(4.0, t);

    // Distortion or subtle feedback
    osc.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(t);
    osc.stop(t + 2.0);
  }

  // Short sonar echo bleep
  public playEcho(panX: number = 0, volumeMultiplier: number = 0.3) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;

    osc.type = 'sine';
    osc.frequency.setValueAtTime(950, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.2 * volumeMultiplier, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

    let destination: AudioNode = this.ctx.destination;
    if (panner) {
      panner.pan.setValueAtTime(Math.max(-1, Math.min(1, panX)), t);
      gain.connect(panner);
      destination = panner;
    } else {
      osc.connect(gain);
    }

    if (panner) {
      osc.connect(gain);
    }
    gain.connect(destination);

    osc.start(t);
    osc.stop(t + 0.4);
  }

  // Torpedo release pressurized hydraulic water ejector hiss
  public playLaunch() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    try {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(150, t);
      filter.frequency.exponentialRampToValueAtTime(2000, t + 0.4);
      filter.Q.setValueAtTime(1.5, t);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.6, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.65);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(t);
      noise.stop(t + 0.7);
    } catch (e) {
      // Fallback simple sound if buffer fails
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, t);
      osc.frequency.exponentialRampToValueAtTime(300, t + 0.5);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.5);
    }
  }

  // Deep underwater explosion
  public playExplosion(volume: number = 1.0) {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    try {
      // Noise component for water displacement hiss/bubbles
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.setValueAtTime(220, t);
      noiseFilter.frequency.exponentialRampToValueAtTime(40, t + 1.2);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(volume * 0.8, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.ctx.destination);
      noise.start(t);
      noise.stop(t + 1.6);

      // Low frequency rumble oscillator for pressure shockwave
      const rumbler = this.ctx.createOscillator();
      rumbler.type = 'triangle';
      rumbler.frequency.setValueAtTime(55, t);
      rumbler.frequency.linearRampToValueAtTime(15, t + 1.4);

      const rumbleGain = this.ctx.createGain();
      rumbleGain.gain.setValueAtTime(volume * 1.5, t);
      rumbleGain.gain.linearRampToValueAtTime(volume * 0.4, t + 0.4);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, t + 1.4);

      rumbler.connect(rumbleGain);
      rumbleGain.connect(this.ctx.destination);
      rumbler.start(t);
      rumbler.stop(t + 1.5);
    } catch (e) {
      // Simple synth fallback
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(60, t);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume * 0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.8);
    }
  }

  // Torpedo incoming alert warning sound (Alternating klaxon)
  private klaxonInterval: any = null;
  public startKlaxon() {
    this.init();
    if (!this.ctx || this.isMuted || this.klaxonInterval) return;

    let toggle = false;
    this.klaxonInterval = setInterval(() => {
      if (!this.ctx || this.isMuted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(toggle ? 440 : 380, t);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(650, t);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(t);
      osc.stop(t + 0.45);
      toggle = !toggle;
    }, 550);
  }

  public stopKlaxon() {
    if (this.klaxonInterval) {
      clearInterval(this.klaxonInterval);
      this.klaxonInterval = null;
    }
  }

  // Faint creaking hull under pressure sound
  public playCreak() {
    this.init();
    if (!this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    // slow frequency modulation to sound metallic and breaking
    osc.frequency.linearRampToValueAtTime(140, t + 0.8);

    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(15, t);
    
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(45, t);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.08, t + 0.1);
    gain.gain.linearRampToValueAtTime(0.04, t + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    lfo.start(t);
    osc.start(t);
    
    lfo.stop(t + 1.0);
    osc.stop(t + 1.0);
  }
}

export const audio = new SoundSynthesizer();
