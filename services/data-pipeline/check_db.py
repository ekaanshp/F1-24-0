import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Load your config
load_dotenv('../../.env.local')

# Connect
engine = create_engine(os.getenv('DATABASE_URL'))

# Count
with engine.connect() as conn:
    result = conn.execute(text("SELECT COUNT(*) FROM driver_results"))
    count = result.scalar()
    print(f"--- DATABASE COUNT: {count} ---")