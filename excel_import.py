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
        if not any([number, player_name, role]):
            continue
        # Saltea una fila de titulos (ej: "#  Nombre  Pos").
        if not rows and {number.lower(), player_name.lower()} & HEADER_WORDS:
            continue
        rows.append({"number": number, "name": player_name, "role": role})
    return rows


def roster_text(rows):
    return "\n".join(f"{row['number']}  {row['name']}  {row['role']}".strip() for row in rows)


def main():
    workbook_path = Path(sys.argv[1]) if len(sys.argv) > 1 else WORKBOOK
    workbook = load_workbook(workbook_path, data_only=True)
    home = read_sheet(workbook, "HOME")
    away = read_sheet(workbook, "AWAY")
    umpires = read_sheet(workbook, "UMPIRES")
    data = {
        "source": str(workbook_path),
        "home": home,
        "away": away,
        "umpires": umpires,
        "homeText": roster_text(home),
        "awayText": roster_text(away),
        "umpiresText": roster_text(umpires),
    }
    print(json.dumps(data, ensure_ascii=True))


if __name__ == "__main__":
    main()
