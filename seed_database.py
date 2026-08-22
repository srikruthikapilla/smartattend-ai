#!/usr/bin/env python3
"""
Smart Attend - Terminal Seeding Command
Run:
    python seed_database.py
"""
import subprocess
import sys
import os

if __name__ == "__main__":
    script_path = os.path.join(os.path.dirname(__file__), "backend", "app", "seed.py")
    if not os.path.exists(script_path):
        script_path = os.path.join("backend", "app", "seed.py")
    
    python_exec = sys.executable
    venv_python = os.path.join(os.path.dirname(__file__), "backend", ".venv", "Scripts", "python.exe")
    if os.path.exists(venv_python):
        python_exec = venv_python

    subprocess.run([python_exec, script_path], check=True)
