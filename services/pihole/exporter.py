#!/usr/bin/env python3
"""Pi-hole v6 Prometheus exporter."""
import json, os, time, urllib.request
from http.server import HTTPServer, BaseHTTPRequestHandler

PIHOLE_URL = os.getenv("PIHOLE_URL", "http://localhost:80")
INTERVAL = int(os.getenv("INTERVAL", "30"))

cache = {}

def fetch(endpoint):
    url = f"{PIHOLE_URL}/api/{endpoint}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.loads(r.read())

def scrape():
    try:
        stats = fetch("stats/summary")
        queries = stats.get("queries", {})
        clients = fetch("stats/clients")
        
        cache.clear()
        cache["pihole_queries_total"] = queries.get("total", 0)
        cache["pihole_queries_blocked"] = queries.get("blocked", 0)
        cache["pihole_queries_cached"] = queries.get("cached", 0)
        cache["pihole_queries_forwarded"] = queries.get("forwarded", 0)
        cache["pihole_queries_percent_blocked"] = queries.get("percent_blocked", 0)
        cache["pihole_clients_total"] = clients.get("clients", {}).get("total", 0)
        cache["pihole_domains_blocked"] = fetch("dns/blocklist").get("blocklist", {}).get("domains_blocked", 0)
        cache["pihole_gravity_last_updated"] = fetch("dns/gravity").get("gravity", {}).get("last_update", {}).get("timestamp", 0)
        cache["success"] = True
    except Exception as e:
        cache["success"] = False
        cache["error"] = str(e)

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/metrics":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            
            lines = [
                "# HELP pihole_queries_total Total DNS queries processed",
                "# TYPE pihole_queries_total gauge",
                f"pihole_queries_total {cache.get('pihole_queries_total', 0)}",
                "",
                "# HELP pihole_queries_blocked Total blocked DNS queries",
                "# TYPE pihole_queries_blocked gauge",
                f"pihole_queries_blocked {cache.get('pihole_queries_blocked', 0)}",
                "",
                "# HELP pihole_queries_cached Total cached DNS queries",
                "# TYPE pihole_queries_cached gauge",
                f"pihole_queries_cached {cache.get('pihole_queries_cached', 0)}",
                "",
                "# HELP pihole_queries_forwarded Total forwarded DNS queries",
                "# TYPE pihole_queries_forwarded gauge",
                f"pihole_queries_forwarded {cache.get('pihole_queries_forwarded', 0)}",
                "",
                "# HELP pihole_queries_percent_blocked Percentage of blocked queries",
                "# TYPE pihole_queries_percent_blocked gauge",
                f"pihole_queries_percent_blocked {cache.get('pihole_queries_percent_blocked', 0)}",
                "",
                "# HELP pihole_clients_total Active clients",
                "# TYPE pihole_clients_total gauge",
                f"pihole_clients_total {cache.get('pihole_clients_total', 0)}",
                "",
                "# HELP pihole_domains_blocked Number of domains in blocklist",
                "# TYPE pihole_domains_blocked gauge",
                f"pihole_domains_blocked {cache.get('pihole_domains_blocked', 0)}",
                "",
                "# HELP pihole_up Exporter scrape status (1=ok, 0=fail)",
                "# TYPE pihole_up gauge",
                f"pihole_up {1 if cache.get('success') else 0}",
                "",
            ]
            self.wfile.write("\n".join(lines).encode())
        else:
            self.send_response(404)
            self.end_headers()
    def log_message(self, *a): pass

scrape()
import threading
def loop():
    while True:
        time.sleep(INTERVAL)
        scrape()
threading.Thread(target=loop, daemon=True).start()

HTTPServer(("0.0.0.0", 9617), Handler).serve_forever()
