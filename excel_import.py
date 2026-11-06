import datetime
import json
import sys
from pathlib import Path

from openpyxl import load_workbook


WORKBOOK = Path(r"C:\Users\claud\Videos\Softball2026\Datos.xlsx")


def clean(value):
    if value is None:
        return ""
    return repair_text(str(value).strip())


def repair_text(value):
    replacements = {
        "S\ufffdnchez": "Sánchez",
        "Vell\ufffdn": "Vellón",
        "Andr\ufffds": "Andrés",
        "Aldama Sofia": "Aldama Sofía",
        "Onniel Andres": "Onniel Andrés",
    }
    for broken, fixed in replacements.items():
        value = value.replace(broken, fixed)
    return value


HEADER_WORDS = {"#", "nro", "numero", "número", "number", "nombre", "name", "pos", "posicion", "posición", "position", "rol", "role"}


def read_sheet(workbook, name):
    if name not in workbook.sheetnames:
        return []
    sheet = workbook[name]
    rows = []
    for values in sheet.iter_rows(values_only=True):
        values = list(values[:3]) + [None] * (3 - len(values[:3]))
        number, player_name, role = (clean(v) for v in values)
        if number.endswith(".0"):
            number = number[:-2]
        if not any([number, player_name, role]):
            continue
        # Saltea una fila de titulos (ej: "#  Nombre  Pos").
        if not rows and {number.lower(), player_name.lower()} & HEADER_WORDS:
            continue
        rows.append({"number": number, "name": player_name, "role": role})
    return rows


def read_lineup(workbook, names):
    sheet = next((workbook[n] for n in names if n in workbook.sheetnames), None)
    if sheet is None:
        return []
    rows = []
    for values in sheet.iter_rows(values_only=True):
        values = list(values[:4]) + [None] * (4 - len(values[:4]))
        order, number, name, pos = (clean(v) for v in values)
        if not name:
            continue
        if not rows and name.lower() in HEADER_WORDS:
            continue
        if order.endswith(".0"):
            order = order[:-2]
        if number.endswith(".0"):
            number = number[:-2]
        rows.append({"order": order, "number": number, "name": name, "pos": pos})
    return rows


def read_teams(workbook):
    # Hoja opcional EQUIPOS: A Nombre, B Sigla, C Color (#hex), D Logo (nombre de archivo en la carpeta Logos)
    sheet = find_sheet(workbook, ["EQUIPOS", "TEAMS"])
    if sheet is None:
        return []
    teams = []
    for values in sheet.iter_rows(values_only=True):
        values = list(values[:4]) + [None] * (4 - len(values[:4]))
        name, short, color, logo = (clean(v) for v in values)
        if not name:
            continue
        if not teams and name.lower() in {"nombre", "equipo", "name", "team"}:
            continue
        if color and not color.startswith("#") and len(color) in (3, 6):
            color = "#" + color
        teams.append({"name": name, "short": short, "color": color, "logo": logo})
    return teams


def find_sheet(workbook, names):
    lower = {name.lower(): name for name in workbook.sheetnames}
    for name in names:
        if name.lower() in lower:
            return workbook[lower[name.lower()]]
    return None


def fmt_time(value):
    if value is None or value == "":
        return ""
    if isinstance(value, datetime.datetime):
        return value.strftime("%H:%M")
    if isinstance(value, datetime.time):
        return value.strftime("%H:%M")
    if isinstance(value, (int, float)) and 0 <= value < 1:
        minutes = round(value * 24 * 60)
        return f"{minutes // 60:02d}:{minutes % 60:02d}"
    text = str(value).strip().lower().replace("hs", "").replace("h", ":").replace(".", ":").strip(": ")
    parts = text.split(":")
    try:
        hour = int(parts[0])
        minute = int(parts[1]) if len(parts) > 1 and parts[1] else 0
        return f"{hour:02d}:{minute:02d}"
    except ValueError:
        return str(value).strip()


def fmt_date(value):
    if value is None or value == "":
        return ""
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    for pattern in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.datetime.strptime(text, pattern).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return text


def read_fixture(workbook):
    # Hoja FIXTURE con encabezados: FECHA (opcional), HORA, LOCAL, VISITANTE, DIAMANTE (en cualquier orden).
    sheet = find_sheet(workbook, ["FIXTURE", "FIXTURES", "CALENDARIO"])
    if sheet is None:
        return []
    aliases = {
        "date": {"fecha", "dia", "día", "date"},
        "time": {"hora", "horario", "time"},
        "home": {"local", "home"},
        "away": {"visitante", "visita", "away"},
        "diamond": {"diamante", "cancha", "campo", "diamond"},
    }
    columns = None
    games = []
    for values in sheet.iter_rows(values_only=True):
        if columns is None:
            header = [str(v or "").strip().lower() for v in values]
            found = {key: next((i for i, h in enumerate(header) if h in names), None) for key, names in aliases.items()}
            if found["home"] is not None and found["away"] is not None:
                columns = found
                continue
            columns = {"date": None, "time": 0, "home": 1, "away": 2, "diamond": 3}

        def cell(key):
            index = columns.get(key)
            return values[index] if index is not None and index < len(values) else None

        home = clean(cell("home"))
        away = clean(cell("away"))
        if not home and not away:
            continue
        games.append({
            "date": fmt_date(cell("date")),
            "time": fmt_time(cell("time")),
            "home": home,
            "away": away,
            "diamond": clean(cell("diamond")),
        })
    return games


def read_diamonds(workbook):
    sheet = find_sheet(workbook, ["DIAMANTES", "DIAMANTE", "CANCHAS"])
    if sheet is None:
        return []
    names = []
    for values in sheet.iter_rows(values_only=True):
        name = clean(values[0] if values else None)
        if name and name.lower() not in {"diamante", "diamantes", "nombre"} and name not in names:
            names.append(name)
    return names


def lineup_text(rows):
    return "\n".join(f"{r['order']} | {r['number']} | {r['name']} | {r['pos']}" for r in rows)


def roster_text(rows):
    return "\n".join(f"{row['number']}  {row['name']}  {row['role']}".strip() for row in rows)


def main():
    workbook_path = Path(sys.argv[1]) if len(sys.argv) > 1 else WORKBOOK
    workbook = load_workbook(workbook_path, data_only=True)
    home = read_sheet(workbook, "HOME")
    away = read_sheet(workbook, "AWAY")
    umpires = read_sheet(workbook, "UMPIRES")
    teams = read_teams(workbook)
    fixture = read_fixture(workbook)
    diamonds = read_diamonds(workbook)
    for game in fixture:
        if game["diamond"] and game["diamond"] not in diamonds:
            diamonds.append(game["diamond"])
    lineup_home = read_lineup(workbook, ["LINEUP_HOME", "LINEUP HOME", "LINEUP-HOME"])
    lineup_away = read_lineup(workbook, ["LINEUP_AWAY", "LINEUP AWAY", "LINEUP-AWAY"])
    data = {
        "source": str(workbook_path),
        "home": home,
        "away": away,
        "umpires": umpires,
        "homeText": roster_text(home),
        "awayText": roster_text(away),
        "umpiresText": roster_text(umpires),
        "teams": teams,
        "fixture": fixture,
        "diamonds": diamonds,
        "lineupHome": lineup_home,
        "lineupAway": lineup_away,
        "lineupHomeText": lineup_text(lineup_home),
        "lineupAwayText": lineup_text(lineup_away),
    }
    print(json.dumps(data, ensure_ascii=True))


if __name__ == "__main__":
    main()
