"""Real same-origin Chromium pages; synthetic local data only, no production calls."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
url = f'http://127.0.0.1:{server.server_port}'

# Delay delivery of storage notifications, not application reads/writes or lock semantics.
INIT = """() => {
 localStorage.setItem('dailyDietSeed20260212To20260508', 'done');
 const add = window.addEventListener.bind(window);
 window.delayedStorageEvents = [];
 window.addEventListener = (name, fn, options) => {
   if (name !== 'storage') return add(name, fn, options);
   return add(name, e => window.holdStorageEvents ? window.delayedStorageEvents.push(e) : fn(e), options);
 };
}"""

def dates(page):
    return page.evaluate("JSON.parse(localStorage.getItem('dailyDietRecordsV1')).map(r => r.date)")

def save(page, date):
    page.locator('#dateInput').fill(date)
    page.locator('#intakeInput').fill('100')
    page.locator('#recordForm button[type=submit]').click()
    page.wait_for_function('(date) => JSON.parse(localStorage.getItem("dailyDietRecordsV1")).some(r => r.date === date)', arg=date)

with sync_playwright() as p:
    browser = p.chromium.launch()
    for entry in ['NutriFlow.html', 'index.html']:
        for width, height in [(1280, 900), (390, 844)]:
            context = browser.new_context(viewport={'width': width, 'height': height}, service_workers='block')
            context.add_init_script('('+INIT+')()')
            a, b = context.new_page(), context.new_page()
            errors = []
            for page in [a,b]:
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(f'{url}/{entry}')
            a.evaluate("localStorage.setItem('dailyDietRecordsV1', '[]')")
            a.reload(); b.reload()
            a.locator('details.data-panel > summary').click()
            b.evaluate("""() => { window.held = false; navigator.locks.request('nutriflow-data-v1-write', () => { window.held = true; return new Promise(resolve => window.releaseWrite = resolve); }); }""")
            b.wait_for_function('window.held')
            a.locator('#importText').fill('2026-09-01,100')
            a.locator('#importBtn').click()
            a.locator('#confirmImportBtn').click()
            a.locator('#importText').fill('2026-09-02,200')
            a.locator('#importBtn').click()
            assert a.locator('#confirmImportBtn').is_disabled()
            b.evaluate('window.releaseWrite()')
            a.wait_for_function('!document.querySelector("#confirmImportBtn").disabled')
            assert dates(a) == ['2026-09-01'], dates(a)
            assert '2026-09-02' in a.locator('#importPreview').inner_text()
            a.locator('#confirmImportBtn').click()
            a.wait_for_function('JSON.parse(localStorage.getItem("dailyDietRecordsV1")).length === 2')
            assert dates(a) == ['2026-09-01','2026-09-02']

            # Both pages load damaged data. B repairs; A consumes that real event.
            a.evaluate("localStorage.setItem('dailyDietRecordsV1', 'broken json')")
            a.reload(); b.reload()
            save(b, '2026-09-01')
            a.wait_for_function("recordsByDate.has('2026-09-01')")
            a.evaluate('window.holdStorageEvents = true')
            save(b, '2026-09-02')
            a.wait_for_function('window.delayedStorageEvents.length > 0')
            save(a, '2026-09-03')
            assert dates(a) == ['2026-09-01','2026-09-02','2026-09-03'], dates(a)
            assert a.evaluate("localStorage.getItem('dailyDietRecordsV1CorruptBackupV1')") == 'broken json'
            assert a.title() and a.locator('#recordForm').is_visible()
            assert not errors, errors
            print(f'PASS {entry} {width}x{height}: real import controls + two-page canonical recovery; no page errors', flush=True)
            context.close()
    browser.close()
server.shutdown()
