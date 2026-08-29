import { mergeCards, mezclarDeck, robarCarta } from './cards.js';
import { Sonidos, puedeUsarAudio } from './sound.js';
import { formatTiempo, fraccionAnillo, esTension } from './timer.js';

export function estadoInicial() {
  return {
    p1: 'Jugador 1', p2: 'Jugador 2',
    puntos1: 0, puntos2: 0,
    turno: 1,
    config: { categorias: [], tiempo: 45, rondas: 0 },
    enPartida: false,
  };
}

const mem = {};
function lsGet(k) { return (typeof localStorage !== 'undefined') ? localStorage.getItem(k) : (mem[k] ?? null); }
function lsSet(k, v) { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); else mem[k] = v; }

export function guardarEstado(s) {
  lsSet('cp.estado', JSON.stringify(s));
}

export function cargarEstado() {
  try {
    const raw = lsGet('cp.estado');
    if (!raw) return estadoInicial();
    return { ...estadoInicial(), ...JSON.parse(raw) };
  } catch {
    return estadoInicial();
  }
}

const TITULOS = { 1: 'Jugadores', 2: 'Categorías', 3: 'Tiempo y rondas' };

const sonidos = new Sonidos();
let estado = cargarEstado();
let cartasBase = [];
let cartasUsuario = [];
let pasoActual = 1;
let audioDesbloqueado = false;

function mostrarPantalla(nombre) {
  document.querySelectorAll('.pantalla').forEach(el => el.classList.add('oculto'));
  const destino = document.getElementById(`pantalla-${nombre}`);
  if (destino) destino.classList.remove('oculto');
}

function actualizarIconoSilencio() {
  document.querySelectorAll('.boton-silencio').forEach(b => {
    b.textContent = sonidos.activo ? '🔊' : '🔇';
  });
}

function sincronizarSonido() {
  const off = typeof localStorage !== 'undefined' && localStorage.getItem('cp.sonido') === 'off';
  sonidos.setActivo(!off);
  actualizarIconoSilencio();
}

function toggleSilencio() {
  sonidos.setActivo(!sonidos.activo);
  if (typeof localStorage !== 'undefined') localStorage.setItem('cp.sonido', sonidos.activo ? 'on' : 'off');
  actualizarIconoSilencio();
}

function desbloquearAudio() {
  if (audioDesbloqueado) return;
  audioDesbloqueado = true;
  sonidos.desbloquear();
}

async function cargarCartas() {
  const leer = (r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))));
  const [base, usuario] = await Promise.allSettled([
    fetch('./data/cartas.json').then(leer),
    fetch('./data/cartas-usuario.json').then(leer),
  ]);
  cartasBase = (base.status === 'fulfilled' && base.value.cartas) || [];
  cartasUsuario = (usuario.status === 'fulfilled' && usuario.value.cartas) || [];
}

function actualizarProgreso() {
  document.querySelectorAll('#paso-progreso .progreso-segmento').forEach((seg, i) => {
    seg.classList.toggle('activo', i + 1 === pasoActual);
    seg.classList.toggle('completado', i + 1 < pasoActual);
  });
}

function irAPaso(n) {
  pasoActual = n;
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById(`paso-${i}`);
    if (el) el.classList.toggle('oculto', i !== n);
  }
  const titulo = document.getElementById('paso-titulo');
  if (titulo) titulo.textContent = TITULOS[n] || '';
  actualizarProgreso();
  const btnSig = document.getElementById('btn-paso-siguiente');
  if (btnSig) btnSig.textContent = n === 3 ? 'Comenzar' : 'Siguiente';
  const btnAtras = document.getElementById('btn-paso-atras');
  if (btnAtras) btnAtras.disabled = n === 1;
}

function avisarCategorias() {
  const desc = document.querySelector('#paso-2 .paso-descripcion');
  if (!desc) return;
  desc.style.color = 'var(--frambuesa)';
  setTimeout(() => { desc.style.color = ''; }, 700);
}

function poblarAsistente() {
  const e = estado;
  const inputP1 = document.getElementById('input-p1');
  const inputP2 = document.getElementById('input-p2');
  if (inputP1) inputP1.value = e.p1 || 'Jugador 1';
  if (inputP2) inputP2.value = e.p2 || 'Jugador 2';
  const cats = e.config.categorias || [];
  document.querySelectorAll('#chips-categorias .chip').forEach(ch => {
    ch.classList.toggle('chip-activo', cats.includes(ch.dataset.categoria));
  });
  const tiempo = e.config.tiempo ?? 45;
  document.querySelectorAll('#presets-tiempo .chip').forEach(ch => {
    ch.classList.toggle('chip-activo', Number(ch.dataset.tiempo) === tiempo);
  });
  const inputRondas = document.getElementById('input-rondas');
  if (inputRondas) inputRondas.value = e.config.rondas ?? 0;
}

function siguientePaso() {
  if (pasoActual === 1) {
    const p1 = document.getElementById('input-p1');
    const p2 = document.getElementById('input-p2');
    if (p1) p1.value = p1.value.trim() || 'Jugador 1';
    if (p2) p2.value = p2.value.trim() || 'Jugador 2';
    irAPaso(2);
    return;
  }
  if (pasoActual === 2) {
    if (document.querySelectorAll('#chips-categorias .chip.chip-activo').length === 0) {
      avisarCategorias();
      return;
    }
    irAPaso(3);
    return;
  }
  if (pasoActual === 3) comenzarPartida();
}

function pasoAtras() {
  if (pasoActual > 1) irAPaso(pasoActual - 1);
}

function comenzarPartida() {
  const p1 = (document.getElementById('input-p1')?.value || '').trim() || 'Jugador 1';
  const p2 = (document.getElementById('input-p2')?.value || '').trim() || 'Jugador 2';
  const categorias = [...document.querySelectorAll('#chips-categorias .chip.chip-activo')]
    .map(ch => ch.dataset.categoria);
  const chipTiempo = document.querySelector('#presets-tiempo .chip.chip-activo');
  const tiempo = Number(chipTiempo?.dataset.tiempo) || 45;
  const rondas = Math.max(0, Number(document.getElementById('input-rondas')?.value) || 0);
  if (categorias.length === 0) {
    avisarCategorias();
    irAPaso(2);
    return;
  }
  estado.p1 = p1;
  estado.p2 = p2;
  estado.config = { categorias, tiempo, rondas };
  estado.enPartida = true;
  guardarEstado(estado);
  if (typeof window.iniciarPartida === 'function') window.iniciarPartida();
}

function toggleChip(chip) {
  chip.classList.toggle('chip-activo');
}

function seleccionarTiempo(chip) {
  document.querySelectorAll('#presets-tiempo .chip').forEach(c => {
    c.classList.toggle('chip-activo', c === chip);
  });
}

function init() {
  sincronizarSonido();
  cargarCartas();
  mostrarPantalla('inicio');

  document.addEventListener('pointerdown', desbloquearAudio);
  document.addEventListener('touchstart', desbloquearAudio);

  const btnJugar = document.getElementById('btn-jugar');
  if (btnJugar) btnJugar.addEventListener('click', () => {
    poblarAsistente();
    irAPaso(1);
    mostrarPantalla('asistente');
  });

  const btnMisCartas = document.getElementById('btn-mis-cartas');
  if (btnMisCartas) btnMisCartas.addEventListener('click', () => mostrarPantalla('miscartas'));

  document.querySelectorAll('.boton-silencio').forEach(b => b.addEventListener('click', toggleSilencio));

  document.querySelectorAll('#chips-categorias .chip').forEach(ch => ch.addEventListener('click', () => toggleChip(ch)));
  document.querySelectorAll('#presets-tiempo .chip').forEach(ch => ch.addEventListener('click', () => seleccionarTiempo(ch)));

  const btnSig = document.getElementById('btn-paso-siguiente');
  if (btnSig) btnSig.addEventListener('click', siguientePaso);

  const btnAtras = document.getElementById('btn-paso-atras');
  if (btnAtras) btnAtras.addEventListener('click', pasoAtras);

  const btnVolverInicio = document.getElementById('btn-volver-inicio');
  if (btnVolverInicio) btnVolverInicio.addEventListener('click', () => mostrarPantalla('inicio'));
}

if (typeof window !== 'undefined') {
  window.mostrarPantalla = mostrarPantalla;
}

if (typeof document !== 'undefined') {
  init();
}
