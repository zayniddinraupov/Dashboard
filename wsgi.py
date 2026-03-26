"""
WSGI config for HR Dashboard on PythonAnywhere
"""
import sys

# Add your project directory to the path
path = '/home/YOUR_USERNAME/HRDashboard'
if path not in sys.path:
    sys.path.insert(0, path)

# Import Flask app
from app import app as application
