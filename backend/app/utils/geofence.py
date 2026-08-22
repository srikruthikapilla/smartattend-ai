import math

def calculate_haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """
    Calculates great-circle distance between two coordinates in meters.
    """
    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return int(round(R * c))

# Single-row campus geofence configuration (SBIT Campus, Khammam)
current_geofence = {
    "id": 1,
    "center_lat": 17.2472,
    "center_lng": 80.1514,
    "radius_m": 150
}

def update_geofence(lat: float, lng: float, radius_m: int):
    global current_geofence
    current_geofence = {
        "id": 1,
        "center_lat": lat,
        "center_lng": lng,
        "radius_m": radius_m
    }
