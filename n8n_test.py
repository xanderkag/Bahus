import requests
import time

url = "https://n8n.chevich.com/webhook/bakhus-pdf-import" # The webhook url in the screenshot

with open("test.txt", "w") as f:
    f.write("test content")

print("Sending as multipart...")
r = requests.post(url, data={"force": "true"}, files={"file": ("test.txt", open("test.txt", "rb"), "text/plain")})
print("Result:", r.status_code, r.text)

