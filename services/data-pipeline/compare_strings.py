import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from pathlib import Path

load_dotenv("../../.env.local")
engine = create_engine(os.getenv("DATABASE_URL"))
file_path = Path(__file__).parent / "driver_names_v2.txt"

# 1. Get 3 sample IDs from your file
with open(file_path, "r") as f:
    file_ids = [line.strip() for line in f if line.strip()][:3]

# 2. Get 3 sample IDs from your database
with engine.connect() as conn:
    db_ids = [row[0] for row in conn.execute(text("SELECT driver_id FROM driver_seasons LIMIT 3")).fetchall()]

print(f"Sample from FILE: {file_ids} -> Types: {[type(i) for i in file_ids]}")
print(f"Sample from DB:   {db_ids} -> Types: {[type(i) for i in db_ids]}")

# Test an exact match if they look similar
if file_ids and db_ids:
    print(f"\nAre they exactly equal? {file_ids[0] == db_ids[0]}")
    print(f"File ID representation: {repr(file_ids[0])}")
    print(f"DB ID representation:   {repr(db_ids[0])}")