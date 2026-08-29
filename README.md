# Cartas Parejas

**Cartas Parejas** es un juego de mesa para dos personas: la noche de pareja. Aparecen cartas con preguntas, retos y momentos para jugar en pareja, con categorías, cronómetro y puntaje.

Es una página web estática: son archivos simples (HTML, CSS y JavaScript). No necesita instalar nada para usarla, y funciona sin conexión a internet después de la primera carga.

---

## Cómo subirla a internet

La aplicación es una carpeta con archivos comunes. No hay que compilar ni instalar nada: se sube tal cual.

1. Comprimir la carpeta del proyecto en un `.zip`.
2. Entrar a un servicio de hosting estático (por ejemplo **Netlify Drop**, **Vercel**, **GitHub Pages** o el que prefieras).
3. Arrastrar la carpeta (o el `.zip`) a la página y soltar.
4. Listo: el servicio te da una dirección web (por ejemplo `https://tuapp.netlify.app`).

No hace falta servidor ni base de datos para jugar en el mismo teléfono: las cartas y las partidas se guardan en el propio navegador. El **modo online** (jugar entre dos dispositivos con chat) sí necesita internet y una API + base de datos (ver la sección "Modo online" más abajo).

---

## Modo online

El modo online permite jugar entre dos teléfonos (en casa o a distancia) con un **código de 6 dígitos**, con chat y partida sincronizados en vivo.

### Crear o unirse a una partida

1. En la pantalla de inicio tocá **Modo online**.
2. **Crear código**: tocá el botón y aparece la sala de espera con un código de 6 dígitos. Compartilo con tu pareja.
3. **Unirme**: la otra persona entra al modo online, escribe el código y toca **Unirme**.
4. Cuando los dos están conectados, la partida **arranca sola** en ambos teléfonos: las cartas, el turno y el puntaje aparecen iguales en los dos. El jugador que está fuera de turno ve los botones deshabilitados.

Si salís de la sala, podés reanudarla con el botón **Reanudar última sesión** (aparece cuando hay una sesión guardada).

### El chat y las fotos

- En la sala o durante la partida tocá **💬** para abrir el chat.
- Los **mensajes de texto** se envían en vivo: llegan al otro teléfono en unos segundos.
- Las **fotos** (📷) se comprimen automáticamente (máximo ~1 MB) y se envían **en vivo**; además, se guardan **en el propio teléfono** (localStorage), porque no vuelven a viajar por el chat después de recibidas.
- Las fotos viajan **en vivo y se eliminan del servidor al ser entregadas**; quedan guardadas solo en cada teléfono.

### Dónde se guardan los chats

Los mensajes y las sesiones se guardan en una base de datos **Neon (Postgres serverless)** en la nube, identificados por pareja. Las **fotos** no se guardan en la nube: viajan en vivo y se eliminan del servidor al ser entregadas; quedan guardadas solo en cada teléfono. Se mantienen **hasta que se borran a mano**: en **Mis chats** se listan las conversaciones y el botón **🗑** borra para siempre esa pareja y todos sus mensajes (en el servidor y en el teléfono).

### Configuración para el desarrollador / cliente

El modo online necesita una API serverless y una base de datos. Los pasos son:

1. Crear una base de datos en **Neon** y copiar su *connection string* (el `DATABASE_URL`).
2. Crear el esquema de tablas en esa base, corriendo desde la carpeta del proyecto:

   ```bash
   DATABASE_URL="postgresql://..." node scripts/migrate.mjs
   ```

   Debe mostrar `Esquema aplicado correctamente`.

3. Configurar la variable de entorno en el hosting (Vercel) con el mismo valor:

   ```bash
   vercel env add DATABASE_URL
   ```

   Pegar la *connection string* y seleccionar **Production** (y **Preview** si se quiere).

4. Subir el proyecto a Vercel como **Vercel Functions** (las carpetas `api/` se exponen como `/api/*`). El `DATABASE_URL` se lee del entorno: **nunca** debe ir en el código ni en el repositorio.

Sin esa variable configurada, el modo online no puede conectarse; el resto del juego (modo local) sigue funcionando normalmente.

---

## Cómo editar las cartas (archivo `data/cartas.json`)

El archivo `data/cartas.json` contiene todas las cartas del juego. Se edita con cualquier editor de texto (el Bloc de notas sirve). Se ve así:

```json
{
  "categorias": ["Loco", "Picante", "Preguntas", "Retos", "Romantico"],
  "cartas": [
    { "id": 1, "categoria": "Preguntas", "texto": "¿Cuál fue el momento exacto en que supiste que te gustaba?" },
    { "id": 2, "categoria": "Preguntas", "texto": "¿Qué fue lo primero que pensaste cuando me viste la primera vez?" }
  ]
}
```

### Cambiar el texto de una carta

Encuentra la línea de la carta y cambia lo que está entre comillas en `"texto": "..."`. Guarda el archivo y recarga la página.

### Agregar una carta nueva

1. Busca la última carta de la lista (la línea que termina antes del `]`).
2. Cópiala entera, pégala debajo y cámbiala:
   - El `"id"` debe ser el número siguiente al último.
   - La `"categoria"` debe ser una de las categorías existentes (por ejemplo `"Preguntas"`).
   - El `"texto"` es la pregunta o reto nuevo.
   - **Importante:** la última carta de la lista tiene que ir seguida de `]` sin coma, y las demás deben terminar en coma. Copiando una línea completa y cambiándole el texto, el formato queda bien.

### Agregar una categoría nueva

1. En la lista `"categorias": [...]` agregá el nombre nuevo, por ejemplo `"Aventura"`:
   ```json
   "categorias": ["Loco", "Picante", "Preguntas", "Retos", "Romantico", "Aventura"]
   ```
2. Cuando crees cartas de esa categoría, poné `"categoria": "Aventura"` en sus líneas.

> El archivo `data/cartas-usuario.json` tiene el mismo formato, pero normalmente está vacío: ahí se guardan las cartas exportadas desde la aplicación (ver más abajo). No es necesario tocarlo a mano.

---

## Tus propias cartas desde la aplicación

En la pantalla de inicio toca **Mis cartas**:

- **Crear:** elegí la categoría, escribí el texto y tocá **Guardar carta**.
- **Editar o borrar:** cada carta tiene botones para editarla (✏️) o borrarla (🗑).
- **Exportar:** el botón **Exportar JSON** descarga un archivo `cartas-usuario.json` con tus cartas. Guardalo como respaldo o para pasarlo a otro teléfono.
- **Importar:** el botón **Importar JSON** carga un archivo de cartas que hayas exportado antes.

Tus cartas se suman automáticamente a las partidas y quedan guardadas en ese navegador.

---

## Cómo instalar la aplicación

Después de subirla a internet (o mientras la probás en `localhost`), se puede instalar como una aplicación:

### En Android (Chrome)

1. Abrí la página en Chrome.
2. Tocá el menú de tres puntos (⋮).
3. Tocá **"Instalar aplicación"** (o **"Agregar a pantalla principal"**).
4. Confirmá: la app aparece con su ícono en el inicio del teléfono.

### En iPhone (Safari)

1. Abrí la página en Safari.
2. Tocá el botón **Compartir** (el recuadro con la flecha hacia arriba).
3. Tocá **"Añadir a pantalla de inicio"**.
4. Tocá **"Añadir"**: la app queda instalada en el inicio.

---

## Modo sin conexión (offline)

La primera vez que se abre la página, la aplicación se guarda automáticamente en el dispositivo (esto lo hace el *service worker*). Después de esa primera carga, **funciona completa sin internet**: se puede abrir, jugar y hasta instalar sin conexión.

---

## Sonido

Los efectos de sonido se activan con el primer toque. Para silenciar o reactivar, tocá el botón 🔊/🔇 que aparece en la pantalla de inicio y durante la partida. La preferencia se recuerda entre partidas.