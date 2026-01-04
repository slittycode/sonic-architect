
from playwright.sync_api import sync_playwright
import time

def verify_waveform_animation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            print("Navigating to app...")
            page.goto("http://localhost:3000")

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
            page.screenshot(path="verification/app_loaded.png")
            print("Screenshot saved to verification/app_loaded.png")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_waveform_animation()
