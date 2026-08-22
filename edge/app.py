"""
Smart Attend — Edge Face Recognition Service
Runs on Edge PC (Ubuntu 22.04 LTS / CPU, no GPU required)
Exposes local REST API on port 8000 for high-performance offline/LAN face recognition.
"""

import os
import json
import time
import math
import numpy as np
import requests
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="Smart Attend Edge Recognition Service", version="1.0.0")

ALLOWED_ORIGINS = [orig.strip() for orig in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5000").split(",") if orig.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CACHE_FILE = "embeddings_cache.json"
WEBAPP_BACKEND_URL = os.getenv("WEBAPP_BACKEND_URL", "http://localhost:5000")
EDGE_API_KEY = os.getenv("EDGE_API_KEY", "smartattend-edge-default-key")

# Local cache of registered embeddings: { student_id: [128 floats] }
local_embeddings: dict = {}

def load_local_cache():
    global local_embeddings
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                local_embeddings = json.load(f)
                print(f"📦 Loaded {len(local_embeddings)} student embeddings from local edge cache.")
        except Exception as e:
            print(f"⚠️ Failed to read cache: {e}")

def save_local_cache():
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(local_embeddings, f)
    except Exception as e:
        print(f"⚠️ Failed to save cache: {e}")

load_local_cache()

class VerifyFaceRequest(BaseModel):
    hall_ticket_no: str
    live_descriptor: List[float]
    blink_verified: bool = False
    session_id: Optional[str] = None

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "Smart Attend Edge Recognition",
        "cached_embeddings_count": len(local_embeddings),
        "timestamp": time.time()
    }

@app.post("/enroll-sync")
def enroll_sync():
    """
    Pulls latest student embeddings from the central webapp backend and updates local edge cache.
    Works offline if network fails by preserving previous cache.
    """
    global local_embeddings
    try:
        url = f"{WEBAPP_BACKEND_URL}/api/embeddings/sync"
        headers = {"X-API-Key": EDGE_API_KEY}
        resp = requests.get(url, headers=headers, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            embeddings_list = data.get("embeddings", [])
            for item in embeddings_list:
                s_id = item.get("studentId")
                desc = item.get("faceDescriptor")
                if s_id and desc:
                    local_embeddings[s_id] = desc
            save_local_cache()
            return {
                "success": True,
                "synced_count": len(embeddings_list),
                "total_cached": len(local_embeddings),
                "message": "Edge local cache updated successfully."
            }
        else:
            return {"success": False, "error": f"Server returned status {resp.status_code}"}
    except Exception as e:
        return {
            "success": False,
            "offline_mode": True,
            "cached_count": len(local_embeddings),
            "message": f"Network unreachable, using existing local cache: {str(e)}"
        }

@app.post("/verify-face")
def verify_face(payload: VerifyFaceRequest):
    """
    Compares live face vector against cached reference vector.
    Calculates Euclidean (L2) distance and cosine similarity.
    """
    hall_ticket = payload.hall_ticket_no
    live_vec = np.array(payload.live_descriptor, dtype=np.float32)

    # Check if we have registered embedding
    ref_vec_list = local_embeddings.get(hall_ticket)
    if not ref_vec_list:
        raise HTTPException(
            status_code=404,
            detail=f"No face enrollment found for {hall_ticket}. Student must enroll first."
        )

    ref_vec = np.array(ref_vec_list, dtype=np.float32)
    diff = ref_vec - live_vec
    distance = float(np.linalg.norm(diff))
    
    threshold = 0.42
    match = distance <= threshold
    confidence_pct = max(0, min(100, int((1.0 - distance) * 100)))

    return {
        "match": match,
        "confidence_pct": confidence_pct,
        "distance": round(distance, 4),
        "blink_verified": payload.blink_verified,
        "cached": True,
        "message": "Face verified on Edge PC" if match else "Face mismatch"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
