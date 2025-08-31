import os
import sys
import subprocess
import webbrowser
import time

# Determine base path depending on whether frozen
if getattr(sys, 'frozen', False):
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

script_path = os.path.join(base_path, "contract_automation.py")

# Run Streamlit in headless mode with no file-watching
process = subprocess.Popen(
    [sys.executable, "-m", "streamlit", "run", script_path,
     "--server.headless=true",
     "--server.runOnSave=false",
     "--server.port=8501"],
)

# Give Streamlit a few seconds to start
time.sleep(3)

# Open browser automatically
webbrowser.open("http://localhost:8501")

try:
    process.wait()
except KeyboardInterrupt:
    process.terminate()