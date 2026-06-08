# test_missing.py
from racinghub_client import ApiClient, Configuration
config = Configuration(host="https://racinghub.net/api/v1")

with ApiClient(config) as api_client:
    from racinghub_client.api import drivers_api
    d_api = drivers_api.DriversApi(api_client)
    
    # Replace 'some-missing-id' with an ID from your text file 
    # that you know isn't in your DB yet.
    d_id = "theo-pourchaire" 
    seasons = d_api.get_driver_seasons(d_id)
    print(f"Data for {d_id}: {seasons}")