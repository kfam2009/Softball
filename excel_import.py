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
        "lineupHome": lineup_home,
        "lineupAway": lineup_away,
        "lineupHomeText": lineup_text(lineup_home),
        "lineupAwayText": lineup_text(lineup_away),
    }
    print(json.dumps(data, ensure_ascii=True))


if __name__ == "__main__":
    main()
