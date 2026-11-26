/* yukle.js — kafe veri dosyasını yükler: ?veri=ad, yoksa script etiketindeki data-veri; bulunamazsa veri/_deneme.js.
	 Veri gelince Menu.baslat() çağrılır. */
(function (d) {
	'use strict';
	var q = /[?&]veri=([\w-]+)/.exec(location.search), bu = d.currentScript, ad = q ? q[1] : (bu && bu.getAttribute('data-veri')) || 'menu';
	function yukle(src, ok, hata) {
		var s = d.createElement('script');
		s.src = src; s.onload = ok; s.onerror = hata;
		d.body.appendChild(s);
	}
	/* Menu.baslat() ne olursa olsun TAM BİR KEZ çağrılır (bayrak dosya düzeyinde: yedek veri zincirinde de tek kez) */
	var basladi = false;
	function bas() {
		if (!window.KAFE) return yedek();
		var K = window.KAFE;
		var yedekZamanlayici = null;
		function baslat() {
			if (basladi) return;
			basladi = true;
			if (yedekZamanlayici) clearTimeout(yedekZamanlayici);
			if (window.Menu) window.Menu.baslat();
		}
		var t = K.tablo;
		if (window.Tablo && t && typeof t.url === 'string' && t.url.replace(/\s+/g, '') !== '') {
			try {
				var ms = Number(t.zamanAsimi);
				if (!(ms > 0)) ms = 4000;
				yedekZamanlayici = setTimeout(baslat, ms + 1500); /* emniyet kemeri: Tablo takılırsa menü yine açılır */
				window.Tablo.uygula(K).then(baslat, baslat);
			} catch (e) {
				baslat();
			}
		} else {
			baslat();
		}
	}
	function yedek() {
		if (ad === '_deneme') { d.getElementById('sahne').classList.add('veri-yok'); return; }
		ad = '_deneme';
		yukle('veri/_deneme.js', bas, yedek);
	}
	yukle('veri/' + ad + '.js', bas, yedek);
})(document);
