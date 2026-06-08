import os
import time
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Import the specific API clients and modules needed
from racinghub_client import ApiClient, Configuration
from racinghub_client.api import drivers_api, constructors_api

# Path Setup
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[1]
load_dotenv(dotenv_path=ROOT_DIR / ".env.local")

DRIVER_IDS_FILE = SCRIPT_DIR / "driver_names_v2.txt"
CONSTRUCTOR_IDS_FILE = SCRIPT_DIR / "constructor_names.txt"


def read_ids_from_file(path: Path):
    if not path.exists():
        print(f"Warning: ID file not found at {path}")
        return []
    with path.open("r", encoding="utf-8") as file:
        return [line.strip() for line in file if line.strip() and not line.startswith("#")]


def get_existing_ids(engine, table_name, id_column):
    """Checks the database to see which IDs have already been processed."""
    try:
        with engine.connect() as conn:
            query = text(f"SELECT DISTINCT {id_column} FROM {table_name}")
            result = conn.execute(query)
            # FIX: Use .scalars().all() or explicitly pull the mapping string to get pure strings
            return {str(row[0]).strip() for row in result if row[0] is not None}
    except Exception as e:
        print(f"Note: Could not read existing IDs from {table_name}: {e}")
        return set()


def safe_int(value):
    """Safely converts a value to int, defaulting to 0 if None or invalid."""
    if value is None:
        return 0
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0


def main():
    # 1. Database & API Configuration Setup
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in .env file!")
        return

    engine = create_engine(db_url)
    config = Configuration(host="https://racinghub.net/api/v1")

    # Read ID source lists
    driver_ids = read_ids_from_file(DRIVER_IDS_FILE)
    constructor_ids = read_ids_from_file(CONSTRUCTOR_IDS_FILE)

    # Get already processed IDs to skip 20-minute reload
    existing_drivers = get_existing_ids(engine, "driver_seasons", "driver_id")
    existing_constructors = get_existing_ids(engine, "constructor_seasons", "constructor_id")

    # Initialize container lists for new rows
    all_driver_rows = []
    all_constructor_rows = []

    # Single open client session
    with ApiClient(config) as api_client:
        d_api = drivers_api.DriversApi(api_client)
        c_api = constructors_api.ConstructorsApi(api_client)

        # -------------------------------------------------------------
        # PHASE 1: DRIVERS
        # -------------------------------------------------------------
        if driver_ids:
            # Clean up the driver IDs array for exact string matching
            clean_driver_ids = [str(d).strip() for d in driver_ids]
            # Calculate remaining work
            remaining_drivers = [d for d in clean_driver_ids if d not in existing_drivers]
            
            print(f"Found {len(existing_drivers)} drivers already in DB.")
            print(f"Processing remaining {len(remaining_drivers)} drivers...")
            
            for d_id in remaining_drivers:
                retries = 0
                while retries < 5:
                    try:
                        print(f"  - Fetching profile for driver: {d_id}")
                        driver_profile = d_api.get_driver(d_id)
                        driver_name = driver_profile.full_name if hasattr(driver_profile, "full_name") else driver_profile.name

                        print(f"  - Fetching season history for driver: {d_id}")
                        seasons = d_api.get_driver_seasons(d_id)
                        
                        if seasons:
                            for season in seasons:
                                s_data = season.model_dump() if hasattr(season, "model_dump") else season.__dict__
                                
                                c_names = s_data.get("constructors_name", [])
                                if isinstance(c_names, list):
                                    c_names = ", ".join(c_names)

                                all_driver_rows.append({
                                    "driver_id": d_id,
                                    "driver_name": driver_name,
                                    "year": safe_int(s_data.get("year")),
                                    "position": safe_int(s_data.get("position")),
                                    "points": float(s_data.get("points") or 0.0),
                                    "race_wins": safe_int(s_data.get("race_wins")),
                                    "pole_positions": safe_int(s_data.get("pole_positions")),
                                    "constructors": c_names
                                })
                        break

                    except Exception as e:
                        if "429" in str(e):
                            wait = 2 ** retries
                            print(f"Rate limited on driver {d_id}. Waiting {wait}s...")
                            time.sleep(wait)
                            retries += 1
                        else:
                            print(f"Skipping driver {d_id} due to error: {e}")
                            break

        # -------------------------------------------------------------
        # PHASE 2: CONSTRUCTORS
        # -------------------------------------------------------------
        if constructor_ids:
            clean_constructor_ids = [str(c).strip() for c in constructor_ids]
            remaining_constructors = [c for c in clean_constructor_ids if c not in existing_constructors]
            
            print(f"\nFound {len(existing_constructors)} constructors already in DB.")
            print(f"Processing remaining {len(remaining_constructors)} constructors...")
            
            for c_id in remaining_constructors:
                retries = 0
                while retries < 5:
                    try:
                        print(f"  - Fetching profile for constructor: {c_id}")
                        constructor_profile = c_api.get_constructor(c_id)
                        constructor_name = constructor_profile.name

                        print(f"  - Fetching season history for constructor: {c_id}")
                        seasons = c_api.get_constructor_seasons(c_id)
                        
                        if seasons:
                            for season in seasons:
                                s_data = season.model_dump() if hasattr(season, "model_dump") else season.__dict__
                                
                                all_constructor_rows.append({
                                    "constructor_id": c_id,
                                    "constructor_name": constructor_name,
                                    "year": safe_int(s_data.get("year")),
                                    "position": safe_int(s_data.get("position")),
                                    "points": float(s_data.get("points") or 0.0),
                                    "race_wins": safe_int(s_data.get("race_wins")),
                                    "pole_positions": safe_int(s_data.get("pole_positions"))
                                })
                        break

                    except Exception as e:
                        if "429" in str(e):
                            wait = 2 ** retries
                            print(f"Rate limited on constructor {c_id}. Waiting {wait}s...")
                            time.sleep(wait)
                            retries += 1
                        else:
                            print(f"Skipping constructor {c_id} due to error: {e}")
                            break

    # -------------------------------------------------------------
    # PHASE 3: WRITE NEW ROWS TO NEON
    # -------------------------------------------------------------
    print("\n--- Saving New Collections to Database ---")
    
    if all_driver_rows:
        df_drivers = pd.DataFrame(all_driver_rows)
        print(f"Appending {len(df_drivers)} new rows to 'driver_seasons'...")
        df_drivers.to_sql("driver_seasons", engine, if_exists="append", index=False)

    if all_constructor_rows:
        df_constructors = pd.DataFrame(all_constructor_rows)
        print(f"Appending {len(df_constructors)} new rows to 'constructor_seasons'...")
        df_constructors.to_sql("constructor_seasons", engine, if_exists="append", index=False)

    print("\nPipeline execution finished successfully!")


if __name__ == "__main__":
    main()