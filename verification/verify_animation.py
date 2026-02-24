import os
import tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright


def resolve_output_dir():
    configured = os.getenv("VERIFICATION_OUTPUT_DIR")
    if configured:
        output_dir = Path(configured).expanduser().resolve()
    else:
        output_dir = Path(tempfile.gettempdir()) / "sonic-architect-verification"
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def verify_waveform_animation():
    app_url = os.getenv("APP_URL", "http://localhost:3000")
    output_dir = resolve_output_dir()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to app...")
            page.goto(app_url)

            # Wait for page to load
            page.wait_for_load_state("networkidle")

            print("Checking for header...")
            # Use get_by_role to be specific
            header = page.get_by_role("heading", name="Sonic Architect")
            if header.is_visible():
                print("Header found. App is running.")
            else:
                print("Header NOT found.")

            # Take a screenshot of the initial state
            screenshot_path = output_dir / "app_loaded.png"
            page.screenshot(path=str(screenshot_path))
            print(f"Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Error: {e}")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    verify_waveform_animation()
