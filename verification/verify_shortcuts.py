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


def verify_shortcuts():
    app_url = os.getenv("APP_URL", "http://localhost:3000")
    output_dir = resolve_output_dir()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Go to app
            page.goto(app_url)

            # Wait for content to load
            page.wait_for_selector("text=Sonic Architect", timeout=10000)

            # Since we can't easily upload a file and play it in headless mode without a real file,
            # we will verify the attributes on the button are present even if disabled.
            # But the button is only visible if we have a file?
            # No, the playback section is visible but disabled?
            # Let's check the code:
            # <section ...> <button ...> ... </button> </section> is rendered unconditionally.

            # Check for the button
            play_button = page.get_by_role("button", name="Start playback")

            # Check if aria-keyshortcuts is present
            aria_keyshortcuts = play_button.get_attribute("aria-keyshortcuts")
            print(f"aria-keyshortcuts: {aria_keyshortcuts}")
            assert aria_keyshortcuts == "Space"

            # Check title
            title = play_button.get_attribute("title")
            print(f"title: {title}")
            assert "Space" in title

            # Screenshot
            screenshot_path = output_dir / "verification.png"
            page.screenshot(path=str(screenshot_path))
            print(f"Verification successful. Screenshot saved to {screenshot_path}")

        except Exception as e:
            print(f"Verification failed: {e}")
            error_path = output_dir / "error.png"
            page.screenshot(path=str(error_path))
            print(f"Error screenshot saved to {error_path}")
            raise
        finally:
            browser.close()

if __name__ == "__main__":
    verify_shortcuts()
