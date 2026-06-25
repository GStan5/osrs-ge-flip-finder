@echo off
cd /d "%~dp0"
echo Starting OSRS GE Flip Finder at http://localhost:3500
echo Press Ctrl+C to stop.
start "" "http://localhost:3500"
npx --yes serve -l 3500
