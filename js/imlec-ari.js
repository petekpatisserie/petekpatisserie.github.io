/* imlec-ari.js — küçük arı: bilgisayarda fare imlecini, telefonda parmağı izler (sürükleyince yumuşakça; tek dokunuşta yay çizerek uçar).
   KAFE.imlecAri === false ise kapalı. Açılış animasyonu bitince belirir; vitrindeki duran arı gizlenir. Dinleyiciler passive, preventDefault yok. */
(function (w, d) {
	'use strict';
	var azalt = w.matchMedia('(prefers-reduced-motion: reduce)').matches || /[?&]hareket=0/.test(w.location.search);
	var el = null, calis = false, t0 = 0, fare = w.matchMedia && w.matchMedia('(hover: hover) and (pointer: fine)').matches;
	var x = 0, y = 0, tx = 0, ty = 0, vx = 0, vy = 0, yon = 1, egim = 0, goster = false, ilk = true;
	var ic = false, bas = null, hareketli = false, fl = null, dokunuldu = false;
	function acilisBitti() {
		var s = d.getElementById('sahne');
		return !!s && !/\b(yukleniyor|acilis-a|acilis-g|acilis-u)\b/.test(s.className);
	}
	function ev() { return { x: Math.max(30, w.innerWidth - 46), y: Math.max(30, w.innerHeight - 58) }; }
	function kur() {
		var st = d.createElement('style');
		st.textContent = '.imlec-ari{position:fixed;left:0;top:0;width:30px;height:23px;margin:0;z-index:2147483000;pointer-events:none;opacity:0;transition:opacity .35s ease;will-change:transform}' +
			'.imlec-ari.acik{opacity:1}.imlec-ari-var .ari{visibility:hidden}';
		d.head.appendChild(st);
		el = d.createElement('img');
		el.className = 'imlec-ari'; el.alt = ''; el.setAttribute('aria-hidden', 'true'); el.width = 30; el.height = 23;
		el.src = 'gorsel/ortak/ari.svg';
		d.body.appendChild(el);
		if (!fare) { var e = ev(); x = tx = e.x; y = ty = e.y; ilk = false; }
	}
	function ucus(ex, ey, t) {
		if (azalt) { x = tx = ex; y = ty = ey; fl = null; return; }
		var dx = ex - x, dy = ey - y, u = Math.sqrt(dx * dx + dy * dy) || 1;
		fl = { sx: x, sy: y, ex: ex, ey: ey, t: t, d: Math.max(500, Math.min(700, 420 + u * 0.4)), nx: -dy / u, ny: dx / u, b: Math.min(70, u * 0.25) * (dx < 0 ? -1 : 1) };
		tx = ex; ty = ey;
	}
	function dongu(t) {
		var hz = (t - t0) / 1000, ax = x, ay = y;
		var gorun = acilisBitti() && (fare ? ic : true) && !(w.KAFE && w.KAFE.imlecAri === false);
		if (gorun && !goster) { goster = true; el.classList.add('acik'); d.documentElement.classList.add('imlec-ari-var'); }
		else if (!gorun && goster) { goster = false; el.classList.remove('acik'); }
		if (fl) {
			var p = Math.min(1, (t - fl.t) / fl.d), e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, k = Math.sin(Math.PI * p) * fl.b;
			x = fl.sx + (fl.ex - fl.sx) * e + fl.nx * k; y = fl.sy + (fl.ey - fl.sy) * e + fl.ny * k;
			if (p >= 1) fl = null;
		} else {
			if (ilk && tx > 0) { x = tx; y = ty; ilk = false; }
			x += (tx - x) * 0.12; y += (ty - y) * 0.12;
		}
		var mx = x - ax, my = y - ay;
		vx += (mx - vx) * 0.15;
		var sy = 0;
		if (!azalt) {
			var hedef = Math.max(-20, Math.min(20, vx * 3 + (my > 1 ? 0 : 0)));
			egim += (hedef - egim) * 0.2;
			var yakin = Math.abs(tx - x) + Math.abs(ty - y) < 6 && !fl;
			sy = Math.sin(hz * 3.2) * (yakin ? 3 : 1);
		} else egim = 0;
		if (Math.abs(mx) > 0.4) yon = mx < 0 ? -1 : 1;
		el.style.transform = 'translate3d(' + (x - 15).toFixed(1) + 'px,' + (y - 11 + sy).toFixed(1) + 'px,0) rotate(' + egim.toFixed(1) + 'deg) scaleX(' + yon + ')';
		w.requestAnimationFrame(dongu);
	}
	function ac() {
		if (calis) return;
		if (w.KAFE && w.KAFE.imlecAri === false) return;
		calis = true; kur(); t0 = w.performance.now();
		w.requestAnimationFrame(dongu);
	}
	function hedefYap(e) { tx = e.clientX + (fare ? 16 : 14); ty = e.clientY + 14; }
	d.addEventListener('pointermove', function (e) {
		if (e.pointerType === 'mouse') {
			fare = true; ic = true; ac(); fl = null; hedefYap(e);
		} else if (bas) {
			var dx = e.clientX - bas.x, dy = e.clientY - bas.y;
			if (hareketli || dx * dx + dy * dy > 100) { hareketli = true; fl = null; hedefYap(e); }
		}
	}, { passive: true });
	d.addEventListener('pointerdown', function (e) {
		if (e.pointerType === 'mouse') return;
		fare = false; ac(); bas = { x: e.clientX, y: e.clientY }; hareketli = false; dokunuldu = true;
	}, { passive: true });
	function bitti(e) {
		if (e.pointerType === 'mouse' || !bas) return;
		if (!hareketli && e.type === 'pointerup') ucus(e.clientX + 14, e.clientY + 14, w.performance.now());
		bas = null; hareketli = false;
	}
	d.addEventListener('pointerup', bitti, { passive: true });
	d.addEventListener('pointercancel', bitti, { passive: true });
	d.documentElement.addEventListener('mouseleave', function () { if (fare) ic = false; });
	d.documentElement.addEventListener('mouseenter', function () { if (fare) ic = true; });
	w.addEventListener('resize', function () { if (!fare && calis && !dokunuldu) { var e = ev(); tx = e.x; ty = e.y; } });
	if (!fare) { w.addEventListener('load', ac); d.addEventListener('DOMContentLoaded', ac); if (d.readyState !== 'loading') ac(); }
})(window, document);
