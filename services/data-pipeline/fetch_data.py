import os
from pathlib import Path
import pandas as pd
import psycopg2
from sqlalchemy import create_engine
from racinghub_client import ApiClient, Configuration
from racinghub_client.api import drivers_api
from dotenv import load_dotenv

# Resolve paths relative to this script
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[1]
load_dotenv(dotenv_path=ROOT_DIR / ".env.local")
DRIVER_IDS_FILE = SCRIPT_DIR / "driver_names_v2.txt"


def read_driver_ids(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"Driver list not found: {path}")

    driver_ids = []
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            driver_id = line.strip()
            if not driver_id or driver_id.startswith("#"):
                continue
            driver_ids.append(driver_id)

    return driver_ids


def fetch_driver_seasons(api, driver_id: str):
    try:
        results = api.get_driver_seasons(driver_id)
    except Exception as exc:
        print(f"Warning: failed to fetch seasons for {driver_id}: {exc}")
        return []

    return [record.model_dump() for record in results or []]


def normalize_dataframe(df: pd.DataFrame):
    for col in df.columns:
        if df[col].apply(lambda x: isinstance(x, dict)).any():
            df[col] = df[col].apply(lambda x: str(x) if isinstance(x, dict) else x)

    if "grid_position" in df.columns and "position" in df.columns:
        df["positions_gained"] = df["grid_position"] - df["position"]

    return df


def main():
    config = Configuration(host="https://racinghub.net/api/v1")

    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in .env file!")
        return

    engine = create_engine(db_url)

    try:
        driver_ids = read_driver_ids(DRIVER_IDS_FILE)
    except FileNotFoundError as exc:
        print(exc)
        return

    if not driver_ids:
        print(f"No driver IDs found in {DRIVER_IDS_FILE}")
        return

    all_rows = []
    print(f"Fetching seasons for {len(driver_ids)} drivers...")

    with ApiClient(config) as api_client:
        api = drivers_api.DriversApi(api_client)

        for driver_id in driver_ids:
            print(f"  - fetching seasons for: {driver_id}")
            rows = fetch_driver_seasons(api, driver_id)
            if not rows:
                print(f"    no season data or fetch error for {driver_id}")
                continue
            all_rows.extend(rows)

    if not all_rows:
        print("No driver results were loaded from the API.")
        return

    df = pd.DataFrame(all_rows)
    df = normalize_dataframe(df)

    print(f"Saving {len(df)} rows to Neon...")
    df.to_sql("driver_seasons", engine, if_exists="replace", index=False)

    print("Data saved to Neon database successfully!")
    if {"race_date", "circuit_name", "positions_gained"}.issubset(df.columns):
        print(df[["race_date", "circuit_name", "positions_gained"]].head())
    else:
        print(df.head())


if __name__ == "__main__":
    main()
