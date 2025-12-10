import json
from datetime import datetime
from typing import List, Dict, Any

# Load the JSON file
with open(r'c:\Users\td\dev\web\tdunsford.github.io\bus\sample.json', 'r') as f:
    data = json.load(f)

# Extract routes with BLUE or F8 keys
target_routes = {}
route_schedules = data['stop-schedule']['route-schedules']

for route_schedule in route_schedules:
    route_key = route_schedule['route']['key']
    if route_key in ['BLUE', 'F8']:
        target_routes[route_key] = route_schedule

# Collect all scheduled stops and sort by estimated departure time
all_stops = []

for route_key, route_schedule in target_routes.items():
    route_name = route_schedule['route']['name']
    scheduled_stops = route_schedule['scheduled-stops']
    
    for stop in scheduled_stops:
        estimated_departure = stop['times']['departure']['estimated']
        all_stops.append({
            'route_key': route_key,
            'route_name': route_name,
            'stop_key': stop['key'],
            'trip_key': stop['trip-key'],
            'estimated_departure': estimated_departure,
            'variant_name': stop['variant']['name'],
            'bus_key': stop['bus']['key'],
            'cancelled': stop['cancelled']
        })

# Sort by estimated departure time
all_stops.sort(key=lambda x: x['estimated_departure'])

# Pick the next 8 stops
next_8_stops = all_stops[:8]

# Display results
print(f"Found {len(all_stops)} total scheduled stops for BLUE and F8 routes")
print(f"\nNext 8 stops sorted by estimated departure time:\n")
print(f"{'#':<3} {'Route':<8} {'Variant':<20} {'Est. Departure':<20} {'Bus':<5} {'Cancelled':<10}")
print("-" * 80)

for i, stop in enumerate(next_8_stops, 1):
    departure = datetime.fromisoformat(stop['estimated_departure']).strftime('%H:%M:%S')
    print(f"{i:<3} {stop['route_key']:<8} {stop['variant_name']:<20} {departure:<20} {stop['bus_key']:<5} {stop['cancelled']:<10}")

print("\n\nDetailed JSON output:")
print(json.dumps(next_8_stops, indent=2))
