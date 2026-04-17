"""Fire 5 demo events to populate the dashboard."""
import httpx
import time

events = [
    {
        "event_id": "demo-001",
        "translated_description": "Exposed live wire dangling over school playground in Gachibowli",
        "domain": "ELECTRICITY",
        "coordinates": {"lat": 17.4401, "lng": 78.3489},
    },
    {
        "event_id": "demo-002",
        "translated_description": "Water main burst flooding MG Road near Secunderabad railway station",
        "domain": "WATER",
        "coordinates": {"lat": 17.4399, "lng": 78.5018},
    },
    {
        "event_id": "demo-003",
        "translated_description": "Large pothole causing traffic jam at Kukatpally junction",
        "domain": "TRAFFIC",
        "coordinates": {"lat": 17.4947, "lng": 78.3996},
    },
    {
        "event_id": "demo-004",
        "translated_description": "Garbage overflow near Charminar for 5 days, strong smell",
        "domain": "MUNICIPAL",
        "coordinates": {"lat": 17.3616, "lng": 78.4747},
    },
    {
        "event_id": "demo-005",
        "translated_description": "Construction crane operating without safety perimeter near hospital",
        "domain": "MUNICIPAL",
        "coordinates": {"lat": 17.4156, "lng": 78.4347},
    },
]

for i, ev in enumerate(events):
    r = httpx.post("http://localhost:8000/api/v1/trigger-analysis", json=ev, timeout=30)
    d = r.json()["data"]["pulse_event"]
    eid = ev["event_id"]
    score = d["impact_score"]
    color = d["severity_color"]
    print(f"  [{i+1}/5] {eid} -> {r.status_code} score={score} color={color}")
    time.sleep(1)

print("\nDone! Check http://localhost:3000 now.")
