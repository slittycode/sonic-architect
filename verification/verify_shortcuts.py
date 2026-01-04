
from playwright.sync_api import sync_playwright, expect

def verify_shortcuts():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Go to app
            page.goto("http://localhost:3000")

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
            page.screenshot(path="verification/verification.png")
            print("Verification successful")

        except Exception as e:
            print(f"Verification failed: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_shortcuts()
