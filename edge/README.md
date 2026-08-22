# Smart Attend — Edge Face Recognition Service Guide

## Setup on Ubuntu 22.04 LTS (Old PC Desktop / CPU)

### 1. Prerequisites
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3.10 python3.10-venv python3-pip build-essential cmake git
```

### 2. Environment & Dependencies
```bash
python3.10 -m venv ~/attendance-env
source ~/attendance-env/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Run the Service
```bash
export WEBAPP_BACKEND_URL="http://<server-ip>:5000"
python3 app.py
```
Or use:
```bash
chmod +x start_edge.sh
./start_edge.sh
```

### 4. Endpoints
- `GET http://localhost:8000/health`: Health status & count of cached student embeddings
- `POST http://localhost:8000/enroll-sync`: Pulls & syncs embeddings from server
- `POST http://localhost:8000/verify-face`: Compares live face capture with registered embedding
