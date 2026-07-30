// Emits the static dot-field SVG for email-banner.html.
//   node email-banner-field.mjs
// Paste stdout into email-banner.html between the field:start / field:end markers.
// Output is static on purpose: the banner ships with zero runtime JS.
const ROWS = 17, COLS = 42;
const W = 620, H = 460;

const lerp = (a, b, t) => a + (b - a) * t;
const hex = ([r, g, b]) =>
  '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const mix = (c1, c2, t) => c1.map((v, i) => lerp(v, c2[i], t));

const BACK = [233, 245, 184];   // pale lime, far / lit
const FRONT = [122, 150, 16];   // deep olive, near / shaded
const CREST = [200, 230, 54];   // --color-lime, wave tops

const cols = [];
for (let c = 0; c < COLS; c++) {
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    const t = r / (ROWS - 1);                    // 0 = back, 1 = front
    const persp = Math.pow(t, 1.45);             // rows bunch toward the horizon
    const colGap = lerp(15, 20, t);
    const rowY = lerp(28, 472, persp);           // bleeds past the bottom edge
    const x = W / 2 + (c - (COLS - 1) / 2) * colGap + lerp(30, -25, t);
    const wave = Math.sin(c * 0.40 + r * 0.30);
    const y = rowY + wave * lerp(3, 11, t);
    if (x < -20 || x > W + 20) continue;

    const crest = (wave + 1) / 2;                // 1 at wave top
    const col = mix(mix(BACK, FRONT, t), CREST, crest * 0.42);
    const rad = lerp(1.5, 4.6, t) * lerp(0.85, 1.1, crest);
    const op = (lerp(0.5, 1, persp) * lerp(0.76, 1, crest)).toFixed(3);
    dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(2)}" fill="${hex(col)}" opacity="${op}"/>`);
  }
  if (dots.length) cols.push(`<g class="col" style="--i:${c}">${dots.join('')}</g>`);
}

console.log(cols.join('\n        '));
console.error(`cols=${cols.length} dots=${cols.reduce((n, s) => n + (s.match(/<circle/g) || []).length, 0)}`);
