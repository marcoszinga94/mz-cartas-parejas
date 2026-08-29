CREATE TABLE IF NOT EXISTS parejas (
  id SERIAL PRIMARY KEY,
  creada_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mensajes (
  id SERIAL PRIMARY KEY,
  pareja_id INTEGER NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
  autor_id TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'texto',
  contenido TEXT NOT NULL,
  creada_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sesiones (
  id SERIAL PRIMARY KEY,
  pareja_id INTEGER NOT NULL REFERENCES parejas(id) ON DELETE CASCADE,
  codigo TEXT UNIQUE NOT NULL,
  creador_id TEXT NOT NULL,
  jugador2_id TEXT,
  nombre1 TEXT NOT NULL,
  nombre2 TEXT,
  estado TEXT NOT NULL DEFAULT 'espera',
  turno INTEGER NOT NULL DEFAULT 1,
  categorias TEXT NOT NULL DEFAULT '[]',
  carta_categoria TEXT,
  carta_texto TEXT,
  puntos1 INTEGER NOT NULL DEFAULT 0,
  puntos2 INTEGER NOT NULL DEFAULT 0,
  creada_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_pareja ON mensajes(pareja_id, id);
CREATE INDEX IF NOT EXISTS idx_sesiones_pareja ON sesiones(pareja_id);