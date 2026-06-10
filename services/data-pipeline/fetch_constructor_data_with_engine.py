import os
import time
import pandas as pd
from pathlib import Path
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Import the API client and SeasonsApi module
from racinghub_client import ApiClient, Configuration
from racinghub_client.api import seasons_api

# Path Setup
SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[1]
load_dotenv(dotenv_path=ROOT_DIR / ".env.local")


def safe_int(value):
    """Safely converts a value to int, defaulting to 0 if None or invalid."""
    if value is None or pd.isna(value):
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

    all_rows = []

    # Single open client session
    with ApiClient(config) as api_client:
        s_api = seasons_api.SeasonsApi(api_client)

        # Loop through all years from 1950 to 2026 inclusive
        for year in range(1950, 2027):
            retries = 0
            while retries < 5:
                try:
                    print(f"Fetching constructors for season: {year}...")
                    constructors = s_api.get_season_constructors(year=year)

                    if constructors:
                        for c in constructors:
                            # Safely handle attributes whether they are returned as objects or dicts
                            c_dict = c.model_dump() if hasattr(c, "model_dump") else (c.__dict__ if hasattr(c, "__dict__") else c)
                            
                            # Handle dictionary access or attribute access gracefully
                            def get_field(obj, field, default=None):
                                if isinstance(obj, dict):
                                    return obj.get(field, default)
                                return getattr(obj, field, default)

                            team_name = get_field(c_dict, "name") or get_field(c_dict, "id")
                            engine_name = get_field(c_dict, "engine_manufacturer") or get_field(c_dict, "engine_manufacturer_id")
                            position = get_field(c_dict, "position")
                            points = get_field(c_dict, "points") or 0.0
                            race_wins = get_field(c_dict, "race_wins") or 0
                            pole_positions = get_field(c_dict, "pole_positions") or 0

                            all_rows.append({
                                "year": year,
                                "team_name": team_name,
                                "engine_manufacturer_name": engine_name,
                                "position": safe_int(position),  # Will turn None/null into 0
                                "points": float(points),
                                "race_wins": safe_int(race_wins),
                                "pole_positions": safe_int(pole_positions)
                            })
                    
                    # Pause briefly to respect rate limits between years
                    time.sleep(0.1)
                    break

                except Exception as e:
                    if "429" in str(e):
                        wait = 2 ** retries
                        print(f"Rate limited on year {year}. Waiting {wait}s...")
                        time.sleep(wait)
                        retries += 1
                    else:
                        print(f"Error fetching year {year}: {e}")
                        break

    # 3. Write New Rows to Neon Database
    print("\n--- Saving Season Constructors with Engines to Database ---")
    
    if all_rows:
        df = pd.DataFrame(all_rows)
        # Drop duplicates just in case the API returns redundant entries across endpoints
        df = df.drop_duplicates(subset=["year", "team_name", "engine_manufacturer_name"])
        
        print(f"Writing {len(df)} rows to 'constructor_seasons_with_engines' table...")
        df.to_sql("constructor_seasons_with_engines", engine, if_exists="replace", index=False)
        print("Table successfully created and populated.")
    else:
        print("No data rows collected to save.")

    print("\nPipeline execution finished successfully!")


if __name__ == "__main__":
    main()