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

## Sponsor al lado del scorebug
En la pestaña **Scorebug**: "Sponsor al lado del scorebug" (prender/apagar) y "Logo del sponsor" (cualquier imagen de la carpeta **Logos**). Sale a la izquierda del scorebug, misma altura y alineado; entra y sale junto con el scorebug. Por defecto usa `South_logo_amarillo.png` si está en Logos.

## Home Run
En la pestaña **Scorebug**, tarjeta **Home Run**: botón **Home Run In / Out** (y **Monitor**). Sale abajo a la izquierda, en la misma franja que el scorebug, con el logo y el color del **equipo que batea**, "HOME RUN" en dorado con animación (letras, brillo y una pelota que entra rodando) y abajo el bateador (opcional) y el equipo. Sale solo a los segundos configurados (0 = queda hasta Out). En el MIDI: acción **"Home Run In/Out"** (grupo Gráficos).

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

## Rosters por equipo
Además de HOME y AWAY, el Excel puede tener **una hoja por equipo** con el **mismo nombre que en la hoja EQUIPOS** (ej. `LINIERS`, `CEF1 ROJO`), columnas A número, B apellido y nombre, C posición o rol (Manager, Coach, Jefe de Equipo, Auxiliar). Después de **Sync Excel**, al elegir los equipos en Teams & Score (o el "equipo (Excel)"), los rosters, el Line up y el Player toman solos el plantel de cada equipo. Si un equipo no tiene hoja, se usa HOME/AWAY.

## Logos y equipos
- **Carpeta `Logos`** al lado del `Datos.xlsx` (se crea sola). Cualquier imagen PNG/JPG/WEBP/SVG/GIF que se copie ahí aparece en los selectores de logo del panel.
- **Subir logo**: botón debajo de cada selector de logo; guarda la imagen en la carpeta `Logos` y la asigna al equipo.
- **Borrar logos** elimina todos los logos de la carpeta `Logos` (salen de la lista y los equipos quedan sin logo), para cargar los del torneo siguiente.
- **Hoja `EQUIPOS`** (opcional) en el Excel: A Nombre, B Sigla, C Color (#hex), D Logo (nombre del archivo en `Logos`, con o sin extensión). En el panel, "equipo (Excel)" completa nombre, sigla, color y logo de una. Después de editar el Excel, **Sync Excel**.

## Fixture y Upcoming
- Hoja **FIXTURE** con encabezados **FECHA** (opcional), **HORA**, **LOCAL**, **VISITANTE**, **DIAMANTE** (en cualquier orden). Hoja **DIAMANTES** con la lista de diamantes (columna A).
- Arriba del panel, en **Diamante**, elegir en qué diamante se está transmitiendo: el Upcoming se carga solo con los partidos de ese diamante (también con el botón **Cargar del fixture** en la pestaña Upcoming). Si el partido actual (el de Teams & Score) está en el fixture, toma los que siguen; si no, los próximos según la fecha y hora de la PC. Pueden ser de otro día: en ese caso, en lugar de "Próximo" muestra el día (ej. VIE 13/11). Carga hasta 3 (según "Show games"); el resto se edita a mano.

## Publicidades y zócalos
- Carpeta **Publicidades** (se busca sola al lado del Excel o dentro de una subcarpeta, ej. `Copa Beto Pelizario\Publicidades`; se puede fijar otra con "Cambiar carpeta"). Imágenes 1920x1080 a pantalla completa; dentro, subcarpeta **Zocalos** con PNG transparentes 1920x1080. Sin audio. Al agregar o sacar imágenes: **Recargar**.
- Pestaña **Publicidades**: In / Out / Anterior / Siguiente, segundos por imagen y modo (**Rotar en loop**, **Una vuelta y sale sola**, **Fija**). Clic en una miniatura para elegir desde cuál arranca (o cambiarla al aire).
- **Orden**: con las flechas ◀ ▶ debajo de cada miniatura o arrastrándolas se cambia el orden de rotación (por ejemplo, para que dos publicidades del mismo sponsor no salgan seguidas). El orden queda guardado; las imágenes nuevas van al final.
- Los zócalos se superponen al juego; por defecto el scorebug se oculta mientras sale el zócalo y vuelve solo (configurable). La publicidad a pantalla completa queda por encima de todo.
- También en el celular (Publicidad / Zócalo: In, Sig., Out) y en Stream Deck (`AD_IN`, `AD_NEXT`, `AD_OUT`, `ZOCALO_IN`, `ZOCALO_NEXT`, `ZOCALO_OUT`).

## Controlador MIDI (Korg nanoKONTROL Studio u otro)
- Pestaña **MIDI**. El panel tiene que estar abierto en **Chrome o Edge** en la PC donde está conectado el controlador (el navegador pide permiso de MIDI la primera vez). En vMix: Settings → **Web Controller** activado.
- **Asistente de configuración**: va pidiendo cada acción ("apretá el botón para Cámara 1…"); se puede saltear. También **Aprender** y **Probar** por acción. Las asignaciones se guardan en `data/midi.json` (por PC).
- **Cámaras**: Cut directo al input de vMix configurado (Cámara 1–8 → input).
- **Replay (vMix)**: Mark In, Mark Out, Play evento seleccionado al aire (igual que el Play del panel de replay de vMix: usa la transición/stinger configurada en el replay), **Stop replay** (vuelve con Stinger 1 o 2 a la cámara que estaba al aire antes del replay y frena el replay), Play/Pausa, Live, ángulos 1–4, **Velocidad del replay** con el fader (deslizable).
- **Velocidad**: asignar "Velocidad del replay" con **Aprender** moviendo el fader (aparece como "Fader N"; el nanoKONTROL en modo Mackie manda pitch bend). La velocidad cambia de forma gradual (no salta aunque se mueva el fader de golpe): arriba 100 %, abajo 5 %.
- **Replay de los últimos 10 s / 15 s**: crea el replay y lo deja seleccionado. Mark Out también deja seleccionado el replay recién marcado.
- **Jog**: por defecto **corre el comienzo (Punto In) del replay seleccionado**, cuadro a cuadro con aceleración. Con "Cambiar modo del jog" alterna **Punto In / Punto Out / Posición**.
- **Audio**: **Volumen 1** y **Volumen 2** con faders (por defecto input 1 = cámara 1 e input 11 = música; se cambia en "Volumen 1/2 → input"). Asignar con **Aprender** moviendo el fader. Si vMix tiene un atajo MIDI en el mismo fader, borrarlo en Settings → Shortcuts.
- **Juego y gráficos**: Ball, Strike, Foul, Out, Carrera, Hit, Error, Cambio de lado, bases, Conteo 0-0, Deshacer, Scorebug / Zócalo / Publicidad In-Out.

## Domos (PTZ)
- **Accesos rápidos** (arriba de la pestaña Domos): cada domo con botones **Pos 1** y **Pos 2** que la llevan directo a esa posición guardada, sin elegir la cámara antes.
- Pestaña **Domos**: lista de cámaras (nombre, marca, IP, puerto, usuario, clave) con **+ Cámara / Eliminar / Guardar cámara / Probar**. Se guardan por PC en `data/domos.json` (no se sube al GitHub; la clave no vuelve al navegador, se muestra `••••`).
- Pad de 8 flechas + **■** (frenar) y **Zoom + / −**: mantener apretado para mover, soltar para parar. Un toque corto mueve un **paso** (Corto / Medio / Largo).
- **Posiciones guardadas** 1–6 por cámara: "Guardar acá" graba la posición actual, "Ir a" la recupera (en Foscam son los presets PG1–PG6).
- **Ver cámara**: primero intenta **video en vivo (MJPEG)**; si la cámara no lo da, muestra **fotos seguidas** (hasta ~10 por segundo, según lo que aguante la cámara y la red). Abajo de la vista dice qué modo está usando. Todo pasa por el panel: la clave no viaja al navegador.
- **Vista fluida por vMix**: en cada domo, completar **Input de vMix** (ej. 1, 3 o 4). Con "Ver cámara" el panel pone la **External 2** de vMix en ese input (`SetOutputExternal2`), la arranca si estaba apagada (`StartExternal`) y muestra la cámara virtual **"vMix Video External 2"** (el navegador pide permiso de cámara la primera vez). Al cambiar de domo, la External 2 cambia sola. Sin input de vMix, usa video MJPEG o fotos seguidas.
- **Medidor de WiFi** (en Domos): "Medir ahora" o "Medir continuo (cada 15 s)". Muestra la **señal que recibe la cámara** (0–100, la mide la propia cámara escaneando las redes: 70+ buena, 40–69 regular, <40 mala), la **respuesta al panel** (ms y cortes) y una **velocidad aproximada** con una foto de prueba; abajo, las redes que ve la cámara. Escanear puede cortar el video 1–2 s: no dejarlo continuo en el aire.
- Marcas: **Foscam** (API CGI, puerto por defecto 88) y **Longse / otras ONVIF** (ContinuousMove / Stop / SetPreset / GotoPreset, foto por GetSnapshotUri; el puerto es el del servicio ONVIF, no el 554 del video). **Buscar cámaras en la red** encuentra las cámaras ONVIF (WS-Discovery) y prueba los puertos típicos de la IP cargada; "Usar este puerto" lo corrige. La señal WiFi solo la informa Foscam.
- El panel (la PC) le manda los comandos a la IP de la cámara: tiene que llegar por la red local o ZeroTier.

## Igualar colores (pestaña Color)
El panel le pide a vMix una foto de cada cámara (`SnapshotInput`), mide el color de una zona neutra y ajusta la **Corrección de color** de cada input (`SetCCGainR/G/B`, 0–2, 1 = sin cambio) para que se parezca a la cámara patrón. No toca Lift, Gamma ni Saturación. vMix tiene que estar en la misma PC que el panel.
1. Poner algo neutro que vean todas las cámaras (cartulina gris o blanca, una base, la línea de cal).
2. **Sacar fotos y medir** y, en cada foto, arrastrar un rectángulo sobre esa zona.
3. **Igualar con la patrón** (primero pone Gain en 1, mide de nuevo y aplica). **Verificar** saca fotos nuevas: "vs patrón" cerca de 0 % = igualada. **Restablecer** vuelve todo a Gain 1.
Conviene balance de blancos fijo en las cámaras y repetirlo si cambia la luz.

## Celular (solo scorebug)
Desde un celular en la misma red (WiFi o **ZeroTier**) abrir `http://IP-DE-LA-PC:8136/m`. En el panel de la PC, arriba a la derecha, aparece la dirección (la de ZeroTier primero); tocándola muestra un **QR** para escanear. La página del celular muestra el nombre de la PC a la que está conectada, así no se confunde si hay dos PCs con el panel en la misma red.
Botones: Ball, Strike, Foul, Out, Carrera, Hit, Base por bolas, Conteo 0-0, Error, Cambio de lado, Limpiar bases, **Deshacer**, Scorebug In/Out, bases tocando el diamante y correcciones.
Si no conecta: permitir Electron en el firewall de Windows también para redes **públicas** (ZeroTier suele quedar como pública).

## Stream Deck
Acciones `.vbs` en `scripts/streamdeck` (Ball, Strike, Foul, Conteo, Out, Cambio de lado, Carrera, Hit, Error, bases, entrada). Atajos globales en `public/streamdeck.html`.
