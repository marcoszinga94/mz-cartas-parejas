import { mergeCards, mezclarDeck, robarCarta } from './cards.js';
import { Sonidos } from './sound.js';
import { formatTiempo, fraccionAnillo, esTension } from './timer.js';
import './online.js';

export function estadoInicial() {
  return {
    p1: 'Jugador 1', p2: 'Jugador 2',
    puntos1: 0, puntos2: 0,
    turno: 1,
    config: { categorias: [], tiempo: 45, rondas: 0 },
    enPartida: false,
    misCartas: [],
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

const CATEGORIAS = ['Preguntas', 'Retos', 'Picante', 'Romantico', 'Loco', 'Hot', 'Sexting'];
let editandoId = null;

let swipeInicioX = 0;
let swipeInicioY = 0;
let swipeActivo = false;

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
  if (estado.enPartida && mazo.length === 0 && cartasBase.length > 0) {
    mazo = construirMazo();
    if (mazo.length > 0) {
      prevId = null;
      repartirCarta();
    }
  }
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
  if (btnAtras) btnAtras.textContent = n === 1 ? 'Volver' : 'Atrás';
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
  if (pasoActual === 1) {
    mostrarPantalla('inicio');
    return;
  }
  irAPaso(pasoActual - 1);
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

function animarSalida(dir = 1) {
  const carta = document.getElementById('carta');
  if (!carta) return;
  const keyframe = dir >= 0 ? 'salirCarta' : 'salirCartaIzq';
  carta.style.animation = `shake 0.2s ease, ${keyframe} 0.32s ease 0.2s forwards`;
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

function construirMazo() {
  const todas = mergeCards(cartasBase, [...cartasUsuario, ...(estado.misCartas || [])]);
  let mazo = mezclarDeck(todas, estado.config.categorias);
  if (mazo.length === 0 && cartasBase.length > 0) {
    mazo = mezclarDeck(todas, estado.config.categorias);
  }
  return mazo;
}

function iniciarPartida(resetScores = true) {
  limpiarTransicion();
  enRondaExtra = false;
  const banner = document.getElementById('banner-extra');
  if (banner) banner.classList.add('oculto');
  if (resetScores) {
    estado.puntos1 = 0;
    estado.puntos2 = 0;
    estado.turno = 1;
  }
  guardarEstado(estado);
  mazo = construirMazo();
  prevId = null;
  renderMarcador();
  mostrarPantalla('partida');
  repartirCarta();
}

function resolverCarta(hecho, dir = hecho ? 1 : -1, desdeSwipe = false) {
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
  if (enRondaExtra && !hecho) {
    finalizarPartida();
    return;
  }
  sonidos.tocar('flip');
  if (!desdeSwipe) animarSalida(dir);
  estado.turno = estado.turno === 1 ? 2 : 1;
  renderMarcador();
  guardarEstado(estado);
  transicionTimer = setTimeout(() => {
    transicionTimer = null;
    resolviendo = false;
    if (desdeSwipe) {
      const carta = document.getElementById('carta');
      if (carta) {
        carta.style.transition = '';
        carta.style.transform = '';
        carta.style.opacity = '';
      }
    }
    repartirCarta();
  }, desdeSwipe ? 260 : 520);
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
  iniciarPartida();
  enRondaExtra = true;
  const banner = document.getElementById('banner-extra');
  if (banner) banner.classList.remove('oculto');
}

function reiniciar() {
  enRondaExtra = false;
  estado.enPartida = true;
  iniciarPartida();
}

function volverConfig() {
  poblarAsistente();
  irAPaso(1);
  mostrarPantalla('asistente');
}

function abrirMiscartas() {
  renderMiscartas();
  mostrarPantalla('miscartas');
}

function renderMiscartas() {
  const lista = document.getElementById('lista-cartas');
  if (!lista) return;
  const cartas = estado.misCartas || [];
  lista.innerHTML = '';
  if (cartas.length === 0) {
    const vacia = document.createElement('li');
    vacia.className = 'lista-vacia';
    vacia.textContent = 'Todavía no tenés cartas. ¡Creá la primera!';
    lista.appendChild(vacia);
    return;
  }
  cartas.forEach(carta => {
    const li = document.createElement('li');
    const cat = document.createElement('span');
    cat.className = 'carta-item-cat';
    cat.textContent = carta.categoria;
    const txt = document.createElement('span');
    txt.className = 'carta-item-texto';
    txt.textContent = carta.texto;
    const acciones = document.createElement('span');
    acciones.className = 'carta-item-acciones';
    const btnEditar = document.createElement('button');
    btnEditar.type = 'button';
    btnEditar.className = 'boton-icono';
    btnEditar.textContent = '✏️';
    btnEditar.setAttribute('aria-label', `Editar carta: ${carta.texto}`);
    btnEditar.addEventListener('click', () => editarCarta(carta.id));
    const btnBorrar = document.createElement('button');
    btnBorrar.type = 'button';
    btnBorrar.className = 'boton-icono';
    btnBorrar.textContent = '🗑';
    btnBorrar.setAttribute('aria-label', `Borrar carta: ${carta.texto}`);
    btnBorrar.addEventListener('click', () => borrarCarta(carta.id));
    acciones.appendChild(btnEditar);
    acciones.appendChild(btnBorrar);
    li.appendChild(cat);
    li.appendChild(txt);
    li.appendChild(acciones);
    lista.appendChild(li);
  });
}

function limpiarFormularioCarta() {
  const categoria = document.getElementById('input-categoria');
  const texto = document.getElementById('input-texto');
  const boton = document.getElementById('btn-guardar-carta');
  if (categoria) categoria.value = CATEGORIAS[0];
  if (texto) texto.value = '';
  if (boton) boton.textContent = 'Guardar carta';
  editandoId = null;
}

function siguienteIdCarta() {
  return (estado.misCartas || []).reduce((m, c) => Math.max(m, Number(c.id) || 0), 0) + 1;
}

function guardarCarta() {
  const textoEl = document.getElementById('input-texto');
  const categoriaEl = document.getElementById('input-categoria');
  const texto = (textoEl?.value || '').trim();
  if (!texto) {
    if (textoEl) {
      textoEl.classList.remove('input-error');
      void textoEl.offsetWidth;
      textoEl.classList.add('input-error');
      textoEl.focus();
    }
    return;
  }
  const categoria = categoriaEl?.value || CATEGORIAS[0];
  if (editandoId !== null) {
    const carta = (estado.misCartas || []).find(c => c.id === editandoId);
    if (carta) {
      carta.categoria = categoria;
      carta.texto = texto;
    }
  } else {
    estado.misCartas.push({ id: siguienteIdCarta(), categoria, texto });
  }
  guardarEstado(estado);
  limpiarFormularioCarta();
  renderMiscartas();
}

function editarCarta(id) {
  const carta = (estado.misCartas || []).find(c => c.id === id);
  if (!carta) return;
  const categoriaEl = document.getElementById('input-categoria');
  const textoEl = document.getElementById('input-texto');
  const boton = document.getElementById('btn-guardar-carta');
  if (categoriaEl) categoriaEl.value = carta.categoria;
  if (textoEl) textoEl.value = carta.texto;
  if (boton) boton.textContent = 'Guardar cambios';
  editandoId = id;
  if (textoEl) textoEl.focus();
}

function borrarCarta(id) {
  const carta = (estado.misCartas || []).find(c => c.id === id);
  if (!carta) return;
  if (!window.confirm(`¿Borrar esta carta?\n\n${carta.texto}`)) return;
  estado.misCartas = estado.misCartas.filter(c => c.id !== id);
  if (editandoId === id) limpiarFormularioCarta();
  guardarEstado(estado);
  renderMiscartas();
}

export function validarImportacion(datos) {
  return !!datos && Array.isArray(datos.categorias) && Array.isArray(datos.cartas);
}

export function renumerarCartas(cartas, baseId = 1) {
  return (cartas || []).map((c, i) => ({ ...c, id: (Number(baseId) || 0) + i }));
}

function exportarJSON() {
  const datos = { categorias: CATEGORIAS, cartas: estado.misCartas || [] };
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cartas-usuario.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function importarJSON(input) {
  const archivo = input?.files?.[0];
  if (!archivo) return;
  const lector = new FileReader();
  lector.onload = () => {
    try {
      const datos = JSON.parse(lector.result);
      if (!validarImportacion(datos)) {
        window.alert('El archivo no tiene el formato válido de cartas');
        return;
      }
      const nuevas = renumerarCartas(datos.cartas, siguienteIdCarta());
      estado.misCartas.push(...nuevas);
      guardarEstado(estado);
      renderMiscartas();
      window.alert(`Se importaron ${nuevas.length} cartas`);
    } catch {
      window.alert('El archivo no tiene el formato válido de cartas');
    }
  };
  lector.onerror = () => window.alert('No se pudo leer el archivo');
  lector.readAsText(archivo);
  input.value = '';
}

function iniciarSwipe(x, y) {
  if (resolviendo) return;
  swipeActivo = true;
  swipeInicioX = x;
  swipeInicioY = y;
  const carta = document.getElementById('carta');
  if (carta) {
    carta.style.animation = 'none';
    carta.style.transition = 'transform 0s, opacity 0s';
  }
}

function moverSwipe(x, y) {
  if (!swipeActivo) return;
  const carta = document.getElementById('carta');
  if (!carta) return;
  const dx = x - swipeInicioX;
  const dy = y - swipeInicioY;
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
  if (Math.abs(dy) > Math.abs(dx)) return;
  const rot = Math.max(-14, Math.min(14, dx * 0.04));
  carta.style.transform = `translateX(${dx}px) rotate(${rot}deg)`;
  carta.style.opacity = String(Math.max(0.35, 1 - Math.abs(dx) / 600));
}

function terminarSwipe(x, y) {
  if (!swipeActivo) return;
  swipeActivo = false;
  const carta = document.getElementById('carta');
  if (!carta) return;
  const dx = x - swipeInicioX;
  const umbral = Math.min(80, carta.offsetWidth * 0.3);
  if (Math.abs(dx) > umbral) {
    const hecho = dx > 0;
    const dir = hecho ? 1 : -1;
    carta.style.transition = 'transform 0.22s ease-out, opacity 0.22s ease-out';
    carta.style.transform = `translateX(${dir * (carta.offsetWidth + 60)}px) rotate(${dir * 16}deg)`;
    carta.style.opacity = '0';
    resolverCarta(hecho, dir, true);
  } else {
    carta.style.transition = 'transform 0.2s ease-out';
    carta.style.transform = '';
    setTimeout(() => {
      if (carta) {
        carta.style.transition = '';
        carta.style.opacity = '';
        reiniciarAnimacionCarta();
      }
    }, 220);
  }
}

function init() {
  cargarCartas();
  if (estado.enPartida && (estado.config?.categorias?.length ?? 0) > 0) {
    iniciarPartida(false);
  } else {
    mostrarPantalla('inicio');
  }

  document.addEventListener('pointerdown', desbloquearAudio);
  document.addEventListener('touchstart', desbloquearAudio);

  const btnJugar = document.getElementById('btn-jugar');
  if (btnJugar) btnJugar.addEventListener('click', () => {
    poblarAsistente();
    irAPaso(1);
    mostrarPantalla('asistente');
  });

  const btnMisCartas = document.getElementById('btn-mis-cartas');
  if (btnMisCartas) btnMisCartas.addEventListener('click', abrirMiscartas);

  const btnModoOnline = document.getElementById('btn-modo-online');
  if (btnModoOnline) btnModoOnline.addEventListener('click', () => {
    window.Online?.iniciar();
    mostrarPantalla('online');
  });

  const formCarta = document.getElementById('form-carta');
  if (formCarta) formCarta.addEventListener('submit', e => {
    e.preventDefault();
    guardarCarta();
  });

  const btnExportar = document.getElementById('btn-exportar');
  if (btnExportar) btnExportar.addEventListener('click', exportarJSON);

  const btnImportar = document.getElementById('btn-importar');
  const inputImportar = document.getElementById('input-importar');
  if (btnImportar && inputImportar) {
    btnImportar.addEventListener('click', () => inputImportar.click());
    inputImportar.addEventListener('change', () => importarJSON(inputImportar));
  }

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

  const cartaSwipe = document.getElementById('carta');
  if (cartaSwipe) {
    cartaSwipe.addEventListener('pointerdown', e => iniciarSwipe(e.clientX, e.clientY));
    cartaSwipe.addEventListener('pointermove', e => moverSwipe(e.clientX, e.clientY));
    cartaSwipe.addEventListener('pointerup', e => terminarSwipe(e.clientX, e.clientY));
    cartaSwipe.addEventListener('pointercancel', () => { swipeActivo = false; });
  }

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
  window.abrirMiscartas = abrirMiscartas;
  window.guardarCarta = guardarCarta;
  window.editarCarta = editarCarta;
  window.borrarCarta = borrarCarta;
  window.exportarJSON = exportarJSON;
  window.importarJSON = importarJSON;
}

if (typeof document !== 'undefined') {
  init();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
