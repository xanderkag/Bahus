import requests

url = "https://bahus-production.up.railway.app/api/imports"

with open("test.pdf", "wb") as f:
    f.write(b"fake pdf content " * 1000)

files = {
    "file": ("test.pdf", open("test.pdf", "rb"), "application/pdf")
}
data = {
    "pipeline": "price_list"
}

print("Uploading to backend...")
r = requests.post(url, data=data, files=files)
print("Result:", r.status_code, r.text)
