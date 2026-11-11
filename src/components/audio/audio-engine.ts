import { BANDS, bandEnergy, createBeatDetector, createOnsetDetector, rms, smoothToward } from './analysis.js';

/**
 * Audio input + analysis (PRD §7). Optional: nothing is created until a source is chosen,
 * and every `use*()` must be called from a user gesture (click / XR select).
 *
 * Sources: microphone · playback capture (system / tab audio via getDisplayMedia, desktop Chrome)
 *          · audio file (played aloud) · built-in demo beat · any Web Audio node.
 */
export type AudioSignal = 'volume' | 'bass' | 'mid' | 'high' | 'onset' | 'beat';
export type AudioSourceKind = 'none' | 'microphone' | 'playback' | 'file' | 'demo' | 'node';
export type AudioStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported' | 'error';
export type AudioState = { status: AudioStatus; source: AudioSourceKind; message: string };

export type AudioEngineOptions = {
  fftSize?: number;
  /** Smoothing time constant (s) for volume and band signals. */
  smoothing?: number;
  /** Multiplies raw levels before clamping (simple input gain). */
  gain?: number;
};

const SUPPORTS = () => ({
  microphone: Boolean(navigator.mediaDevices?.getUserMedia),
  playbackCapture: Boolean(navigator.mediaDevices?.getDisplayMedia) && !/OculusBrowser|Quest/i.test(navigator.userAgent),
});

export const createAudioEngine = ({ fftSize = 1024, smoothing = 0.08, gain = 1 }: AudioEngineOptions = {}) => {
  let context: AudioContext | undefined;
  let analyser: AnalyserNode | undefined;
  let spectrum = new Uint8Array(fftSize / 2);
  let waveform = new Float32Array(fftSize);
  let teardown: (() => void) | undefined;
  let state: AudioState = { status: 'idle', source: 'none', message: 'No audio input' };
  const listeners = new Set<(state: AudioState) => void>();
  const signals: Record<AudioSignal, number> = { volume: 0, bass: 0, mid: 0, high: 0, onset: 0, beat: 0 };
  const onset = createOnsetDetector();
  const beat = createBeatDetector();

  const setState = (next: Partial<AudioState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
  };

  const ensureContext = async () => {
    if (!context) {
      context = new AudioContext();
      analyser = context.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.6;
      spectrum = new Uint8Array(analyser.frequencyBinCount);
      waveform = new Float32Array(analyser.fftSize);
    }
    if (context.state === 'suspended') await context.resume();
    return { context, analyser: analyser! };
  };

  const stop = () => {
    teardown?.();
    teardown = undefined;
    for (const key of Object.keys(signals) as AudioSignal[]) signals[key] = 0;
    setState({ status: 'idle', source: 'none', message: 'No audio input' });
  };

  const fail = (source: AudioSourceKind, error: unknown) => {
    const name = (error as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      setState({ status: 'denied', source, message: 'Permission denied. The scene keeps running without audio.' });
    } else if (name === 'NotFoundError') {
      setState({ status: 'error', source, message: 'No input device found.' });
    } else {
      setState({ status: 'error', source, message: `Audio error: ${(error as Error)?.message ?? String(error)}` });
    }
  };

  const useStream = async (source: AudioSourceKind, stream: MediaStream, label: string) => {
    const { context, analyser } = await ensureContext();
    const node = context.createMediaStreamSource(stream);
    node.connect(analyser); // analysed only: never routed to speakers (no feedback)
    teardown = () => {
      node.disconnect();
      stream.getTracks().forEach((track) => track.stop());
    };
    stream.getAudioTracks()[0]?.addEventListener('ended', () => state.source === source && stop());
    setState({ status: 'active', source, message: label });
  };

  const engine = {
    get state() {
      return state;
    },
    supports: SUPPORTS(),
    onState(listener: (state: AudioState) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async useMicrophone(): Promise<AudioState> {
      stop();
      if (!engine.supports.microphone) {
        setState({ status: 'unsupported', source: 'microphone', message: 'Microphone input is not available here.' });
        return state;
      }
      setState({ status: 'requesting', source: 'microphone', message: 'Waiting for microphone permission...' });
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        await useStream('microphone', stream, 'Microphone');
      } catch (error) {
        fail('microphone', error);
      }
      return state;
    },

    /** System / tab audio. Chrome desktop: tick "Share tab audio" (macOS) or "Share system audio" (Windows). */
    async usePlaybackCapture(): Promise<AudioState> {
      stop();
      if (!engine.supports.playbackCapture) {
        setState({
          status: 'unsupported',
          source: 'playback',
          message: 'Playback capture is not supported in this browser. Use the microphone or a file.',
        });
        return state;
      }
      setState({ status: 'requesting', source: 'playback', message: 'Choose a tab or screen and enable audio sharing...' });
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        stream.getVideoTracks().forEach((track) => track.stop());
        if (stream.getAudioTracks().length === 0) {
          setState({ status: 'error', source: 'playback', message: 'No audio was shared. Enable "Share audio" in the picker.' });
          return state;
        }
        await useStream('playback', stream, 'Playback capture');
      } catch (error) {
        fail('playback', error);
      }
      return state;
    },

    /** Play and analyse an audio file (URL, File or Blob). */
    async useFile(file: string | Blob, { loop = true } = {}): Promise<AudioState> {
      stop();
      try {
        const { context, analyser } = await ensureContext();
        const url = typeof file === 'string' ? file : URL.createObjectURL(file);
        const element = new Audio();
        element.crossOrigin = 'anonymous';
        element.loop = loop;
        element.src = url;
        const node = context.createMediaElementSource(element);
        node.connect(analyser);
        node.connect(context.destination);
        await element.play();
        teardown = () => {
          element.pause();
          node.disconnect();
          if (typeof file !== 'string') URL.revokeObjectURL(url);
        };
        setState({ status: 'active', source: 'file', message: typeof file === 'string' ? file.split('/').pop()! : (file as File).name ?? 'Audio file' });
      } catch (error) {
        fail('file', error);
      }
      return state;
    },

    /** Desktop helper: open the file picker, then play the chosen file. */
    pickFile(): void {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'audio/*';
      input.onchange = () => input.files?.[0] && void engine.useFile(input.files[0]);
      input.click();
    },

    /** Analyse any Web Audio node (synths, players, effects). It is not routed to the speakers. */
    async useNode(node: AudioNode, label = 'Web Audio node'): Promise<AudioState> {
      stop();
      const { analyser } = await ensureContext();
      node.connect(analyser);
      teardown = () => node.disconnect(analyser);
      setState({ status: 'active', source: 'node', message: label });
      return state;
    },

    /** Built-in 120 BPM demo beat, so audio reactivity can be tried without a mic or file. */
    async useDemo(): Promise<AudioState> {
      stop();
      const { context, analyser } = await ensureContext();
      const out = context.createGain();
      out.gain.value = 0.35;
      out.connect(analyser);
      out.connect(context.destination);
      const stopBeat = startDemoBeat(context, out);
      teardown = () => {
        stopBeat();
        out.disconnect();
      };
      setState({ status: 'active', source: 'demo', message: 'Demo beat (120 BPM)' });
      return state;
    },

    stop,

    /** Smoothed 0..1 signals; `onset` / `beat` are 1 only on the frame they fire. */
    get: (signal: AudioSignal): number => signals[signal],
    getSpectrum: (): Uint8Array => spectrum,
    getWaveform: (): Float32Array => waveform,

    /** Call once per frame (createExperience does this when audio is enabled). */
    update(dt: number): void {
      if (!analyser || !context || state.status !== 'active') return;
      analyser.getByteFrequencyData(spectrum);
      analyser.getFloatTimeDomainData(waveform);
      const level = (value: number) => Math.min(1, value * gain);
      const { sampleRate } = context;
      const bass = level(bandEnergy(spectrum, sampleRate, analyser.fftSize, ...BANDS.bass));
      const mid = level(bandEnergy(spectrum, sampleRate, analyser.fftSize, ...BANDS.mid));
      const high = level(bandEnergy(spectrum, sampleRate, analyser.fftSize, ...BANDS.high) * 2);
      signals.volume = smoothToward(signals.volume, level(rms(waveform) * 2.5), dt, smoothing);
      signals.bass = smoothToward(signals.bass, bass, dt, smoothing);
      signals.mid = smoothToward(signals.mid, mid, dt, smoothing);
      signals.high = smoothToward(signals.high, high, dt, smoothing);
      signals.onset = onset((bass + mid + high) / 3, dt) ? 1 : 0;
      signals.beat = beat(bass, dt) ? 1 : 0;
    },

    dispose(): void {
      stop();
      listeners.clear();
      void context?.close();
      context = undefined;
      analyser = undefined;
    },
  };

  return engine;
};

export type AudioEngine = ReturnType<typeof createAudioEngine>;

/** Tiny scheduled kick + hat + bass pattern. Returns a stop function. */
const startDemoBeat = (context: AudioContext, out: AudioNode): (() => void) => {
  const step = 60 / 120 / 2; // eighth notes at 120 BPM
  const noise = context.createBuffer(1, context.sampleRate * 0.1, context.sampleRate);
  noise.getChannelData(0).forEach((_, i, data) => (data[i] = Math.random() * 2 - 1));
  const bassNotes = [55, 55, 65.41, 49];
  let next = context.currentTime + 0.05;
  let index = 0;

  const kick = (t: number) => {
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    env.gain.setValueAtTime(1, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + 0.4);
  };
  const hat = (t: number, level: number) => {
    const src = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const env = context.createGain();
    src.buffer = noise;
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    env.gain.setValueAtTime(level, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(filter).connect(env).connect(out);
    src.start(t);
  };
  const bass = (t: number, hz: number) => {
    const osc = context.createOscillator();
    const env = context.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = hz;
    env.gain.setValueAtTime(0.25, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + step * 0.9);
    osc.connect(env).connect(out);
    osc.start(t);
    osc.stop(t + step);
  };

  const timer = setInterval(() => {
    while (next < context.currentTime + 0.2) {
      if (index % 4 === 0) kick(next);
      hat(next, index % 2 ? 0.35 : 0.15);
      if (index % 2 === 1) bass(next, bassNotes[Math.floor(index / 8) % bassNotes.length]!);
      next += step;
      index += 1;
    }
  }, 50);
  return () => clearInterval(timer);
};
