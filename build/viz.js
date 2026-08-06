/* WeBuild — lightweight pseudo-3D canvas visuals for the /build/ pages.
   No dependencies. Pauses off-screen / when tab hidden. Honours reduced-motion.
   Two modes via data-viz: "orchestration" (agents handing off work) and
   "brain" (knowledge linked to a central brain). ~one rAF, <15 nodes each. */
(function () {
  "use strict";
  var LIME = "#c8e636", SNOW = "#ffffff", ASH = "#a1a1aa";
  var reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  function sphere(n, r) {
    // even-ish points on a sphere (golden spiral)
    var pts = [], off = 2 / n, inc = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = i * off - 1 + off / 2, rr = Math.sqrt(1 - y * y), phi = i * inc;
      pts.push({ x: Math.cos(phi) * rr * r, y: y * r, z: Math.sin(phi) * rr * r });
    }
    return pts;
  }

  function buildScene(mode) {
    var nodes = [], edges = [], pulses = [], i;
    if (mode === "brain") {
      nodes.push({ x: 0, y: 0, z: 0, label: "Brain", core: true, r: 7 });
      var labels = ["Docs", "Quotes", "Policies", "History", "Threads", "Wiki", "Emails", "Records"];
      var sh = sphere(labels.length, 105);
      for (i = 0; i < labels.length; i++) {
        nodes.push({ x: sh[i].x, y: sh[i].y, z: sh[i].z, label: labels[i], r: 4 });
        edges.push([0, i + 1, true]);              // hub link
        edges.push([i + 1, (i % labels.length) + 1, false]); // neighbour weave
      }
      // retrieve (outer->core) and librarian links (core->outer)
      for (i = 0; i < labels.length; i++) pulses.push({ e: i * 2, t: Math.random(), s: 0.28 + Math.random() * 0.18, dir: i % 2 ? 1 : -1 });
    } else {
      // orchestration: ring of agents + central hub, work moves around + through
      var ring = ["Intake", "Research", "CRM", "Draft", "Book", "Notify"];
      nodes.push({ x: 0, y: 0, z: 0, label: "Orchestrator", core: true, r: 6 });
      for (i = 0; i < ring.length; i++) {
        var a = (i / ring.length) * Math.PI * 2;
        nodes.push({ x: Math.cos(a) * 120, y: Math.sin(a) * 42, z: Math.sin(a) * 120, label: ring[i], r: 4.5 });
      }
      for (i = 0; i < ring.length; i++) {
        edges.push([i + 1, (i % ring.length) + 1 === ring.length ? 1 : i + 2, false]); // sequential hand-off
        edges.push([0, i + 1, true]);                                                   // hub link
      }
      // one packet travelling the whole workflow, plus a couple more offset
      for (i = 0; i < 3; i++) pulses.push({ e: i * 2, t: i / 3, s: 0.5, dir: 1, chain: true, step: i * 2 });
      pulses.push({ e: 1, t: 0.2, s: 0.4, dir: -1 });
    }
    return { nodes: nodes, edges: edges, pulses: pulses, mode: mode };
  }

  function project(p, cx, cy, rot, scale) {
    var cy_ = Math.cos(rot), sy = Math.sin(rot);
    var x = p.x * cy_ - p.z * sy, z = p.x * sy + p.z * cy_, y = p.y;
    var tilt = 0.32, ct = Math.cos(tilt), st = Math.sin(tilt);
    var y2 = y * ct - z * st, z2 = y * st + z * ct;
    var persp = 260 / (260 + z2);
    return { x: cx + x * scale * persp, y: cy + y2 * scale * persp, depth: z2, persp: persp };
  }

  function init(canvas) {
    var ctx = canvas.getContext("2d");
    var scene = buildScene(canvas.getAttribute("data-viz"));
    var W = 0, H = 0, rot = 0.5, running = false, raf = 0, last = 0;

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      W = w; H = h;
      canvas.width = Math.round(w * DPR);
      canvas.height = Math.round(h * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2, scale = Math.min(W, H) / 300;
      var P = scene.nodes.map(function (n) { return project(n, cx, cy, rot, scale); });

      // edges
      for (var i = 0; i < scene.edges.length; i++) {
        var e = scene.edges[i], a = P[e[0]], b = P[e[1]];
        var al = 0.06 + 0.16 * Math.min(a.persp, b.persp);
        ctx.strokeStyle = (e[2] ? "200,230,54," : "161,161,170,") + al;
        ctx.lineWidth = e[2] ? 1.1 : 0.8;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // pulses (draw before nodes so nodes sit on top)
      for (i = 0; i < scene.pulses.length; i++) {
        var pu = scene.pulses[i], ed = scene.edges[pu.e];
        if (!ed) continue;
        var pa = P[ed[0]], pb = P[ed[1]], t = pu.dir > 0 ? pu.t : 1 - pu.t;
        var px = pa.x + (pb.x - pa.x) * t, py = pa.y + (pb.y - pa.y) * t;
        var pr = 2.6 * ((pa.persp + pb.persp) / 2);
        ctx.beginPath(); ctx.arc(px, py, pr, 0, 6.2832);
        ctx.fillStyle = LIME; ctx.shadowColor = LIME; ctx.shadowBlur = 12;
        ctx.fill(); ctx.shadowBlur = 0;
      }

      // nodes (painter's order by depth)
      var order = P.map(function (p, idx) { return idx; }).sort(function (m, n) { return P[m].depth - P[n].depth; });
      for (var k = 0; k < order.length; k++) {
        var idx = order[k], n = scene.nodes[idx], p = P[idx];
        var r = n.r * p.persp * scale;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832);
        if (n.core) { ctx.fillStyle = LIME; ctx.shadowColor = LIME; ctx.shadowBlur = 18; }
        else { ctx.fillStyle = SNOW; ctx.globalAlpha = 0.35 + 0.55 * p.persp; ctx.shadowBlur = 0; }
        ctx.fill(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
        // ring on core
        if (n.core) { ctx.strokeStyle = "rgba(200,230,54,0.35)"; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, 6.2832); ctx.stroke(); }
        // label for front-facing nodes
        if (p.persp > 0.92) {
          ctx.globalAlpha = Math.min(1, (p.persp - 0.92) * 12);
          ctx.fillStyle = n.core ? SNOW : ASH;
          ctx.font = (n.core ? "600 " : "500 ") + Math.round(11 * Math.min(scale, 1.4)) + "px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(n.label, p.x, p.y - r - 7);
          ctx.globalAlpha = 1;
        }
      }
    }

    function step(now) {
      if (!running) return;
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016; last = now;
      rot += dt * 0.22;
      for (var i = 0; i < scene.pulses.length; i++) {
        var pu = scene.pulses[i];
        pu.t += dt * pu.s;
        if (pu.t >= 1) {
          pu.t = 0;
          if (pu.chain) { pu.step = (pu.step + 2) % scene.edges.length; pu.e = pu.step; } // advance through workflow
        }
      }
      draw();
      raf = requestAnimationFrame(step);
    }

    function start() { if (running || reduce) return; running = true; last = 0; raf = requestAnimationFrame(step); }
    function stop() { running = false; if (raf) cancelAnimationFrame(raf); }

    resize();
    addEventListener("resize", function () { resize(); if (reduce || !running) draw(); }, { passive: true });
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else start(); });

    if (reduce) { draw(); return; }
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (en) { en.isIntersecting ? start() : stop(); });
      }, { threshold: 0.05 }).observe(canvas);
    } else { start(); }
    draw();
  }

  function boot() {
    var list = document.querySelectorAll("canvas[data-viz]");
    for (var i = 0; i < list.length; i++) init(list[i]);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
