/* WeBuild — animated "Command Center" sample dashboard. No dependencies.
   Illustrative numbers only (no real client data). Honours reduced-motion,
   pauses off-screen and when the tab is hidden. ~one setInterval. */
(function () {
  "use strict";
  var mc = document.getElementById("mc");
  if (!mc) return;
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  var fmt = {
    money: function (v) { return "$" + Math.round(v / 1000) + "k"; },
    int: function (v) { return "" + Math.round(v); },
    pct: function (v) { return Math.round(v) + "%"; }
  };

  var tiles = [].slice.call(mc.querySelectorAll("[data-mc='val']"));
  tiles.forEach(function (t) { t.setAttribute("data-cur", t.getAttribute("data-base")); });

  // sparkline
  var poly = mc.querySelector("[data-mc='sparkline']");
  var N = 24, data = [];
  var seed = 40;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (var i = 0; i < N; i++) data.push(12 + rnd() * 16);
  function renderSpark() {
    var pts = [];
    for (var i = 0; i < N; i++) pts.push(((i / (N - 1)) * 100).toFixed(1) + "," + (34 - data[i]).toFixed(1));
    poly.setAttribute("points", pts.join(" "));
  }
  renderSpark();

  // feed
  var feedEl = mc.querySelector("[data-mc='feed']");
  var EVENTS = [
    { t: "Enquiry answered after hours", k: "ok" },
    { t: "Lead qualified · intro call booked", k: "ok" },
    { t: "CRM updated · 3 records", k: "ok" },
    { t: "Invoice drafted · awaiting your approval", k: "wait" },
    { t: "Approval granted · invoice sent", k: "lime" },
    { t: "Follow-up scheduled · 2 clients", k: "ok" },
    { t: "Weekly report compiled", k: "ok" },
    { t: "Quote sent · pipeline updated", k: "ok" }
  ];
  var feed = [
    { t: "Approval granted · invoice sent", k: "lime", age: 1 },
    { t: "Invoice drafted · awaiting your approval", k: "wait", age: 2 },
    { t: "Lead qualified · intro call booked", k: "ok", age: 4 }
  ];
  var ei = 5;
  var DOT = { ok: "bg-ash", wait: "bg-ember", lime: "bg-lime" };
  function renderFeed() {
    var html = "";
    for (var i = 0; i < feed.length; i++) {
      var f = feed[i];
      var label = f.age <= 1 ? "now" : f.age + "m";
      html += '<div class="flex items-center gap-8 py-6' + (i ? ' border-t border-white/5' : '') + '">' +
        '<span class="w-6 h-6 rounded-full ' + (DOT[f.k] || "bg-ash") + ' shrink-0"></span>' +
        '<span class="text-body ' + (f.k === "wait" ? "text-snow" : "text-ash") + ' flex-1 truncate">' + f.t + '</span>' +
        '<span class="text-[11px] text-slate shrink-0">' + label + '</span></div>';
    }
    feedEl.innerHTML = html;
  }
  renderFeed();

  var running = false, timer = 0, beat = 0;
  function tick() {
    beat++;
    tiles.forEach(function (t) {
      var base = parseFloat(t.getAttribute("data-base"));
      var cur = parseFloat(t.getAttribute("data-cur"));
      cur = cur + (rnd() - 0.42) * base * 0.012;
      cur = Math.max(base * 0.92, Math.min(base * 1.1, cur));
      t.setAttribute("data-cur", cur);
      t.textContent = (fmt[t.getAttribute("data-kind")] || fmt.int)(cur);
    });
    data.shift();
    data.push(Math.max(6, Math.min(30, data[data.length - 1] + (rnd() - 0.5) * 7)));
    renderSpark();
    // new feed event every 2nd beat
    if (beat % 2 === 0) {
      for (var i = 0; i < feed.length; i++) feed[i].age += (i === 0 ? 1 : 1);
      var ev = EVENTS[ei % EVENTS.length]; ei++;
      feed.unshift({ t: ev.t, k: ev.k, age: 0 });
      if (feed.length > 4) feed.pop();
      renderFeed();
    }
  }

  function start() { if (running || reduce) return; running = true; timer = setInterval(tick, 1400); }
  function stop() { running = false; if (timer) { clearInterval(timer); timer = 0; } }

  if (reduce) return;
  document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.isIntersecting ? start() : stop(); });
    }, { threshold: 0.15 }).observe(mc);
  } else { start(); }
})();
