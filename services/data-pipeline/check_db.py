import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv("../../.env.local")
engine = create_engine(os.getenv("DATABASE_URL"))

with engine.connect() as conn:
    # 1. Let's see what tables actually exist
    tables = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")).fetchall()
    print("Tables found:", [t[0] for t in tables])
    
    # 2. Let's look at the columns inside driver_seasons
    try:
        cols = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name = 'driver_seasons'")).fetchall()
        print("Columns in driver_seasons:", [c[0] for c in cols])
    except Exception as e:
        print("Error reading columns:", e)