import requests
import json

url = "https://bahus-production.up.railway.app/api/debug/test"

r = requests.post(url)
print("Result:", r.status_code, r.text)
