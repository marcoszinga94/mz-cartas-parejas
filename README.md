# Cartas Parejas

> Juego de cartas para parejas con preguntas, retos y categorías, para jugar en un solo teléfono o entre dos dispositivos.

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![Neon](https://img.shields.io/badge/Neon-00E599?logo=postgresql&logoColor=black)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)

## Características

**Modo local (offline)**

- **Mazo base:** 420 cartas repartidas en 7 categorías (Preguntas, Retos, Picante, Romantico, Loco, Hot y Sexting).
- **Configuración:** nombres de los jugadores, categorías, tiempo por carta (15, 30, 45 o 60 segundos) y rondas (0 = infinitas).
- **Partida por turnos:** dos jugadores se alternan en el mismo dispositivo; cada carta se marca como hecha o no hecha y suma un punto.
- **Cierre:** pantalla final con marcador y confeti; si hay empate se habilita una ronda extra en la que gana quien completa la carta y el otro no.
- **Mis cartas:** alta y baja de cartas propias, además de exportación e importación en JSON; se suman al mazo local.
- **Persistencia:** partida en curso, cartas propias y preferencia de sonido en `localStorage`.
- **Audio:** efectos generados con WebAudio y opción de silenciar.
- **PWA:** service worker que cachea HTML, CSS, JS, datos e iconos para jugar sin conexión después de la primera carga.

**Modo online**

- **Salas con código:** se crea una sala de 6 dígitos o se ingresa el código para unirse; la partida arranca cuando están los dos jugadores.
- **Sincronización:** el estado (turno, carta, puntaje y categorías) se consulta cada 1,5 segundos y el servidor valida de quién es el turno.
- **Chat:** mensajes de texto y fotos comprimidas en el cliente antes de enviarse.
- **Fotos efímeras:** se eliminan del servidor al entregarse y quedan guardadas solo en el teléfono.
- **Historial:** los chats se listan por pareja y se pueden borrar por completo, incluidos los mensajes del servidor.
- **Reanudar:** la última sesión se guarda en el dispositivo para volver a la sala.

## Stack

| Capa | Tecnología |
| --- | --- |
| Frontend | HTML, CSS y JavaScript vanilla con módulos ES |
| API | Vercel Functions en `api/` |
| Base de datos | Neon (Postgres serverless) |
| PWA | `manifest.webmanifest` y service worker |
| Tests | Runner nativo de Node (`node --test`) |

## Estructura del proyecto

```text
index.html              pantallas del juego
css/styles.css          estilos
js/
  app.js                flujo del modo local
  online.js             salas, chat y sincronización
  cards.js              mazo, mezcla y fusión de cartas
  timer.js              cronómetro
  sound.js              efectos de audio
api/                    endpoints de pareja, sesión, turnos y mensajes
  _schema.sql           esquema de la base
data/                   cartas base y cartas de usuario
scripts/migrate.mjs     aplica el esquema en Neon
tests/                  pruebas de lógica y API
sw.js                   caché offline
```

## Puesta en marcha

### Requisitos

- Un navegador moderno para el modo local.
- Node.js para ejecutar los tests y las migraciones.
- Una base Neon solo para el modo online.

### Instalación

El modo local no necesita instalación: alcanza con servir la carpeta con un servidor
estático, por ejemplo `python3 -m http.server 8000`, y abrir `index.html`.

Para tests y modo online:

```bash
npm install
npm test
DATABASE_URL="postgresql://..." node scripts/migrate.mjs
```

El modo online toma la cadena de conexión de `DATABASE_URL`; sin esa variable, el juego
local sigue funcionando pero las salas no pueden conectarse.

## Scripts

| Comando | Descripción |
| --- | --- |
| `npm test` | Ejecuta los tests con el runner nativo de Node |

## Despliegue

Se publica en Vercel: los archivos estáticos se sirven directamente y la carpeta `api/`
se expone como Vercel Functions. Hay que definir `DATABASE_URL` en el proyecto y aplicar
el esquema con `scripts/migrate.mjs` antes de usar el modo online.

## Estado del proyecto

Juego completo y usable. El modo local funciona sin backend; el modo online está
implementado sobre Neon y requiere configurar la base y las funciones.

## Licencia

Sin licencia definida.

## Autor

Marcos Zingaretti — https://github.com/marcoszinga94
