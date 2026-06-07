import os
import pandas as pd
import psycopg2
from sqlalchemy import create_engine
from racinghub_client import ApiClient, Configuration
from racinghub_client.api import drivers_api
from dotenv import load_dotenv

# Load credentials from your root .env file
load_dotenv(dotenv_path="../../.env.local")

def main():
    # 1. Setup the RacingHub Client
    config = Configuration(host="https://racinghub.net/api/v1")

    # 2. Database setup using SQLAlchemy
    # DATABASE_URL comes from your .env file
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        print("Error: DATABASE_URL not found in .env file!")
        return

    engine = create_engine(db_url)

    # 3. Fetch data from RacingHub
    print("Fetching data from RacingHub...")
    with ApiClient(config) as api_client:
        api = drivers_api.DriversApi(api_client)
        results = api.get_driver_races_results("lewis-hamilton", limit=100)
        
        # 4. Transform data using Pandas
        df = pd.DataFrame([r.model_dump() for r in results.data])
        df["positions_gained"] = df["grid_position"] - df["position"]

        # Identify columns that are dictionaries and convert them to strings
        for col in df.columns:
            # Check if any value in the column is a dict
            if df[col].apply(lambda x: isinstance(x, dict)).any():
                df[col] = df[col].apply(lambda x: str(x) if isinstance(x, dict) else x)
        
        # 5. Save to Neon database
        # 'if_exists="replace"' makes this safe for testing
        print("Saving data to Neon...")
        df.to_sql("driver_results", engine, if_exists="replace", index=False)
        
        print("Data saved to Neon database successfully!")
        print(df[["race_date", "circuit_name", "positions_gained"]].head())

if __name__ == "__main__":
    main()