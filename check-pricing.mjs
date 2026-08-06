// Browser checks for the pricing page. Deliberately NOT part of `npm test`: it needs a
// browser, and the repo has no browser-test dependency. Run it by hand after touching
// pricing copy or layout, especially when the GST / install-fee tokens get their final
// values — it is what catches a board decision being restated as settled copy.
//
//   npm i --no-save playwright && npx playwright install chromium
//   python3 -m http.server 8099 &
//   node check-pricing.mjs
import { chromium } from 'playwright';
import assert from 'node:assert';

const URL = 'http://localhost:8099/pricing/';
const WIDTHS = [1440, 1280, 1024, 1000, 900, 820, 768, 700, 500, 400, 390];

const errors = [];
const browser = await chromium.launch();

for (const w of WIDTHS) {
  const page = await browser.newPage({ viewport: { width: w, height: 1000 } });
  page.on('pageerror', e => errors.push(`${w}px: ${e.message}`));
  await page.goto(URL, { waitUntil: 'networkidle' });

  // 1. Board decisions must not read as settled copy.
  const body = await page.textContent('body');
  assert.ok(!/GST[- ]inclusive/i.test(body), `${w}: page still asserts GST-inclusive`);
  assert.ok(!/WEB-\d+/.test(body), `${w}: page leaks an internal tracker id`);
  assert.ok(/GST treatment is being confirmed/.test(body), `${w}: neutral GST basis missing`);
  assert.ok(/A\$750 install \(provisional\)/.test(body), `${w}: install fee not marked provisional on the card`);

  // 2. Card order is the who-runs-it axis (spec section 3) — never reordered.
  const order = await page.$$eval('.pricing-plan-card h3', els => els.map(e => e.textContent.trim()));
  assert.deepStrictEqual(order, ['Starter', 'Takeoff', 'Operate', 'Scale'], `${w}: card order changed`);

  // 3. Column seam survives every width (spec section 8): two band headers, always full-width.
  const bands = await page.$$eval('.pricing-band h2', els => els.map(e => e.textContent.trim()));
  assert.deepStrictEqual(bands, ['YOU RUN IT', 'WE RUN IT'], `${w}: column band headers missing`);

  // 4. Nothing may spill horizontally. Nav excluded: it overflows at exactly 768px on
  //    every page of the site including untouched ones — pre-existing, flagged separately.
  const spill = await page.evaluate(() => [...document.querySelectorAll('*')]
    .filter(e => e.getBoundingClientRect().right > window.innerWidth + 1 && !e.closest('nav'))
    .map(e => `${e.tagName}.${String(e.className).slice(0, 40)}`));
  assert.deepStrictEqual(spill, [], `${w}: content overflows horizontally: ${spill.join(', ')}`);

  // 5. Exclusions block is equal weight, not fine print (spec section 5).
  const weight = await page.evaluate(() => {
    const cols = document.querySelectorAll('.starter-boundary-columns li');
    const styles = [...cols].map(li => getComputedStyle(li));
    return styles.map(s => `${s.fontSize}|${s.lineHeight}|${s.color}`);
  });
  assert.strictEqual(new Set(weight).size, 1, `${w}: exclusions render at a different weight than inclusions`);

  // 6. Touch targets on the page's own controls (spec section 9). Shared site chrome
  //    (skip link, nav, footer) is out of scope here and flagged separately.
  const small = await page.$$eval(
    '#pricingMount a, #starterBoundaries a, #catalogueSpotlight a, #finalCtaLink',
    els => els.filter(e => e.offsetParent !== null)
      .map(e => e.getBoundingClientRect())
      .filter(r => r.height < 44 || r.width < 44).length);
  assert.strictEqual(small, 0, `${w}: ${small} pricing controls under 44x44`);

  await page.close();
}

await browser.close();
assert.deepStrictEqual(errors, [], `JS errors: ${errors.join('; ')}`);
console.log(`ok - copy, card order, column seam, overflow, exclusions weight, touch targets @ ${WIDTHS.join('/')}`);
