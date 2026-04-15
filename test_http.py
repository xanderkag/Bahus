from http.server import BaseHTTPRequestHandler
from http import HTTPStatus

class MockHandler(BaseHTTPRequestHandler):
    def __init__(self):
        pass
    def log_request(self, code):
        pass
    def send_response_only(self, code, message=None):
        print(f"send_response_only: {code} -> {int(code)}")

h = MockHandler()
try:
    h.send_response(HTTPStatus.INTERNAL_SERVER_ERROR)
    print("SUCCESS")
except Exception as e:
    print(f"FAILED: {e}")
