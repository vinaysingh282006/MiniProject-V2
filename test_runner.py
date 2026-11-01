import os
import sys
from playwright.sync_api import sync_playwright

os.makedirs('screenshots', exist_ok=True)

pages = [
    'index.html',
    'practical.html',
    'ml.html',
    'simulation.html',
    'tech.html',
    'working.html',
    'upgrades.html',
    'roadmap.html',
    'thanks.html'
]

viewports = [
    ('desktop', 1440, 900),
    ('tablet', 768, 1024),
    ('mobile', 390, 844)
]

base_dir = os.path.abspath('.').replace('\\', '/')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    all_clean = True

    for page_name in pages:
        file_url = f'file:///{base_dir}/{page_name}'
        base_slug = page_name.replace('.html', '')
        print(f'\n--- Testing {page_name} ---')

        for vp_name, vp_w, vp_h in viewports:
            console_errors = []
            page = browser.new_page(viewport={'width': vp_w, 'height': vp_h})
            page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
            page.on('pageerror', lambda err: console_errors.append(str(err)))

            page.goto(file_url, wait_until='load')
            page.wait_for_timeout(400)

            # Check horizontal overflow
            scroll_w = page.evaluate('() => document.documentElement.scrollWidth')
            client_w = page.evaluate('() => document.documentElement.clientWidth')
            has_overflow = scroll_w > client_w

            if console_errors:
                print(f'  [{vp_name} {vp_w}px] Console errors: {console_errors}')
                all_clean = False
            if has_overflow:
                print(f'  [{vp_name} {vp_w}px] Overflow! scrollWidth: {scroll_w}, clientWidth: {client_w}')
                all_clean = False

            # Capture screenshots for all viewports
            shot_path = f'screenshots/{base_slug}_{vp_name}.png'
            page.screenshot(path=shot_path, full_page=False)

            page.close()

        print(f'  Validated 1440px, 768px, 390px for {page_name}')

    browser.close()
    if all_clean:
        print('\nVERIFICATION SUCCESS: All 9 pages passed with 0 console errors and 0 horizontal overflow!')
    else:
        print('\nIssues were found that need addressing.')

