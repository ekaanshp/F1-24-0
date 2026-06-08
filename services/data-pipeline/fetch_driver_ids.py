import time
import requests
from pathlib import Path

# Setup
BASE_URL = "https://racinghub.net/api/v1/drivers"
OUTPUT_FILE = Path(__file__).parent / "driver_names_v2.txt"

def fetch_all_driver_ids():
    driver_ids = []
    page = 1
    has_next = True

    print("Fetching driver list from API with rate-limit protection...")

    while has_next:
        retries = 0
        max_retries = 5
        success = False

        while retries < max_retries:
            try:
                print(f"Fetching page {page}...")
                response = requests.get(BASE_URL, params={"page": page})
                
                # Check for rate limiting explicitly (HTTP 429)
                if response.status_code == 429:
                    wait_time = 2 ** retries
                    print(f"Rate limited on page {page}. Waiting {wait_time}s...")
                    time.sleep(wait_time)
                    retries += 1
                    continue
                
                # If it's any other error code (like 500, 404, etc.), catch it
                if response.status_code != 200:
                    print(f"Error fetching page {page}: {response.status_code}")
                    break
                
                # Success block
                data = response.json()
                
                # Extract IDs
                for driver in data.get("data", []):
                    driver_ids.append(driver["id"])
                    
                # Update pagination state
                has_next = data.get("has_next", False)
                page += 1
                success = True
                break # Break retry loop, move to next page
                
            except Exception as e:
                print(f"Network error on page {page}: {e}")
                retries += 1
                time.sleep(2)
        
        # If we exhausted retries or hit a non-200 error without success, stop pagination entirely
        if not success:
            print(f"Stopping fetch early due to persistent errors on page {page}.")
            break

    return driver_ids

def main():
    ids = fetch_all_driver_ids()
    
    # Save to file
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        for driver_id in ids:
            f.write(f"{driver_id}\n")
    
    print(f"Successfully saved {len(ids)} driver IDs to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()