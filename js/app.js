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
    b.classList.toggle('silencio-off', !sonidos.activo);
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

let mazo = [];
let prevId = null;
let timerId = null;
let transicionTimer = null;
let resolviendo = false;
let enRondaExtra = false;

const COLORES_CONFETI = ['var(--frambuesa)', 'var(--rosa)', 'var(--lavanda)', 'var(--dorado)'];

const CIRCUNFERENCIA_ANILLO = 100.53;

function renderMarcador() {
  const marcador = document.getElementById('marcador');
  if (marcador) marcador.dataset.turno = String(estado.turno);
  const jugadores = [[1, 'marcador-p1', 'p1', 'puntos1'], [2, 'marcador-p2', 'p2', 'puntos2']];
  jugadores.forEach(([num, id, nombreKey, puntosKey]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const nombre = el.querySelector('.nombre');
    const puntos = el.querySelector('.puntos');
    if (nombre) nombre.textContent = estado[nombreKey];
    if (puntos) puntos.textContent = estado[puntosKey];
    el.classList.toggle('turno-activo', estado.turno === num);
  });
}

function pintarTiempo(restante) {
  const total = Math.max(1, Number(estado.config.tiempo) || 45);
  const tiempoEl = document.getElementById('anillo-tiempo');
  if (tiempoEl) tiempoEl.textContent = formatTiempo(restante);
  const arc = document.getElementById('anillo-arc');
  if (arc) {
    const frac = fraccionAnillo(total, restante);
    arc.style.strokeDasharray = `${(frac * CIRCUNFERENCIA_ANILLO).toFixed(2)} ${CIRCUNFERENCIA_ANILLO}`;
  }
}

function iniciarCronometro() {
  clearInterval(timerId);
  const total = Math.max(1, Number(estado.config.tiempo) || 45);
  let restante = total;
  const anillo = document.getElementById('anillo');
  if (anillo) anillo.classList.toggle('tension', esTension(restante));
  pintarTiempo(restante);
  timerId = setInterval(() => {
    restante -= 1;
    if (restante <= 0) {
      restante = 0;
      if (anillo) anillo.classList.add('tension');
      pintarTiempo(restante);
      clearInterval(timerId);
      timerId = null;
      sonidos.tocar('timeout');
      return;
    }
    if (anillo) anillo.classList.toggle('tension', esTension(restante));
    pintarTiempo(restante);
    if (esTension(restante)) sonidos.tocar('tic');
  }, 1000);
}

function reiniciarAnimacionCarta() {
  const carta = document.getElementById('carta');
  if (!carta) return;
  carta.style.animation = 'none';
  void carta.offsetWidth;
  carta.style.animation = '';
}

function animarSalida() {
  const carta = document.getElementById('carta');
  if (!carta) return;
  carta.style.animation = 'shake 0.2s ease, salirCarta 0.32s ease 0.2s forwards';
}

function flotarCorazon(ganador) {
  const carta = document.getElementById('carta');
  if (!carta) return;
  for (let i = 0; i < 3; i++) {
    const corazon = document.createElement('span');
    corazon.className = 'corazon';
    corazon.textContent = '♥';
    corazon.style.left = `${ganador === 1 ? 15 + Math.random() * 20 : 65 + Math.random() * 20}%`;
    corazon.style.top = `${30 + Math.random() * 35}%`;
    corazon.style.fontSize = `${1.1 + Math.random() * 1.1}rem`;
    corazon.style.animationDelay = `${i * 0.1}s`;
    carta.appendChild(corazon);
    setTimeout(() => corazon.remove(), 1200);
  }
}

function marcarPop(id) {
  const jugador = document.getElementById(id);
  if (!jugador) return;
  const el = jugador.querySelector('.puntos') || jugador;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function limpiarTransicion() {
  clearTimeout(transicionTimer);
  transicionTimer = null;
  resolviendo = false;
}

function repartirCarta() {
  const hayCarta = mazo.length > 0;
  const cat = document.getElementById('carta-categoria');
  const txt = document.getElementById('carta-texto');
  if (hayCarta) {
    const { carta, deck: nuevoDeck } = robarCarta(mazo, prevId);
    prevId = carta.id;
    mazo = nuevoDeck;
    if (cat) cat.textContent = carta.categoria;
    if (txt) txt.textContent = carta.texto;
  } else {
    if (cat) cat.textContent = '—';
    if (txt) txt.textContent = 'Cargando cartas…';
  }
  if (hayCarta) {
    reiniciarAnimacionCarta();
    iniciarCronometro();
  }
}

function iniciarPartida() {
  limpiarTransicion();
  enRondaExtra = false;
  estado.puntos1 = 0;
  estado.puntos2 = 0;
  estado.turno = 1;
  guardarEstado(estado);
  mazo = mezclarDeck(mergeCards(cartasBase, cartasUsuario), estado.config.categorias);
  prevId = null;
  renderMarcador();
  mostrarPantalla('partida');
  repartirCarta();
}

function resolverCarta(hecho) {
  if (resolviendo) return;
  resolviendo = true;
  clearInterval(timerId);
  timerId = null;
  if (hecho) {
    if (estado.turno === 1) estado.puntos1 += 1;
    else estado.puntos2 += 1;
    sonidos.tocar('punto');
    flotarCorazon(estado.turno);
    marcarPop(estado.turno === 1 ? 'marcador-p1' : 'marcador-p2');
  }
  if (enRondaExtra && hecho) {
    finalizarPartida();
    return;
  }
  sonidos.tocar('flip');
  animarSalida();
  estado.turno = estado.turno === 1 ? 2 : 1;
  renderMarcador();
  guardarEstado(estado);
  transicionTimer = setTimeout(() => {
    transicionTimer = null;
    resolviendo = false;
    repartirCarta();
  }, 520);
}

function finalizarPartida() {
  limpiarTransicion();
  clearInterval(timerId);
  timerId = null;
  estado.enPartida = false;
  guardarEstado(estado);
  if (typeof window.mostrarFin === 'function') window.mostrarFin();
}

function lanzarConfeti() {
  const n = 40 + Math.floor(Math.random() * 21);
  for (let i = 0; i < n; i++) {
    const p = document.createElement('span');
    p.className = 'confeti';
    p.style.left = `${Math.random() * 100}%`;
    p.style.backgroundColor = COLORES_CONFETI[Math.floor(Math.random() * COLORES_CONFETI.length)];
    p.style.animationDuration = `${1.6 + Math.random() * 1.8}s`;
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

function mostrarFin() {
  mostrarPantalla('fin');
  const spans = document.querySelectorAll('#fin-marcador span');
  if (spans[0]) spans[0].textContent = `${estado.p1} ${estado.puntos1}`;
  if (spans[1]) spans[1].textContent = `${estado.p2} ${estado.puntos2}`;
  const titulo = document.getElementById('fin-titulo');
  const btnRonda = document.getElementById('btn-ronda-extra');
  if (estado.puntos1 === estado.puntos2) {
    if (titulo) titulo.textContent = '⚡ ¡Empate!';
    if (btnRonda) btnRonda.classList.remove('oculto');
  } else {
    const ganador = estado.puntos1 > estado.puntos2 ? estado.p1 : estado.p2;
    if (titulo) titulo.textContent = `👑 ¡${ganador} gana!`;
    if (btnRonda) btnRonda.classList.add('oculto');
    lanzarConfeti();
    sonidos.tocar('fin');
  }
}

function rondaExtra() {
  estado.enPartida = true;
  const banner = document.getElementById('banner-extra');
  if (banner) banner.classList.remove('oculto');
  iniciarPartida();
  enRondaExtra = true;
}

function reiniciar() {
  enRondaExtra = false;
  const banner = document.getElementById('banner-extra');
  if (banner) banner.classList.add('oculto');
  estado.enPartida = true;
  iniciarPartida();
}

function volverConfig() {
  poblarAsistente();
  irAPaso(1);
  mostrarPantalla('asistente');
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

  const btnHecho = document.getElementById('btn-hecho');
  if (btnHecho) btnHecho.addEventListener('click', () => resolverCarta(true));

  const btnNoHecho = document.getElementById('btn-no-hecho');
  if (btnNoHecho) btnNoHecho.addEventListener('click', () => resolverCarta(false));

  const btnFinalizar = document.getElementById('btn-finalizar');
  if (btnFinalizar) btnFinalizar.addEventListener('click', finalizarPartida);

  const btnReiniciar = document.getElementById('btn-reiniciar');
  if (btnReiniciar) btnReiniciar.addEventListener('click', reiniciar);

  const btnVolverConfig = document.getElementById('btn-volver-config');
  if (btnVolverConfig) btnVolverConfig.addEventListener('click', volverConfig);

  const btnRondaExtra = document.getElementById('btn-ronda-extra');
  if (btnRondaExtra) btnRondaExtra.addEventListener('click', rondaExtra);
}

if (typeof window !== 'undefined') {
  window.mostrarPantalla = mostrarPantalla;
  window.iniciarPartida = iniciarPartida;
  window.resolverCarta = resolverCarta;
  window.finalizarPartida = finalizarPartida;
  window.mostrarFin = mostrarFin;
  window.rondaExtra = rondaExtra;
  window.reiniciar = reiniciar;
  window.volverConfig = volverConfig;
}

if (typeof document !== 'undefined') {
  init();
}
