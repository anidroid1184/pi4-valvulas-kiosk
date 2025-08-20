import csv
from pathlib import Path
from app.db.database import init_db, bulk_insert_valves


def load_csv(csv_path: Path) -> int:
    init_db()
    with csv_path.open(newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = []
        for r in reader:
            rows.append((
                int(r['id']), r['nombre'], r['uso'], r['ubicacion'], r['qr_code'], r['foto']
            ))
    return bulk_insert_valves(rows)


if __name__ == "__main__":
    csv_file = Path(__file__).resolve().parents[1] / 'data' / 'sample_valves.csv'
    count = load_csv(csv_file)
    print(f"Inserted {count} rows from {csv_file}")
