import time
import requests
from pathlib import Path

# Setup
BASE_URL = "https://racinghub.net/api/v1/constructors"
OUTPUT_FILE = Path(__file__).parent / "constructor_names.txt"

def fetch_all_constructor_ids():
    constructor_ids = []
    page = 1
    has_next = True

    print("Fetching constructor list from API with rate-limit protection...")

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
                
                # Catch other HTTP errors
                if response.status_code != 200:
                    print(f"Error fetching page {page}: {response.status_code}")
                    break
                
                # Success block
                data = response.json()
                
                # Extract IDs
                for constructor in data.get("data", []):
                    constructor_ids.append(constructor["id"])
                    
                # Update pagination state
                has_next = data.get("has_next", False)
                page += 1
                success = True
                break # Break retry loop, move to next page
                
            except Exception as e:
                print(f"Network error on page {page}: {e}")
                retries += 1
                time.sleep(2)
        
        # If retries are exhausted or a non-200 occurs without success, stop entirely
        if not success:
            print(f"Stopping fetch early due to persistent errors on page {page}.")
            break

    return constructor_ids

def main():
    ids = fetch_all_constructor_ids()
    
    # Save to file
    with OUTPUT_FILE.open("w", encoding="utf-8") as f:
        for constructor_id in ids:
            f.write(f"{constructor_id}\n")
    
    print(f"Successfully saved {len(ids)} constructor IDs to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()