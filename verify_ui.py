from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8000")

        # Wait for content to load and animations
        page.wait_for_selector(".hero")
        time.sleep(1) # Allow initial animations

        # Screenshot Hero
        page.screenshot(path="verification_hero.png", full_page=False)

        # Scroll to Steps
        page.evaluate("document.getElementById('steps-flow').scrollIntoView()")
        time.sleep(1)
        page.screenshot(path="verification_steps.png")

        # Scroll to App Section
        page.evaluate("document.getElementById('app-section').scrollIntoView()")
        time.sleep(1)
        page.screenshot(path="verification_app.png")

        browser.close()

if __name__ == "__main__":
    run()
