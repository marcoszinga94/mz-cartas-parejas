let audioCtx = null;

export function puedeUsarAudio() {
  return typeof window !== 'undefined'
    ? !!navigator.userActivation?.isActive
    : true;
}

function getCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tono(ctx, { freq, start, dur, type = 'sine', vol = 0.15, freqEnd }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + start + dur);
  gain.gain.setValueAtTime(0, ctx.currentTime + start);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + dur + 0.05);
}

export class Sonidos {
  constructor() {
    this.activo = true;
  }
  setActivo(v) { this.activo = !!v; }
  desbloquear() {
    if (typeof window === 'undefined') return;
    getCtx();
  }
  tocar(nombre) {
    if (!this.activo || typeof window === 'undefined') return;
    const ctx = getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;
    switch (nombre) {
      case 'punto':
        tono(ctx, { freq: 523.25, start: 0, dur: 0.12, type: 'sine', vol: 0.2 });
        tono(ctx, { freq: 783.99, start: 0.09, dur: 0.2, type: 'sine', vol: 0.18 });
        break;
      case 'flip':
        tono(ctx, { freq: 300, start: 0, dur: 0.08, type: 'triangle', vol: 0.12, freqEnd: 600 });
        break;
      case 'tic':
        tono(ctx, { freq: 880, start: 0, dur: 0.05, type: 'square', vol: 0.05 });
        break;
      case 'timeout':
        tono(ctx, { freq: 392, start: 0, dur: 0.25, type: 'sawtooth', vol: 0.15, freqEnd: 220 });
        break;
      case 'fin':
        tono(ctx, { freq: 523.25, start: 0, dur: 0.15, type: 'sine', vol: 0.18 });
        tono(ctx, { freq: 659.25, start: 0.12, dur: 0.15, type: 'sine', vol: 0.18 });
        tono(ctx, { freq: 783.99, start: 0.24, dur: 0.3, type: 'sine', vol: 0.2 });
        break;
    }
  }
}