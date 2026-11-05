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
`Datos.xlsx` en la carpeta que contiene `softball-ndi` (o la ruta de la variable `SB_EXCEL`). Hojas **HOME**, **AWAY** y **UMPIRES**, columnas A/B/C: número, nombre, posición (o rol). Ver `Datos-ejemplo.xlsx`. Después de guardar, **Sync Excel** en el panel.

## Instalar en otra PC
1. Instalar **Node.js** (nodejs.org) y **Python** (python.org, tildar "Add to PATH"). NDI Tools es opcional (para probar con NDI Studio Monitor).
2. Crear una carpeta, por ejemplo `Videos\Softball2026`, y adentro clonar o descargar el repo con el nombre **`softball-ndi`**:
   `git clone https://github.com/kfam2009/Softball.git softball-ndi`
   (o "Code > Download ZIP" y renombrar la carpeta a `softball-ndi`; el nombre importa para el script de parar).
3. Doble clic en `softball-ndi\INSTALAR.cmd`: instala Electron/NDI, openpyxl, y copia `ARRANCAR SOFTBALL.cmd`, `PARAR SOFTBALL.cmd` y un `Datos.xlsx` de ejemplo a la carpeta de arriba.
4. Arrancar con `ARRANCAR SOFTBALL.cmd`. En vMix agregar el input NDI "<NOMBRE-PC> (B5 Scorebug)" y ponerlo en un Overlay.

El Excel se busca en la carpeta que contiene `softball-ndi` (`..\Datos.xlsx`), así que no depende del usuario de Windows.

## Arranque
- `ARRANCAR SOFTBALL.cmd` (o `scripts\START_NDI_SCOREBUG.cmd`). Panel en `http://localhost:8136/control.html`.
- Para cerrar: `PARAR SOFTBALL.cmd` o `scripts\STOP_NDI_SCOREBUG.cmd`.

## Celular (solo scorebug)
Desde un celular en la misma red (WiFi o **ZeroTier**) abrir `http://IP-DE-LA-PC:8136/m`. En el panel de la PC, arriba a la derecha, aparece la dirección (la de ZeroTier primero); tocándola muestra un **QR** para escanear. La página del celular muestra el nombre de la PC a la que está conectada, así no se confunde si hay dos PCs con el panel en la misma red.
Botones: Ball, Strike, Foul, Out, Carrera, Hit, Base por bolas, Conteo 0-0, Error, Cambio de lado, Limpiar bases, **Deshacer**, Scorebug In/Out, bases tocando el diamante y correcciones.
Si no conecta: permitir Electron en el firewall de Windows también para redes **públicas** (ZeroTier suele quedar como pública).

## Stream Deck
Acciones `.vbs` en `scripts/streamdeck` (Ball, Strike, Foul, Conteo, Out, Cambio de lado, Carrera, Hit, Error, bases, entrada). Atajos globales en `public/streamdeck.html`.
