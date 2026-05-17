import os
import subprocess
import sys
import time
import webbrowser

# sys._MEIPASS is set by PyInstaller when running as a frozen executable
if getattr(sys, "frozen", False):
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

script_path = os.path.join(base_path, "contract_automation.py")

process = subprocess.Popen(
    [
        sys.executable, "-m", "streamlit", "run", script_path,
        "--server.headless=true",
        "--server.runOnSave=false",
        "--server.port=8501",
    ]
)

time.sleep(3)
webbrowser.open("http://localhost:8501")

try:
    process.wait()
except KeyboardInterrupt:
    process.terminate()
