import { formatTiempo, fraccionAnillo, esTension } from './timer.js';

export function normalizarCodigo(codigo) {
  const limpio = String(codigo || '').replace(/[\s-]/g, '');
  return /^\d{6}$/.test(limpio) ? limpio : null;
}

export function fusionarMensajes(local, remotos) {
  const mapa = new Map();
  for (const m of [...local, ...remotos]) {
    const prev = mapa.get(m.id);
    if (prev && prev.tipo === 'foto' && prev.contenido && !m.contenido) continue;
    mapa.set(m.id, m);
  }
  return [...mapa.values()].sort((a, b) => a.id - b.id);
}

export function formatearHora(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function estadoCambio(prev, next) {
  return !prev || prev.carta_texto !== next.carta_texto || prev.turno !== next.turno
    || prev.puntos1 !== next.puntos1 || prev.puntos2 !== next.puntos2;
}

if (typeof window !== 'undefined') {
  const TIEMPO_CARTA = 45;
  const CIRCUNFERENCIA_ANILLO = 100.53;
  const CATEGORIAS_DEFAULT = ['Preguntas', 'Retos', 'Picante', 'Romantico', 'Loco', 'Hot', 'Sexting'];

  let sesionId = null;
  let parejaId = null;
  let soyCreador = false;
  let estadoOnline = null;
  let ultimoMensajeId = 0;
  let pantallaActual = 'inicio';
  let pollingId = null;
  let cronometroId = null;
  let ultimaCartaOnline = null;
  let chatOrigen = 'online';
  let avisoTimer = null;
  let pollando = false;
  let mensajesNoLeidos = 0;

  function lsGet(k) {
    try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; }
  }

  function lsSet(k, v) {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch {}
  }

  function lsRemove(k) {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); } catch {}
  }

  function dispositivoId() {
    let id = lsGet('cp.dispositivo_id');
    if (id) return id;
    id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `cp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    lsSet('cp.dispositivo_id', id);
    return id;
  }

  function obtenerParejaId() {
    return lsGet('cp.pareja_id') || null;
  }

  function guardarParejaId(id) {
    if (id) lsSet('cp.pareja_id', String(id));
    else lsRemove('cp.pareja_id');
  }

  function guardarUltimaSesion(datos) {
    if (datos) {
      lsSet('cp.ultimaSesion', JSON.stringify({
        sesion_id: datos.sesion_id, codigo: datos.codigo, pareja_id: datos.pareja_id,
        soyCreador: Boolean(datos.soyCreador),
      }));
    } else {
      lsRemove('cp.ultimaSesion');
    }
  }

  function leerUltimaSesion() {
    try {
      const raw = lsGet('cp.ultimaSesion');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  function claveChatLocal() {
    return parejaId ? `cp.chat_local_${parejaId}` : 'cp.chat_local';
  }

  function leerChatLocal() {
    try {
      const raw = lsGet(claveChatLocal());
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function guardarChatLocal(arr) {
    lsSet(claveChatLocal(), JSON.stringify(arr || []));
  }

  function nombreLocal(pos) {
    try {
      const est = JSON.parse(lsGet('cp.estado') || '{}');
      const nombre = pos === 2 ? est?.p2 : est?.p1;
      if (nombre) return String(nombre);
    } catch {}
    return `Jugador ${pos}`;
  }

  function nombreOnline() {
    const input = document.getElementById('input-nombre-online');
    const escrito = input?.value?.trim();
    if (escrito) {
      lsSet('cp.onlineNombre', escrito);
      return escrito;
    }
    const guardado = lsGet('cp.onlineNombre');
    return guardado || nombreLocal(1);
  }

  function categoriasElegidas() {
    try {
      const est = JSON.parse(lsGet('cp.estado') || '{}');
      const cats = est?.config?.categorias;
      if (Array.isArray(cats) && cats.length > 0) return cats;
    } catch {}
    return CATEGORIAS_DEFAULT;
  }

  function maxIdLocal() {
    return leerChatLocal().reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
  }

  function irA(nombre) {
    if (typeof window.mostrarPantalla === 'function') window.mostrarPantalla(nombre);
    pantallaActual = nombre;
  }

  function setAviso(msg) {
    const el = document.getElementById('online-aviso');
    if (!el) return;
    el.textContent = msg || '';
    clearTimeout(avisoTimer);
    if (msg) avisoTimer = setTimeout(() => { el.textContent = ''; }, 4000);
  }

  function setBanner(texto, desconectado) {
    const b = document.getElementById('online-banner');
    if (!b) return;
    b.textContent = texto;
    b.classList.toggle('desconectado', Boolean(desconectado));
  }

  function btnOcupado(id, ocupado, textoOcupado) {
    const b = document.getElementById(id);
    if (!b) return;
    if (!b.dataset.originalTexto) b.dataset.originalTexto = b.textContent;
    if (ocupado) {
      b.textContent = textoOcupado;
      b.disabled = true;
    } else {
      b.textContent = b.dataset.originalTexto;
      b.disabled = false;
    }
  }

  function miTurno(estado) {
    return (estado?.turno === 1 && soyCreador) || (estado?.turno === 2 && !soyCreador);
  }

  function actualizarBotonesTurno() {
    const turno = estadoOnline ? miTurno(estadoOnline) : false;
    ['btn-online-hecho', 'btn-online-no-hecho'].forEach(id => {
      const b = document.getElementById(id);
      if (b) b.disabled = !turno;
    });
  }

  function iniciarCronometroOnline() {
    clearInterval(cronometroId);
    let restante = TIEMPO_CARTA;
    const anillo = document.getElementById('anillo-online');
    const tiempoEl = document.getElementById('anillo-online-tiempo');
    const arc = document.getElementById('anillo-online-arc');
    const pintar = () => {
      if (tiempoEl) tiempoEl.textContent = formatTiempo(restante);
      if (arc) {
        const frac = fraccionAnillo(TIEMPO_CARTA, restante);
        arc.style.strokeDasharray = `${(frac * CIRCUNFERENCIA_ANILLO).toFixed(2)} ${CIRCUNFERENCIA_ANILLO}`;
      }
      if (anillo) anillo.classList.toggle('tension', esTension(restante));
    };
    pintar();
    cronometroId = setInterval(() => {
      restante -= 1;
      if (restante <= 0) {
        restante = 0;
        clearInterval(cronometroId);
        cronometroId = null;
        pintar();
        return;
      }
      pintar();
    }, 1000);
  }

  function renderOnlineEstado(estado) {
    const marcador = document.getElementById('marcador-online');
    if (marcador) marcador.dataset.turno = String(estado.turno);
    const jugadores = [
      [1, 'online-marcador-p1', estado.jugadores?.[1] || 'Jugador 1'],
      [2, 'online-marcador-p2', estado.jugadores?.[2] || 'Jugador 2'],
    ];
    jugadores.forEach(([num, id, nombre]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const n = el.querySelector('.nombre');
      const p = el.querySelector('.puntos');
      if (n) n.textContent = nombre;
      if (p) p.textContent = String(num === 1 ? estado.puntos1 : estado.puntos2);
      el.classList.toggle('turno-activo', estado.turno === num);
    });
    const cat = document.getElementById('online-carta-categoria');
    const txt = document.getElementById('online-carta-texto');
    if (cat) cat.textContent = estado.carta_categoria || '—';
    if (txt) txt.textContent = estado.carta_texto || 'Esperando carta…';
    if (estado.carta_texto !== ultimaCartaOnline) {
      ultimaCartaOnline = estado.carta_texto;
      iniciarCronometroOnline();
    }
    actualizarBotonesTurno();
  }

  function jugadorItem(num, nombre, listo) {
    const d = document.createElement('div');
    d.className = 'jugador';
    const span = document.createElement('span');
    span.textContent = nombre;
    const marca = document.createElement('span');
    marca.className = 'marca';
    marca.textContent = listo ? '✔ Listo' : 'Esperando…';
    d.appendChild(span);
    d.appendChild(marca);
    return d;
  }

  function renderSala(estado) {
    const lista = document.getElementById('sala-jugadores');
    const estadoEl = document.getElementById('sala-estado');
    const j1 = estado.jugadores?.[1] || nombreLocal(1);
    const j2 = estado.jugadores?.[2] || null;
    if (lista) {
      lista.innerHTML = '';
      lista.appendChild(jugadorItem(1, j1, true));
      if (j2) {
        lista.appendChild(jugadorItem(2, j2, true));
      } else {
        const espera = document.createElement('div');
        espera.className = 'jugador espera';
        espera.textContent = 'Esperando al otro jugador…';
        lista.appendChild(espera);
      }
    }
    if (estadoEl) estadoEl.textContent = j2 ? '¡Los dos están conectados!' : 'Esperando al otro jugador…';
  }

  function decidirPantallaOnline(estado) {
    if (pantallaActual === 'chat') return;
    if (estado.jugadores?.[2]) {
      if (pantallaActual !== 'online-partida') {
        renderOnlineEstado(estado);
        irA('online-partida');
      }
    } else {
      renderSala(estado);
      if (pantallaActual !== 'sala') irA('sala');
    }
  }

  function mostrarSala(codigo) {
    const el = document.getElementById('sala-codigo');
    if (el) el.textContent = codigo;
    const lista = document.getElementById('sala-jugadores');
    if (lista) lista.innerHTML = '';
    const estadoEl = document.getElementById('sala-estado');
    if (estadoEl) estadoEl.textContent = 'Esperando al otro jugador…';
    irA('sala');
  }

  async function crearSala() {
    btnOcupado('btn-crear-sala', true, 'Creando…');
    setAviso('');
    try {
      const did = dispositivoId();
      let pid = obtenerParejaId();
      if (!pid) {
        const r = await fetch('/api/pareja', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispositivo_id: did }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'No se pudo crear la pareja');
        pid = d.pareja_id;
        guardarParejaId(pid);
      }
      const r = await fetch('/api/sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pareja_id: pid, dispositivo_id: did, nombre: nombreOnline(), categorias: categoriasElegidas(),
        }),
      });
      const d = await r.json();
      if (!r.ok && r.status === 404 && pid) {
        guardarParejaId(null);
        const rp = await fetch('/api/pareja', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispositivo_id: did }),
        });
        const dp = await rp.json();
        if (!rp.ok) throw new Error(dp.error || 'No se pudo crear la pareja');
        pid = dp.pareja_id;
        guardarParejaId(pid);
        const r2 = await fetch('/api/sesion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pareja_id: pid, dispositivo_id: did, nombre: nombreOnline(), categorias: categoriasElegidas(),
          }),
        });
        const d2 = await r2.json();
        if (!r2.ok) throw new Error(d2.error || 'No se pudo crear la sala');
        parejaId = pid;
        sesionId = d2.sesion_id;
        soyCreador = true;
        guardarUltimaSesion({ sesion_id: d2.sesion_id, codigo: d2.codigo, pareja_id: pid, soyCreador: true });
        ultimoMensajeId = maxIdLocal();
        estadoOnline = null;
        mostrarSala(d2.codigo);
        iniciarPolling(d2.sesion_id);
        return;
      }
      if (!r.ok) throw new Error(d.error || 'No se pudo crear la sala');
      parejaId = pid;
      sesionId = d.sesion_id;
      soyCreador = true;
      guardarUltimaSesion({ sesion_id: d.sesion_id, codigo: d.codigo, pareja_id: pid, soyCreador: true });
      ultimoMensajeId = maxIdLocal();
      estadoOnline = null;
      mostrarSala(d.codigo);
      iniciarPolling(d.sesion_id);
    } catch (e) {
      setAviso(e.message || 'No se pudo conectar');
    } finally {
      btnOcupado('btn-crear-sala', false);
    }
  }

  async function unirseSala() {
    const input = document.getElementById('input-codigo');
    const codigo = normalizarCodigo(input?.value);
    if (!codigo) {
      if (input) {
        input.classList.remove('input-error');
        void input.offsetWidth;
        input.classList.add('input-error');
      }
      setAviso('El código debe tener 6 dígitos');
      return;
    }
    btnOcupado('btn-unirse-sala', true, 'Uniéndome…');
    setAviso('');
    try {
      const r = await fetch('/api/sesion-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codigo, dispositivo_id: dispositivoId(), nombre: nombreOnline() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo unir');
      parejaId = d.pareja_id;
      guardarParejaId(parejaId);
      sesionId = d.sesion_id;
      soyCreador = false;
      guardarUltimaSesion({ sesion_id: d.sesion_id, codigo, pareja_id: d.pareja_id, soyCreador: false });
      estadoOnline = d;
      ultimoMensajeId = maxIdLocal();
      if (input) {
        input.value = '';
        input.classList.remove('input-error');
      }
      iniciarPolling(d.sesion_id);
      decidirPantallaOnline(d);
    } catch (e) {
      setAviso(e.message || 'No se pudo conectar');
      if (input) {
        input.classList.remove('input-error');
        void input.offsetWidth;
        input.classList.add('input-error');
      }
    } finally {
      btnOcupado('btn-unirse-sala', false);
    }
  }

  async function reanudarSala() {
    const ultima = leerUltimaSesion();
    if (!ultima?.sesion_id) {
      setAviso('No hay una sesión para reanudar');
      return;
    }
    const pid = ultima.pareja_id || obtenerParejaId();
    if (pid) guardarParejaId(pid);
    parejaId = pid;
    sesionId = ultima.sesion_id;
    soyCreador = ultima.soyCreador === true;
    estadoOnline = null;
    ultimoMensajeId = maxIdLocal();
    iniciarPolling(sesionId);
  }

  function onVisibilidad() {
    if (!document.hidden) pollTick();
  }

  function iniciarPolling(id) {
    detenerPolling();
    sesionId = id;
    pollingId = setInterval(pollTick, 1500);
    document.addEventListener('visibilitychange', onVisibilidad);
    pollTick();
  }

  function detenerPolling() {
    if (pollingId) {
      clearInterval(pollingId);
      pollingId = null;
    }
    if (cronometroId) {
      clearInterval(cronometroId);
      cronometroId = null;
    }
    document.removeEventListener('visibilitychange', onVisibilidad);
  }

  async function pollTick() {
    if (pollando) return;
    if (document.hidden || !sesionId) return;
    pollando = true;
    try {
      const r = await fetch(`/api/sesion-estado?sesion_id=${sesionId}`).catch(() => null);
      if (!r) {
        setBanner('Desconectado…', true);
        return;
      }
      try {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Estado no disponible');
        const previo = estadoOnline;
        estadoOnline = d;
        setBanner('Conectado', false);
        decidirPantallaOnline(d);
        if (estadoCambio(previo, d)) renderOnlineEstado(d);
      } catch {
        setBanner('Desconectado…', true);
      }
      if (parejaId) refrescarMensajes();
    } finally {
      pollando = false;
    }
  }

  async function refrescarMensajes() {
    if (!parejaId) return;
    const r = await fetch(`/api/mensajes?pareja_id=${parejaId}&after=${ultimoMensajeId}&dispositivo_id=${dispositivoId()}`).catch(() => null);
    if (!r || !r.ok) return;
    const d = await r.json().catch(() => null);
    if (!d?.mensajes || d.mensajes.length === 0) return;
    const did = dispositivoId();
    const nuevos = d.mensajes.filter(m => Number(m.id) > ultimoMensajeId);
    for (const m of nuevos) {
      if (m.autor_id !== did) notificarMensaje(estadoOnline?.jugadores?.[2] || 'Tu pareja', m.contenido);
    }
    const fusion = fusionarMensajes(leerChatLocal(), d.mensajes);
    guardarChatLocal(fusion);
    ultimoMensajeId = fusion.reduce((m, x) => Math.max(m, Number(x.id) || 0), ultimoMensajeId);
    if (pantallaActual === 'chat') renderChat();
  }

  async function resolverOnline(hecho) {
    if (!miTurno(estadoOnline)) return;
    const ids = ['btn-online-hecho', 'btn-online-no-hecho'];
    ids.forEach(id => btnOcupado(id, true, 'Enviando…'));
    try {
      const r = await fetch('/api/sesion-turno', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesion_id: sesionId, dispositivo_id: dispositivoId(), hecho }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudo resolver');
      estadoOnline = d;
      renderOnlineEstado(d);
      setBanner('Conectado', false);
    } catch (e) {
      setBanner(e.message === 'No es tu turno' ? 'No es tu turno' : 'Error al enviar', true);
    } finally {
      ids.forEach(id => btnOcupado(id, false));
      actualizarBotonesTurno();
    }
  }

  function renderChat() {
    const cont = document.getElementById('chat-mensajes');
    if (!cont) return;
    const mensajes = leerChatLocal();
    cont.innerHTML = '';
    if (mensajes.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'chat-vacio';
      vacio.textContent = 'No hay mensajes todavía. ¡Escribí el primero!';
      cont.appendChild(vacio);
      return;
    }
    const did = dispositivoId();
    mensajes.forEach(m => {
      const burbuja = document.createElement('div');
      burbuja.className = `chat-burbuja ${m.autor_id === did ? 'propia' : 'ajena'}`;
      if (m.tipo === 'foto') {
        if (m.contenido && m.contenido.startsWith('data:image/')) {
          const img = document.createElement('img');
          img.src = m.contenido;
          img.alt = 'Foto';
          img.loading = 'lazy';
          burbuja.appendChild(img);
        } else {
          const span = document.createElement('span');
          span.className = 'foto-placeholder';
          span.textContent = '📷 Foto';
          burbuja.appendChild(span);
        }
      } else {
        const span = document.createElement('span');
        span.textContent = m.contenido;
        burbuja.appendChild(span);
      }
      const hora = document.createElement('span');
      hora.className = 'hora';
      hora.textContent = formatearHora(m.creada_at);
      burbuja.appendChild(hora);
      cont.appendChild(burbuja);
    });
    cont.scrollTop = cont.scrollHeight;
  }

  function cargarChat() {
    renderChat();
  }

  function abrirChat() {
    if (!parejaId) {
      setAviso('Primero creá o unite a una sala');
      return;
    }
    chatOrigen = pantallaActual === 'mischats' ? 'mischats' : (pantallaActual === 'sala' ? 'sala' : 'online-partida');
    mensajesNoLeidos = 0;
    actualizarBadgeChat();
    cargarChat();
    irA('chat');
    refrescarMensajes();
  }

  function comprimirImagen(file) {
    return new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
      lector.onload = () => {
        const original = lector.result;
        const img = new Image();
        img.onerror = () => resolve(original);
        img.onload = () => {
          const MAX = 1024;
          const escala = Math.min(1, MAX / Math.max(img.width, img.height));
          if (escala >= 1 && file.size < 900 * 1024) {
            resolve(original);
            return;
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * escala));
          canvas.height = Math.max(1, Math.round(img.height * escala));
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.src = original;
      };
      lector.readAsDataURL(file);
    });
  }

  async function enviarMensaje(tipo, contenido) {
    const r = await fetch('/api/mensajes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pareja_id: parejaId, autor_id: dispositivoId(), tipo, contenido }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'No se pudo enviar');
    const local = leerChatLocal();
    local.push({ id: d.id, autor_id: dispositivoId(), tipo, contenido, creada_at: new Date().toISOString() });
    guardarChatLocal(local);
    renderChat();
  }

  async function enviarTexto() {
    const input = document.getElementById('input-chat-texto');
    const texto = (input?.value || '').trim();
    if (!texto || !parejaId) return;
    try {
      await enviarMensaje('texto', texto);
      if (input) input.value = '';
    } catch (e) {
      window.alert(e.message);
    }
  }

  async function enviarFoto(file) {
    if (!file || !parejaId) return;
    if (!/^image\//.test(file.type)) {
      window.alert('Elegí una imagen');
      return;
    }
    try {
      const dataUrl = await comprimirImagen(file);
      await enviarMensaje('foto', dataUrl);
    } catch (e) {
      window.alert(e.message);
    }
  }

  function renderListaChats(chats) {
    const cont = document.getElementById('lista-chats');
    if (!cont) return;
    cont.innerHTML = '';
    if (chats.length === 0) {
      const vacio = document.createElement('p');
      vacio.className = 'chat-vacio';
      vacio.textContent = 'No tenés conversaciones todavía.';
      cont.appendChild(vacio);
      return;
    }
    chats.forEach(ch => {
      const item = document.createElement('div');
      item.className = 'chat-item';
      item.addEventListener('click', () => abrirChatPareja(ch.pareja_id));
      const info = document.createElement('div');
      info.className = 'info';
      const titulo = document.createElement('span');
      titulo.className = 'chat-item-titulo';
      titulo.textContent = `Pareja ${ch.pareja_id}`;
      const ultimo = document.createElement('span');
      ultimo.className = 'ultimo';
      ultimo.textContent = ch.ultimo_mensaje ? `${formatearHora(ch.actualizado_at)} · ${ch.ultimo_mensaje}` : 'Sin mensajes';
      info.appendChild(titulo);
      info.appendChild(ultimo);
      const borrar = document.createElement('button');
      borrar.type = 'button';
      borrar.className = 'boton-icono';
      borrar.textContent = '🗑';
      borrar.setAttribute('aria-label', `Borrar chat ${ch.pareja_id}`);
      borrar.addEventListener('click', (ev) => {
        ev.stopPropagation();
        borrarChat(ch.pareja_id);
      });
      item.appendChild(info);
      item.appendChild(borrar);
      cont.appendChild(item);
    });
  }

  async function mostrarMischats() {
    irA('mischats');
    const cont = document.getElementById('lista-chats');
    if (cont) {
      cont.innerHTML = '';
      const cargando = document.createElement('p');
      cargando.className = 'chat-vacio';
      cargando.textContent = 'Cargando chats…';
      cont.appendChild(cargando);
    }
    try {
      const r = await fetch(`/api/chats?dispositivo_id=${dispositivoId()}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'No se pudieron cargar los chats');
      renderListaChats(d.chats || []);
    } catch (e) {
      if (cont) {
        cont.innerHTML = '';
        const err = document.createElement('p');
        err.className = 'chat-vacio';
        err.textContent = e.message;
        cont.appendChild(err);
      }
    }
  }

  function abrirChatPareja(pid) {
    parejaId = pid;
    guardarParejaId(pid);
    sesionId = null;
    chatOrigen = 'mischats';
    ultimoMensajeId = maxIdLocal();
    cargarChat();
    irA('chat');
    refrescarMensajes();
  }

  async function borrarChat(pid) {
    if (!window.confirm('¿Borrar esta conversación y todos sus mensajes?')) return;
    try {
      const r = await fetch(`/api/chats?pareja_id=${pid}&dispositivo_id=${dispositivoId()}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'No se pudo borrar');
      }
      if (pid === parejaId) {
        guardarChatLocal([]);
        ultimoMensajeId = 0;
        parejaId = null;
        guardarParejaId(null);
        guardarUltimaSesion(null);
      }
      mostrarMischats();
    } catch (e) {
      window.alert(e.message);
    }
  }

  function actualizarBadgeChat() {
    const total = mensajesNoLeidos;
    ['badge-online-chat', 'badge-chat-sala'].forEach((id) => {
      const b = document.getElementById(id);
      if (!b) return;
      b.textContent = total > 99 ? '99+' : String(total);
      b.classList.toggle('oculto', total === 0);
    });
  }

  function pulsarBotonChat() {
    const btn = document.getElementById('btn-online-chat');
    if (!btn) return;
    btn.classList.remove('pulso-chat');
    void btn.offsetWidth;
    btn.classList.add('pulso-chat');
  }

  let toastTimer = null;
  function mostrarToast(autor, texto) {
    const t = document.getElementById('toast-chat');
    if (!t) return;
    const cuerpo = texto && texto.startsWith('data:image/') ? '📷 Te envió una foto' : (texto || 'Nuevo mensaje');
    t.textContent = `${autor} · ${cuerpo}`;
    t.classList.remove('oculto');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('oculto'), 3500);
  }

  function notificarMensaje(autor, texto) {
    window.sonidos?.tocar('mensaje');
    mensajesNoLeidos += 1;
    actualizarBadgeChat();
    pulsarBotonChat();
    if (pantallaActual !== 'chat') mostrarToast(autor, texto);
  }

  function onlineIniciar() {
    dispositivoId();
    const input = document.getElementById('input-nombre-online');
    if (input) input.value = lsGet('cp.onlineNombre') || nombreLocal(1);
    refrescarHub();
  }

  function refrescarHub() {
    const btnReanudar = document.getElementById('btn-reanudar-sala');
    if (btnReanudar) btnReanudar.classList.toggle('oculto', !leerUltimaSesion());
  }

  window.Online = {
    iniciar: onlineIniciar,
    crearSala,
    unirseSala,
    reanudarSala,
    abrirChat,
    mostrarMischats,
    borrarChat,
  };

  function escuchar(id, fn) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  escuchar('btn-crear-sala', crearSala);
  escuchar('btn-unirse-sala', unirseSala);
  const inputNombre = document.getElementById('input-nombre-online');
  if (inputNombre) inputNombre.addEventListener('input', () => {
    const v = inputNombre.value.trim();
    if (v) lsSet('cp.onlineNombre', v);
  });
  const inputCodigo = document.getElementById('input-codigo');
  if (inputCodigo) inputCodigo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') unirseSala();
  });
  escuchar('btn-reanudar-sala', reanudarSala);
  escuchar('btn-mis-chats', mostrarMischats);
  escuchar('btn-volver-online', () => {
    detenerPolling();
    irA('inicio');
  });

  escuchar('btn-chat-sala', abrirChat);
  escuchar('btn-salir-sala', () => {
    detenerPolling();
    refrescarHub();
    irA('online');
  });

  escuchar('btn-online-hecho', () => resolverOnline(true));
  escuchar('btn-online-no-hecho', () => resolverOnline(false));
  escuchar('btn-online-chat', abrirChat);
  escuchar('btn-online-salir', () => {
    detenerPolling();
    refrescarHub();
    irA('online');
  });

  escuchar('btn-chat-atras', () => {
    const destino = chatOrigen === 'online-partida' ? 'online-partida' : chatOrigen === 'sala' ? 'sala' : 'mischats';
    irA(destino);
  });
  escuchar('btn-chat-enviar', enviarTexto);
  const inputChat = document.getElementById('input-chat-texto');
  if (inputChat) inputChat.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enviarTexto();
  });
  const inputCamara = document.getElementById('input-chat-camara');
  if (inputCamara) inputCamara.addEventListener('change', () => {
    const f = inputCamara.files?.[0];
    if (f) enviarFoto(f);
    inputCamara.value = '';
  });
  const inputGaleria = document.getElementById('input-chat-galeria');
  if (inputGaleria) inputGaleria.addEventListener('change', () => {
    const f = inputGaleria.files?.[0];
    if (f) enviarFoto(f);
    inputGaleria.value = '';
  });

  escuchar('btn-volver-online-chats', () => {
    refrescarHub();
    irA('online');
  });
}