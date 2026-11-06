# Panel GO Softball (NDI)

Panel de gráficos de **Softball** para transmisiones con vMix. Los gráficos se dibujan en HTML y salen como una fuente **NDI** (Electron + `grandi`). Está adaptado del panel de Baseball5 NDI.

- Panel de control: `http://localhost:8136/control.html`
- Fuente NDI: **"B5 Scorebug"** (mismo nombre que Baseball5, así el **input 8** del proyecto de vMix lo toma sin cambios). Se puede cambiar en el panel (NDI source).
- En vMix el input NDI tiene que estar en un **Overlay** (por ejemplo Overlay 1). El In/Out del panel muestra u oculta el gráfico dentro del NDI.

## Gráficos
Scorebug, Scoreboard (line score), Matchup, Rosters (home/away), **Line up** (home/away), **Defensa**, Umpires, Player, Commentators, Upcoming.

### Line up y Defensa
En la pestaña **Line up** se arma cada equipo: para cada turno (1 a 9) y el **FLEX** se elige el jugador de la lista del Excel (hoja HOME/AWAY) y su posición (P, C, 1B, 2B, 3B, SS, LF, CF, RF, DP, EP). No importa si en el Excel falta el número o la posición.
La **Defensa** dibuja la cancha con cada jugador en su posición (el DP no aparece porque no defiende; el FLEX sí). En "Auto" muestra al equipo que está en el campo.

## Reglas de softball (fastpitch WBSC)
| Acción | Qué hace |
|---|---|
| Ball + | Suma bola. La 4ª = base por bolas: avanzan los corredores forzados (con bases llenas entra carrera). |
| Strike + | Suma strike. El 3º = out. |
| Foul | Suma strike solo si hay menos de 2. |
| + Out | Suma out y reinicia el conteo. El 3º = cambio de lado automático. |
| Cambio de lado | TOP → BOTTOM; BOTTOM → TOP de la entrada siguiente. Limpia outs, bases y conteo. |
| Tie-breaker | Por defecto arranca en la entrada siguiente a las reglamentarias (8ª con 7, 6ª con 5) con corredor en 2ª. Se puede fijar otra entrada o apagarlo. |
| Carrera / Hit | Para el equipo que batea (TOP = visitante, BOTTOM = local). |
| Error | Para el equipo que defiende. |
| Nuevo partido | Borra carreras, hits, errores y line score. |

El scoreboard muestra las **entradas reglamentarias** (7 por defecto; 5 para infantiles, se cambia en el panel) y agrega columnas si hay extra innings, con totales **R H E**.

## Excel
`Datos.xlsx` en la carpeta que contiene `softball-ndi` (o la ruta de la variable `SB_EXCEL`). Hojas **HOME**, **AWAY**, **UMPIRES** y opcional **EQUIPOS**, columnas A/B/C: número, nombre, posición (o rol). Ver `Datos-ejemplo.xlsx`. Después de guardar, **Sync Excel** en el panel.

## Instalar en otra PC
1. Instalar **Node.js** (nodejs.org) y **Python** (python.org, tildar "Add to PATH").
2. Bajar el repo (git clone o "Code > Download ZIP") en cualquier carpeta, por ejemplo `Videos\Softball2026\softball-ndi`.
3. Doble clic en **`INSTALAR.cmd`** (instala Electron/NDI y openpyxl, y crea un `Datos.xlsx` de ejemplo).
4. Clic derecho en **`ABRIR_FIREWALL.cmd`** > Ejecutar como administrador (para el celular).
5. Arrancar con **`ARRANCAR SOFTBALL.cmd`** y cerrar con **`PARAR SOFTBALL.cmd`** (los dos dentro de la carpeta del panel).
6. En vMix: input NDI "<NOMBRE-PC> (B5 Scorebug)" en un Overlay.

El Excel `Datos.xlsx` se busca primero en la carpeta de arriba y si no, dentro de la carpeta del panel. Arriba en el panel, la línea **Excel** muestra qué archivo usa y si lo encuentra (✓/✗); con **Cambiar ruta** se pega la ruta de cualquier Excel (Explorador: clic derecho > Copiar como ruta) y con **Subir Excel** se carga el archivo desde el navegador. Si falta Python u openpyxl, el mensaje de Sync Excel lo indica.

## Arranque
- `ARRANCAR SOFTBALL.cmd` (o `scripts\START_NDI_SCOREBUG.cmd`). Panel en `http://localhost:8136/control.html`.
- Para cerrar: `PARAR SOFTBALL.cmd` o `scripts\STOP_NDI_SCOREBUG.cmd`.

## Logos y equipos
- **Carpeta `Logos`** al lado del `Datos.xlsx` (se crea sola). Cualquier imagen PNG/JPG/WEBP/SVG/GIF que se copie ahí aparece en los selectores de logo del panel.
- **Subir logo**: botón debajo de cada selector de logo; guarda la imagen en la carpeta `Logos` y la asigna al equipo.
- **Borrar logos** elimina todos los logos de la carpeta `Logos` (salen de la lista y los equipos quedan sin logo), para cargar los del torneo siguiente.
- **Hoja `EQUIPOS`** (opcional) en el Excel: A Nombre, B Sigla, C Color (#hex), D Logo (nombre del archivo en `Logos`, con o sin extensión). En el panel, "equipo (Excel)" completa nombre, sigla, color y logo de una. Después de editar el Excel, **Sync Excel**.

## Fixture y Upcoming
- Hoja **FIXTURE** con encabezados **FECHA** (opcional), **HORA**, **LOCAL**, **VISITANTE**, **DIAMANTE** (en cualquier orden). Hoja **DIAMANTES** con la lista de diamantes (columna A).
- Arriba del panel, en **Diamante**, elegir en qué diamante se está transmitiendo: el Upcoming se carga solo con los partidos de ese diamante (también con el botón **Cargar del fixture** en la pestaña Upcoming). Toma los partidos de hoy de ese diamante que siguen al partido actual (el de Teams & Score); si el partido actual no está en el fixture, usa la hora de la PC. Carga hasta 3 (según "Show games"); el resto se edita a mano.

## Publicidades y zócalos
- Carpeta **Publicidades** (se busca sola al lado del Excel o dentro de una subcarpeta, ej. `Copa Beto Pelizario\Publicidades`; se puede fijar otra con "Cambiar carpeta"). Imágenes 1920x1080 a pantalla completa; dentro, subcarpeta **Zocalos** con PNG transparentes 1920x1080. Sin audio. Al agregar o sacar imágenes: **Recargar**.
- Pestaña **Publicidades**: In / Out / Anterior / Siguiente, segundos por imagen y modo (**Rotar en loop**, **Una vuelta y sale sola**, **Fija**). Clic en una miniatura para elegir desde cuál arranca (o cambiarla al aire).
- Los zócalos se superponen al juego; por defecto el scorebug se oculta mientras sale el zócalo y vuelve solo (configurable). La publicidad a pantalla completa queda por encima de todo.
- También en el celular (Publicidad / Zócalo: In, Sig., Out) y en Stream Deck (`AD_IN`, `AD_NEXT`, `AD_OUT`, `ZOCALO_IN`, `ZOCALO_NEXT`, `ZOCALO_OUT`).

## Controlador MIDI (Korg nanoKONTROL Studio u otro)
- Pestaña **MIDI**. El panel tiene que estar abierto en **Chrome o Edge** en la PC donde está conectado el controlador (el navegador pide permiso de MIDI la primera vez). En vMix: Settings → **Web Controller** activado.
- **Asistente de configuración**: va pidiendo cada acción ("apretá el botón para Cámara 1…"); se puede saltear. También **Aprender** y **Probar** por acción. Las asignaciones se guardan en `data/midi.json` (por PC).
- **Cámaras**: Cut directo al input de vMix configurado (Cámara 1–8 → input).
- **Replay (vMix)**: Mark In, Mark Out, Play evento seleccionado al aire (igual que el Play del panel de replay de vMix: usa la transición/stinger configurada en el replay), **Stop replay** (vuelve con Stinger 1 o 2 a la cámara que estaba al aire antes del replay y frena el replay), Play/Pausa, Live, ángulos 1–4, **fader** de velocidad.
- **Replay de los últimos 10 s / 15 s**: crea el replay y lo deja seleccionado. Mark Out también deja seleccionado el replay recién marcado.
- **Jog**: por defecto **corre el comienzo (Punto In) del replay seleccionado**, cuadro a cuadro con aceleración. Con "Cambiar modo del jog" alterna **Punto In / Punto Out / Posición**.
- **Juego y gráficos**: Ball, Strike, Foul, Out, Carrera, Hit, Error, Cambio de lado, bases, Conteo 0-0, Deshacer, Scorebug / Zócalo / Publicidad In-Out.

## Celular (solo scorebug)
Desde un celular en la misma red (WiFi o **ZeroTier**) abrir `http://IP-DE-LA-PC:8136/m`. En el panel de la PC, arriba a la derecha, aparece la dirección (la de ZeroTier primero); tocándola muestra un **QR** para escanear. La página del celular muestra el nombre de la PC a la que está conectada, así no se confunde si hay dos PCs con el panel en la misma red.
Botones: Ball, Strike, Foul, Out, Carrera, Hit, Base por bolas, Conteo 0-0, Error, Cambio de lado, Limpiar bases, **Deshacer**, Scorebug In/Out, bases tocando el diamante y correcciones.
Si no conecta: permitir Electron en el firewall de Windows también para redes **públicas** (ZeroTier suele quedar como pública).

## Stream Deck
Acciones `.vbs` en `scripts/streamdeck` (Ball, Strike, Foul, Conteo, Out, Cambio de lado, Carrera, Hit, Error, bases, entrada). Atajos globales en `public/streamdeck.html`.
