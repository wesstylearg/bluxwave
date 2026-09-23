# BluxWave 🌊

> **"Todo lo necesario para escuchar música. Nada de lo que distrae."**

BluxWave es un reproductor de música minimalista para Windows conectado a YouTube, diseñado para ofrecer una experiencia limpia, rápida y libre del ruido visual de YouTube (sin shorts, comentarios, recomendaciones infinitas ni feeds sociales).

---

## Características Principales

- **Arquitectura Ultraligera:** Desarrollado con **Tauri**, **HTML5**, **CSS3** y **JavaScript Vanilla**. Sin frameworks pesados, con un consumo de recursos mínimo.
- **Integración 100% Oficial:** Búsquedas mediante la **YouTube Data API v3** y reproducción oficial con el **YouTube IFrame Player API**. Sin descargas ni scraping.
- **Mini Player Persistente:** Control total de reproducción, barra de tiempo (scrubbing), control de volumen, favoritos y acceso a cola.
- **Focus Mode:** Modo inmersivo a gran escala con portada ampliada, iluminación ambiental y controles esenciales.
- **Cola Dinámica & Playlists:** Gestión de colas de reproducción y creación de playlists locales.
- **Historial & Favoritos:** Almacenamiento local persistente para acceso inmediato.
- **Color Dinámico:** Extracción automática de tonalidades de la portada para generar un fondo ambiental sutil con efecto blur.
- **Atajos de Teclado:**
  - `Espacio`: Reproducir / Pausar
  - `←` / `→`: Retroceder / Avanzar 5 segundos
  - `↑` / `↓`: Subir / Bajar volumen
  - `Esc`: Salir de Focus Mode o cerrar paneles/modales

---

## Configuración de YouTube API Key

Para buscar en todo el catálogo de YouTube en tiempo real:

1. Obtén una clave de API gratuita en la [Google Cloud Console](https://console.cloud.google.com/) habilitando **YouTube Data API v3**.
2. Puedes configurarla de dos formas sencillas:
   - **Desde la aplicación:** Ve a la sección **Ajustes** en la barra lateral e ingresa tu clave. Se guardará de forma segura en tu almacenamiento local.
   - **Mediante archivo `.env`:**
     ```bash
     cp .env.example .env
     ```
     Edita `.env` y añade tu clave:
     ```env
     VITE_YOUTUBE_API_KEY=AIzaSy...
     ```

*Nota: Si no introduces una clave de inmediato, BluxWave incluye un catálogo de pistas seleccionadas para poder probar la reproducción, la cola y los controles al instante.*

---

## Ejecución y Desarrollo

### Requisitos previos
- [Node.js](https://nodejs.org/) (versión 18 o superior)
- Para compilar el binario nativo de Windows: [Rust](https://rustup.rs/) y Visual Studio C++ Build Tools.

### Iniciar en modo desarrollo
```bash
npm install
npm run dev
```
Abre tu navegador en `http://localhost:1420` para probar la interfaz y reproducción con recarga en caliente.

### Ejecutar como aplicación de escritorio con Tauri
```bash
npm run tauri dev
```

### Compilar instalador para Windows (.msi / .exe)
```bash
npm run tauri build
```

---

## Estructura del Código

```text
BluxWave/
├── src/
│   ├── index.html          # Estructura principal y contenedores de vistas
│   ├── css/
│   │   ├── main.css        # Variables de diseño, resets, grid y layout
│   │   ├── components.css  # Componentes (Sidebar, MiniPlayer, Cards, Modales)
│   │   └── animations.css  # Animaciones sutiles y aceleradas por GPU
│   ├── js/
│   │   ├── app.js          # Orquestador y bootstrap de la app
│   │   ├── config.js       # Gestor de ajustes y API keys
│   │   ├── storage.js      # Persistencia local (localStorage)
│   │   ├── youtube.js      # Cliente oficial de YouTube Data API v3
│   │   ├── player.js       # Controlador oficial de YouTube IFrame Player
│   │   ├── queue.js        # Gestor de cola de reproducción
│   │   ├── favorites.js    # Gestión de favoritos
│   │   ├── history.js      # Historial de canciones reproducidas
│   │   ├── playlists.js    # CRUD de listas de reproducción
│   │   ├── color.js        # Extracción de color dominante para ambiente
│   │   ├── shortcuts.js    # Manejo de atajos de teclado globales
│   │   └── ui.js           # Renderizador y navegación de interfaz
│   └── assets/
│       └── logo.svg        # Isotipo de BluxWave
├── src-tauri/              # Configuración y backend de Tauri
├── package.json
└── vite.config.js
```
