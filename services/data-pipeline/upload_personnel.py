#!/usr/bin/env python3
import os
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[1]
load_dotenv(dotenv_path=ROOT_DIR / ".env.local")

def main():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in environment!")
        return

    print("Connecting to database...")
    engine = create_engine(db_url)

    # 1. Create/Recreate tables
    tables = {
        "car_designers": "car_designers",
        "team_principals": "team_principals",
        "team_engineers": "team_engineers"
    }

    with engine.connect() as conn:
        print("Recreating database tables...")
        # 1. Car designers table
        conn.execute(text("DROP TABLE IF EXISTS car_designers CASCADE;"))
        conn.execute(text("""
            CREATE TABLE car_designers (
                id SERIAL PRIMARY KEY,
                year INT NOT NULL,
                name TEXT NOT NULL,
                team TEXT NOT NULL
            );
        """))
        
        # 2. Team principals table
        conn.execute(text("DROP TABLE IF EXISTS team_principals CASCADE;"))
        conn.execute(text("""
            CREATE TABLE team_principals (
                id SERIAL PRIMARY KEY,
                year INT NOT NULL,
                name TEXT NOT NULL,
                team TEXT NOT NULL
            );
        """))

        # 3. Team engineers table (with driver column)
        conn.execute(text("DROP TABLE IF EXISTS team_engineers CASCADE;"))
        conn.execute(text("""
            CREATE TABLE team_engineers (
                id SERIAL PRIMARY KEY,
                year INT NOT NULL,
                name TEXT NOT NULL,
                team TEXT NOT NULL,
                driver TEXT
            );
        """))
        conn.commit()

    # 2. Load CSVs and upload to Neon
    for table_name in tables.keys():
        csv_path = SCRIPT_DIR / f"{table_name}.csv"
        if not csv_path.exists():
            print(f"Error: CSV file {csv_path} not found!")
            continue
        
        print(f"Reading {csv_path}...")
        df = pd.read_csv(csv_path)
        
        # Ensure only valid columns are present
        cols = ["year", "name", "team"]
        if table_name == "team_engineers":
            cols.append("driver")
        df = df[cols]
        
        print(f"Uploading {len(df)} rows to table '{table_name}'...")
        # Since table exists and has SERIAL id, we use if_exists='append' and do not supply 'id'
        df.to_sql(table_name, engine, if_exists="append", index=False)
        print(f"Table '{table_name}' populated successfully.")

    # 3. Verify upload
    print("\n--- Verification ---")
    with engine.connect() as conn:
        for table_name in tables.keys():
            res = conn.execute(text(f"SELECT COUNT(*) FROM {table_name}")).scalar()
            print(f"Table '{table_name}': {res} rows in database.")
            
            # Print sample row
            if table_name == "team_engineers":
                sample = conn.execute(text(f"SELECT year, name, team, driver FROM {table_name} LIMIT 1")).fetchone()
            else:
                sample = conn.execute(text(f"SELECT year, name, team FROM {table_name} LIMIT 1")).fetchone()
            print(f"  Sample row: {sample}")

    print("\nPersonnel database upload finished successfully!")

if __name__ == "__main__":
    main()
