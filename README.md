# Panel GO Softball (NDI)

Panel de gráficos de **Softball** para transmisiones con vMix. Los gráficos se dibujan en HTML y salen como una fuente **NDI** (Electron + `grandi`). Está adaptado del panel de Baseball5 NDI.

- Panel de control: `http://localhost:8136/control.html`
- Fuente NDI: **"B5 Scorebug"** (mismo nombre que Baseball5, así el **input 8** del proyecto de vMix lo toma sin cambios). Se puede cambiar en el panel (NDI source).
- En vMix el input NDI tiene que estar en un **Overlay** (por ejemplo Overlay 1). El In/Out del panel muestra u oculta el gráfico dentro del NDI.

## Gráficos
Scorebug, Scoreboard (line score), Matchup, Rosters (home/away), Umpires, Player, Commentators, Upcoming.

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
`C:\Users\claud\Videos\Softball2026\Datos.xlsx` (cambiar con la variable `SB_EXCEL`). Hojas **HOME**, **AWAY** y **UMPIRES**, columnas A/B/C: número, nombre, posición (o rol). Ver `Datos-ejemplo.xlsx`. Después de guardar, **Sync Excel** en el panel.

## Arranque en Windows
1. `npm install` (o copiar `node_modules` de Baseball5 y correr `REPARAR_DEPENDENCIAS.cmd`).
2. `ARRANCAR SOFTBALL.cmd` (en la carpeta que contiene `softball-ndi`, ver `launchers/`) o `scripts\START_NDI_SCOREBUG.cmd`.
3. Para cerrar: `PARAR SOFTBALL.cmd` o `scripts\STOP_NDI_SCOREBUG.cmd`.

## Stream Deck
Acciones `.vbs` en `scripts/streamdeck` (Ball, Strike, Foul, Conteo, Out, Cambio de lado, Carrera, Hit, Error, bases, entrada). Atajos globales en `public/streamdeck.html`.
