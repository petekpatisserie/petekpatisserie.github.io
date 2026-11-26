/* app.js — "Canlı Vitrin" menüsü: mozaik açılış, bal peteği vitrin, göze→bölüm geçişi, döner vitrin, fotoğraf şovu,
   özel pasta galerisi, pastanı kendin yap, tüm menü (sade liste). Kafeye özgü hiçbir şey yok: her şey window.KAFE verisinden gelir. */
(function (w, d) {
	'use strict';
	var K, E = 'cubic-bezier(.2,.75,.25,1)';
	var dusuk = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory || 4) <= 2;
	var azalt = (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) || /[?&]hareket=0/.test(w.location.search);
	var kilit = false, bekleyen = false, hizli = false, yut = false, tarih = true;
	var yigin = [];
	var sahne, vitrinEl, perde, bolumEl, yapEl, yildizEl, panelEl, sadeEl, sadeBtn, ari, ariYer = null, ariGoze = null, ariYon = 1;
	var ARI = 'gorsel/ortak/ari.svg', ARI_U = 'gorsel/ortak/ari-ucan.svg';
	var GERI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	var ILERI = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
	var KAPAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
	var HEX = '<polygon vector-effect="non-scaling-stroke" points="50,.8 99.2,29.1 99.2,86.4 50,114.7 .8,86.4 .8,29.1"/>';
	var KENAR = '<svg class="goze-kenar" viewBox="0 0 100 115.47" preserveAspectRatio="none" aria-hidden="true">' + HEX + '</svg>';
	var HALKA = '<svg class="goze-halka" viewBox="0 0 100 115.47" preserveAspectRatio="none" aria-hidden="true">' + HEX + '</svg>';

	function $(s, k) { return (k || d).querySelector(s); }
	function $$(s, k) { return [].slice.call((k || d).querySelectorAll(s)); }
	function kac(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
	function harf(s) { return (String(s || '?').trim().charAt(0) || '?').toLocaleUpperCase('tr-TR'); }
	function kucuk(s) { return String(s || '').toLocaleLowerCase('tr-TR'); }
	function sakla(a, v) { try { if (v === undefined) return sessionStorage.getItem(a); sessionStorage.setItem(a, v); } catch (e) {} return null; }

	/* tek hareket dili: aynı yumuşatma, 250–600 ms. Hareket azaltılmışsa şov kapanmaz: uçuş/büyük ölçek yerine kısa solma + küçük ölçek */
	function yumusat(kf) {
		return kf.map(function (k) {
			var o = {}, a;
			for (a in k) o[a] = k[a];
			if (typeof o.transform === 'string') {
				o.transform = o.transform.replace(/translate[XY3d]*\([^)]*\)|rotate\([^)]*\)|scaleX\([^)]*\)/g, '').replace(/scale\(([^)]*)\)/g, function (m, v) {
					return 'scale(' + v.split(',').map(function (x) { return (1 + (parseFloat(x) - 1) * 0.1).toFixed(3); }).join(',') + ')';
				}).trim() || 'none';
			}
			return o;
		});
	}
	function oyna(el, kf, ms, gec, kal) {
		if (hizli || !el || !el.animate) return Promise.resolve(null);
		if (azalt) { kf = yumusat(kf); ms = Math.max(160, ms * 0.5); gec = (gec || 0) * 0.5; }
		var a = el.animate(kf, { duration: ms, delay: gec || 0, easing: E, fill: kal ? 'both' : 'backwards' });
		return a.finished.then(function () { return a; }, function () { return null; });
	}
	function birak(a) { if (a && a.cancel) a.cancel(); }
	function kilitle() { kilit = true; sahne.classList.add('hareket'); }
	function coz() { kilit = false; sahne.classList.remove('hareket'); if (bekleyen) { bekleyen = false; esitle(); } }
	function goster(el) { el.classList.remove('kapali'); el.inert = false; if (el === vitrinEl) sahne.classList.remove('vitrin-kapali'); }
	function gizle(el) { el.classList.add('kapali'); el.inert = true; if (el === vitrinEl) sahne.classList.add('vitrin-kapali'); }
	function odak(el) { if (el) try { el.focus({ preventScroll: true }); } catch (e) {} }
	/* yığın: açık pencereler. "Tüm menü" düğmesi vitrinin içindedir, vitrinle birlikte gizlenir */
	function it(kayit) { yigin.push(kayit); sahne.classList.add('derin'); try { history.pushState({ d: yigin.length }, ''); } catch (e) { tarih = false; } }
	function cek() { var s = yigin.pop(); sahne.classList.toggle('derin', yigin.length > 0); return s; }

	function bolumler() { return (K.bolumler || []).slice().sort(function (a, b) { return (a.sira || 0) - (b.sira || 0); }); }
	function bolumBul(id) { return bolumler().filter(function (b) { return b.id === id; })[0]; }
	function urunBul(id) { return (K.urunler || []).filter(function (u) { return u.id === id; })[0]; }
	function urunleri(id) { return (K.urunler || []).filter(function (u) { return u.bolum === id; }); }

	/* ---------- parçalar ---------- */
	function foto(src, ad, sinif, tembel, kck) {
		var k = kck && /\.webp$/.test(src || '') ? src.replace(/\.webp$/, (typeof kck === 'string' ? kck : '-k') + '.webp') : '';
		if (src) return '<img class="' + sinif + '" src="' + kac(k || src) + '" alt="" decoding="async" draggable="false"' + (tembel ? ' loading="lazy"' : '') + (k ? ' data-buyuk="' + kac(src) + '"' : '') + ' data-yt="' + kac(harf(ad)) + '">';
		return '<span class="' + sinif + ' yt" aria-hidden="true"><span>' + kac(harf(ad)) + '</span></span>';
	}
	function fotolu(u) { return !!(u && u.foto); }
	function yok(u) { return u.fiyat == null || u.fiyat === ''; }
	function tutar(u) { var n = Number(u.fiyat); return (isNaN(n) ? kac(u.fiyat) : n.toLocaleString('tr-TR')) + ' ' + kac(K.paraBirimi || 'TL'); }
	function fiyat(u) {
		var tk = tukRozet(u);
		if (yok(u)) return '<span class="fiyat"><span class="fiyat-yok">Fiyatını sor</span>' + tk + '</span>';
		return '<span class="fiyat"><span class="tutar">' + tutar(u) + '</span>' + (u.birim ? '<span class="birim">' + kac(u.birim) + '</span>' : '') + tk + '</span>';
	}
	/* tükendi (tablo.js yazar) ve günün ürünü: fiyat her zaman görünür, yalnız küçük bir etiket eklenir */
	function tukendi(u) { return !!u && u.tukendi === true; }
	function tukRozet(u) { return tukendi(u) ? '<span class="tukendi-et">Tükendi</span>' : ''; }
	function gunU() { var id = K.gununUrunu, u = id ? urunBul(String(id)) : null; return u && !tukendi(u) ? u : null; }
	function gunEt(u) { return u && u === gunU() ? '<span class="gunun-et">Günün ürünü</span>' : ''; }
	/* besin değerleri (isteğe bağlı urun.besin = { kcal, yag, seker, protein, porsiyon }): yalnız dolu alanlar gösterilir;
	   ondalık Türkçe virgülle (12,5), kcal tam sayı. Hiç sayı yoksa blok çizilmez */
	function sayi(v, tam) {
		if (v == null || v === '') return '';
		var n = Number(String(v).trim().replace(',', '.'));
		if (!isFinite(n) || n < 0) return '';
		return tam ? Math.round(n).toLocaleString('tr-TR') : n.toLocaleString('tr-TR', { maximumFractionDigits: 1 });
	}
	var BESIN_AD = [['yag', 'Yağ'], ['seker', 'Şeker'], ['protein', 'Protein']];
	function besin(u) {
		var b = u && u.besin, o;
		if (!b || typeof b !== 'object') return null;
		o = { kcal: sayi(b.kcal, true), ogeler: [], por: String(b.porsiyon == null ? '' : b.porsiyon).trim() };
		BESIN_AD.forEach(function (a) { var v = sayi(b[a[0]]); if (v) o.ogeler.push([a[1], v]); });
		return o.kcal || o.ogeler.length ? o : null;
	}
	function besinliVar(L) { return (L || []).some(function (u) { return !!besin(u); }); }
	function besinNot() { var s = K.besinNot == null ? '' : String(K.besinNot).trim(); return s || 'Besin değerleri yaklaşık değerlerdir.'; }
	function kcalYazi(u, sinif, gizli) { var b = besin(u); return b && b.kcal ? '<span class="' + sinif + '"' + (gizli ? ' aria-hidden="true"' : '') + '>' + kac(b.kcal) + ' kcal</span>' : ''; }
	/* tek besin bloğu: kalori belirgin, altında yağ/şeker/protein, en altta porsiyon. not=true: yaklaşık bildirimi de bloğun içinde */
	function besinBlok(u, not) {
		var b = besin(u), alt;
		if (!b) return '';
		alt = not ? (b.por ? b.por + ' için. ' : '') + besinNot() : b.por ? b.por + ' için, yaklaşık' : besinNot();
		return '<div class="besin" role="group" aria-label="Besin değerleri">' +
			(b.kcal ? '<p class="b-kcal"><span class="ek-sr">Enerji: </span>' + kac(b.kcal) + ' <span class="b-br">kcal</span></p>' : '') +
			(b.ogeler.length ? '<dl class="b-ogeler">' + b.ogeler.map(function (o) { return '<div class="b-oge"><dt>' + kac(o[0]) + '</dt> <dd>' + kac(o[1]) + ' <span class="b-br">g</span></dd></div>'; }).join('') + '</dl>' : '') +
			'<p class="b-por">' + kac(alt) + '</p></div>';
	}
	function adresUrl(s) { s = String(s || '').trim(); return /^https?:\/\//i.test(s) ? s : ''; }
	/* fiyatlar örnekse tek ince şerit (satırlarda rozet yok) */
	function serit() { return K.fiyatlarOrnek ? '<p class="serit">Fiyatlar örnektir, kafeden teyit edilecek.</p>' : ''; }
	function geriDugme(et, ic) { return '<div class="b-ust"><button class="geri" type="button" data-is="geri" aria-label="' + (et || 'Vitrine dön') + '">' + GERI + '</button>' + (ic || '') + '</div>'; }

	/* ---------- mesaj (WhatsApp ya da kopyala) ---------- */
	function tel() { return String((K.kimlik || {}).whatsapp || '').replace(/\D/g, ''); }
	function mesajDugme(yazi, urun) {
		var ek = urun ? ' data-urun="' + kac(urun) + '"' : '';
		return tel() ? '<a class="istek" href="https://wa.me/' + tel() + '" rel="noopener" data-is="iste"' + ek + '>' + kac(yazi) + '</a>' : '<button class="istek" type="button" data-is="iste"' + ek + '>Mesajı kopyala</button>';
	}
	function dilekMesaj() { return (K.kimlik || {}).dilekMesaj || 'Merhaba, menünüzden yazıyorum. Dilek / öneri / isteğim: '; }
	/* dilek, öneri, istek: mesajDugme ile aynı mantık (numara varsa WhatsApp, yoksa kopyala); ikincil (çerçeveli) düğme, konuşma simgeli */
	var DILSIM = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 4h11A1.5 1.5 0 0 1 17 5.5v7a1.5 1.5 0 0 1-1.5 1.5H9l-3.6 2.8V14h-.9A1.5 1.5 0 0 1 3 12.5v-7A1.5 1.5 0 0 1 4.5 4z"/><path d="M6.5 8h7M6.5 10.8h4.5"/></svg>';
	function dilekDugme(sinif, yazi) {
		var ek = ' class="' + sinif + '" data-is="dilek" data-yazi="' + kac(yazi) + '"', ic = DILSIM + '<span class="dy">' + kac(yazi) + '</span>';
		return tel() ? '<a' + ek + ' href="https://wa.me/' + tel() + '" rel="noopener">' + ic + '</a>' : '<button' + ek + ' type="button">' + ic + '</button>';
	}
	function urunMesaj(id) { var u = urunBul(id); return 'Merhaba, menünüzde ' + (u ? u.ad : '') + ' gördüm, bilgi alabilir miyim?'; }
	function mesajGonder(t, e, m) {
		if (tel()) { t.setAttribute('href', 'https://wa.me/' + tel() + '?text=' + encodeURIComponent(m)); return; }
		e.preventDefault();
		var ilk = t.getAttribute('data-yazi') || 'Mesajı kopyala';
		var y = t.querySelector('.dy') || t;
		var yaz = function () { y.textContent = 'Mesaj kopyalandı'; setTimeout(function () { y.textContent = ilk; }, 2500); };
		var eski = function () {
			var a = d.createElement('textarea'); a.value = m; a.setAttribute('readonly', ''); a.style.cssText = 'position:fixed;opacity:0';
			d.body.appendChild(a); a.select();
			try { d.execCommand('copy'); yaz(); } catch (x) {}
			a.remove();
		};
		if (navigator.clipboard && w.isSecureContext) navigator.clipboard.writeText(m).then(yaz, eski); else eski();
	}

	/* ---------- kurulum ---------- */
	function tema() {
		var t = K.tema || {}, r = d.documentElement.style;
		['zemin', 'altin', 'krem', 'vurgu'].forEach(function (a) { if (t[a]) r.setProperty('--' + a, t[a]); });
		var m = $('meta[name="theme-color"]');
		if (m && t.zemin) m.setAttribute('content', t.zemin);
		d.title = ((K.kimlik || {}).ad ? K.kimlik.ad + ' — ' : '') + 'Menü';
		var zf = $('.zk-foto');
		if (t.zeminGorsel) zf.src = t.zeminGorsel; else zf.remove();
		/* altın ışık noktaları: az sayıda, çok yavaş süzülür (düşük güçte ve azaltılmış harekette yok) */
		if (!azalt && !dusuk) {
			var h = '', i, r = 7;
			for (i = 0; i < 8; i++) {
				r = (r * 9301 + 49297) % 233280;
				var a = r / 233280, b = ((r * 7) % 1000) / 1000, c = ((r * 13) % 1000) / 1000;
				h += '<i style="left:' + (8 + a * 84).toFixed(1) + '%;top:' + (6 + b * 88).toFixed(1) + '%;--s:' + Math.round(36 + c * 90) + 'px;--t:' + Math.round(22 + a * 18) + 's;--g:-' + Math.round(b * 20) + 's;--x:' + Math.round((c - 0.5) * 70) + 'px;--y:' + Math.round((a - 0.5) * 90) + 'px"></i>';
			}
			$('.zk-bokeh').innerHTML = h;
		}
	}
	function basHarf() {
		var ad = String((K.kimlik || {}).ad || '');
		return ad.split(/\s+/).filter(function (k) { return /^[\p{L}\d]/u.test(k); }).slice(0, 2).map(harf).join(/\s&\s/.test(ad) ? '&' : '');
	}
	function kimlik() {
		var ki = K.kimlik || {}, bh = basHarf();
		$('#marka').innerHTML = (ki.logo ? '<img class="logo" src="' + kac(ki.logo) + '" alt="">' : bh ? '<span class="logo logo-harf" aria-hidden="true">' + kac(bh) + '</span>' : '') +
			'<span class="marka-yazi"><span class="marka-ad">' + kac(ki.ad || '') + '</span>' + (ki.altAd ? '<span class="marka-alt">' + kac(ki.altAd) + '</span>' : '') + '</span>';
		$('#not').textContent = ki.slogan || '';
		$('#adres').textContent = ki.adres || '';
	}
	function yapici() { return K.pastaYapici ? K.pastaYapici : null; }
	function turler() {
		var py = yapici() || {};
		if (py.turler && py.turler.length) return py.turler;
		return [{ id: 'beyaz', ad: 'Beyaz krema', foto: 'gorsel/ortak/yapici-beyaz.webp' }];
	}

	/* vitrin: elmas bal peteği 1-2-3-2-1. Ortada logo; taçta galeri bölümü, altta pasta yapıcı (varsa) */
	var YER = { tac: [2, 0], sagUst: [3, 1], sag: [4, 2], sagAlt: [3, 3], dip: [2, 4], solAlt: [1, 3], sol: [0, 2], solUst: [1, 1] };
	var SAAT_YONU = ['tac', 'sagUst', 'sag', 'sagAlt', 'dip', 'solAlt', 'sol', 'solUst'];
	function gozeHtml(yer, ic, veri, renk, ad, fotoYol, kisa) {
		var adH = kisa && kisa !== ad ? '<span class="uzun">' + kac(ad) + '</span><span class="kisa" aria-hidden="true">' + kac(kisa) + '</span>' : kac(ad);
		return '<div class="goze-yer" style="--c:' + yer[0] + ';--r:' + yer[1] + '">' + HALKA + '<button class="goze" type="button" ' + ic + ' aria-label="' + kac(ad) + '" data-v="' + kac(veri) + '" style="--b:' + kac(renk || '#3a2a1a') + '">' +
			foto(fotoYol, ad, 'goze-foto', false, '-g') + '<span class="goze-ad">' + adH + '</span>' + KENAR + '</button></div>';
	}
	function vitrinKur() {
		var bs = bolumler(), g = bs.filter(function (b) { return b.tip === 'galeri'; })[0], py = yapici(), ki = K.kimlik || {};
		var duz = bs.filter(function (b) { return b !== g; }), yerler = {}, h = '';
		if (g) yerler.tac = { b: g };
		if (py) yerler.dip = { yap: true };
		['solUst', 'sagUst', 'sol', 'sag', 'solAlt', 'sagAlt', 'tac', 'dip'].forEach(function (y) { if (!yerler[y] && duz.length) yerler[y] = { b: duz.shift() }; });
		SAAT_YONU.forEach(function (y) {
			var x = yerler[y];
			if (!x) return;
			if (x.yap) h += gozeHtml(YER[y], 'data-is="yap"', 'yap', py.renk || (K.tema || {}).altin, py.baslik || 'Pastanı kendin yap', py.foto || turler()[0].foto, py.kisaAd);
			else h += gozeHtml(YER[y], 'data-is="bolum"', x.b.id, x.b.renk, x.b.ad, x.b.foto, x.b.kisaAd);
		});
		var igL = instaAd(ki.instagram);
		h += '<div class="goze-yer goze-yer-logo" style="--c:2;--r:2">' +
			(igL ? '<a class="goze goze-logo" data-is="logo" href="https://www.instagram.com/' + encodeURIComponent(igL) + '/" target="_blank" rel="noopener" aria-label="Instagram\'da ' + kac(ki.ad || '') + '">' : '<div class="goze goze-logo" data-is="logo" role="img" aria-label="' + kac(ki.ad || '') + '">') +
			(ki.logo ? '<img src="' + kac(ki.logo) + '" alt="">' : '<span class="goze-harf" aria-hidden="true">' + kac(basHarf()) + '</span>') + KENAR + (igL ? '</a>' : '</div>') + '</div>';
		if (K.maskot === 'ari') {
			h += '<img class="ari" id="ari" src="' + ARI + '" alt="" width="28" height="21">';
			new Image().src = ARI_U;
		}
		$('#gozler').innerHTML = h;
		ari = $('#ari');
		if (K.fiyatlarOrnek) { vitrinEl.insertAdjacentHTML('afterbegin', serit()); sahne.classList.add('ornekli'); }
		vitrinEk();
	}
	/* vitrin ekleri: günün ürünü şeridi (varsa), "Tüm menü" altında dilek bağlantısı + Instagram kısayolu */
	var IGSIM = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="4"/><circle cx="10" cy="10" r="3.2"/><circle class="n" cx="14.3" cy="5.7" r=".7"/></svg>';
	function vitrinEk() {
		var ki = K.kimlik || {}, ig = instaAd(ki.instagram), u = gunU();
		if (u) {
			$('.ipucu', vitrinEl).insertAdjacentHTML('beforebegin', '<button class="gunun" type="button" data-is="gunun" data-v="' + kac(u.id) + '" aria-label="Günün ürünü: ' + kac(u.ad) + (yok(u) ? '' : ', ' + tutar(u)) + '">' +
				'<span class="gunun-et">Günün ürünü</span><span class="gunun-ad">' + kac(u.ad) + '</span>' + (yok(u) ? '' : '<span class="gunun-fiyat">' + tutar(u) + '</span>') + '</button>');
			sahne.classList.add('gunluk');
		}
		sadeBtn.insertAdjacentHTML('afterend', '<div class="vitrin-alt">' + dilekDugme('vt-dilek', 'Dilek, öneri, istek') +
			(ig ? '<a class="vt-ig" href="https://www.instagram.com/' + encodeURIComponent(ig) + '/" target="_blank" rel="noopener" aria-label="Instagram: @' + kac(ig) + '">' + IGSIM + '<span class="ig-ad">@' + kac(ig) + '</span><span class="ig-kisa">Instagram</span></a>' : '') + '</div>');
		igSigdir();
		if (d.fonts && d.fonts.ready) d.fonts.ready.then(igSigdir);
	}
	/* Instagram düğmesi: kullanıcı adı sığmıyorsa yalnız "Instagram" yazar (taşma yok) */
	function igSigdir() {
		var a = $('.vt-ig', vitrinEl), s = a && $('.ig-ad', a);
		if (!s) return;
		a.classList.remove('dar');
		a.classList.toggle('dar', s.scrollWidth > s.clientWidth + 1);
	}

	/* ---------- saat: o ana uyan en öncelikli kural bir gözeyi parlatır, üst satırı yazar ---------- */
	function simdi() { var q = /[?&]saat=([^&]+)/.exec(location.search), t = q && new Date(decodeURIComponent(q[1])); return t && !isNaN(t) ? t : new Date(); }
	function dakika(h, v) { var m = /^(\d{1,2}):(\d{2})$/.exec(h || ''); return m ? m[1] * 60 + +m[2] : v; }
	function saatKural() {
		var t = simdi(), gun = (t.getDay() + 6) % 7 + 1, dk = t.getHours() * 60 + t.getMinutes();
		return (K.saat || []).filter(function (k) {
			var b = dakika(k.bas, 0), e = dakika(k.bit, 1440);
			return (!k.gunler || !k.gunler.length || k.gunler.indexOf(gun) > -1) && (b <= e ? dk >= b && dk < e : dk >= b || dk < e);
		}).sort(function (a, b) { return (b.oncelik || 0) - (a.oncelik || 0); })[0] || null;
	}
	/* özel günler: "AA-GG" her yıl, "YYYY-AA-GG" tek yıl; yıl aşan aralık (12-25 → 01-01) çalışır; ilk uyan kazanır */
	function gunParca(s) { var m = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/.exec(String(s || '').trim()); return m ? { y: +m[1] || 0, md: +m[2] * 100 + +m[3] } : null; }
	function ozelMi(g, t) {
		var b = gunParca(g && g.bas), e = gunParca(g && g.bit), bg = (t.getMonth() + 1) * 100 + t.getDate(), y1, y2, n;
		if (!b || !e) return false;
		if (b.y || e.y) {
			y1 = b.y || e.y - (b.md > e.md ? 1 : 0);
			y2 = e.y || y1 + (e.md < b.md ? 1 : 0);
			n = t.getFullYear() * 10000 + bg;
			return n >= y1 * 10000 + b.md && n <= y2 * 10000 + e.md;
		}
		return b.md <= e.md ? bg >= b.md && bg <= e.md : bg >= b.md || bg <= e.md;
	}
	function ozelGun() {
		var t = simdi(), L = K.ozelGunler || [], i;
		for (i = 0; i < L.length; i++) if (ozelMi(L[i], t)) return L[i];
		return null;
	}
	function kisaAdi(s) {
		return kucuk(s).replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
	}
	function saatUygula() {
		var k = saatKural(), p = k && k.parlat, sa = simdi().getHours(), og = ozelGun();
		sahne.setAttribute('data-vakit', sa >= 5 && sa < 11 ? 'sabah' : sa < 17 && sa >= 11 ? 'gun' : sa >= 17 && sa < 21 ? 'aksam' : 'gece');
		if (og && kisaAdi(og.ad)) sahne.setAttribute('data-ozelgun', kisaAdi(og.ad)); else sahne.removeAttribute('data-ozelgun');
		if (og && og.vurgu) sahne.style.setProperty('--ozel', String(og.vurgu)); else sahne.style.removeProperty('--ozel');
		$('#not').textContent = (og && og.not) || (k && k.not) || (K.kimlik || {}).slogan || '';
		$$('.goze-yer', vitrinEl).forEach(function (y) { var b = $('.goze', y); y.classList.toggle('parla', !!p && b.getAttribute('data-v') === p); });
	}

	/* ---------- arı ---------- */
	function ariNokta(yer) { return { x: yer.offsetLeft + yer.offsetWidth * 0.74, y: yer.offsetTop + yer.offsetHeight * 0.04 }; }
	function ariDur(p) { return 'translate(' + Math.round(p.x) + 'px,' + Math.round(p.y) + 'px) scaleX(' + ariYon + ')'; }
	function ariKoy(yer) { if (!ari) return; ariGoze = yer; ariYer = ariNokta(yer); ari.style.transform = ariDur(ariYer); }
	function ariUc(yer) {
		if (!ari || !yer) return Promise.resolve();
		var p = ariNokta(yer), o = ariYer || p;
		if (Math.abs(p.x - o.x) + Math.abs(p.y - o.y) < 4) return Promise.resolve();
		ariYon = p.x < o.x ? -1 : 1;
		var orta = { x: (o.x + p.x) / 2, y: Math.min(o.y, p.y) - 30 };
		ari.src = ARI_U;
		ari.style.transform = ariDur(p);
		ariYer = p; ariGoze = yer;
		return oyna(ari, [{ transform: ariDur(o) }, { transform: ariDur(orta) + ' rotate(-8deg)', offset: 0.5 }, { transform: ariDur(p) }], 340).then(function () { ari.src = ARI; });
	}

	/* ---------- açılış ("mozaik"): küçük resimler decode() ile hazır olunca (en çok 600 ms) bal peteği duvarı merkezden dolar →
	   duvar geri eğilir, karolar söner, 8'i gözelerin yerine uçar → logo damga gibi iner → arı konar. ≈ 2,1 sn; kilit 1,2 sn'de kalkar ---------- */
	function hazirla(L, ms) {
		var hazir = {};
		return Promise.race([
			Promise.all(L.map(function (s) {
				var im = new Image();
				im.src = s;
				return (im.decode ? im.decode() : new Promise(function (ok, no) { im.onload = ok; im.onerror = no; })).then(function () { hazir[s] = 1; }, function () {});
			})),
			new Promise(function (ok) { setTimeout(ok, ms); })
		]).then(function () { return hazir; });
	}
	function kucukHavuz() {
		var havuz = [], gor = {};
		(K.urunler || []).forEach(function (u) { if (u.foto && !gor[u.foto]) { gor[u.foto] = 1; havuz.push(u.foto.replace(/\.webp$/, '-k.webp')); } });
		return havuz.slice(0, 18); /* ilk ekran yükü: en çok 18 küçük resim */
	}
	function gozeHedefler() {
		var s = sahne.getBoundingClientRect();
		return $$('.goze-yer', vitrinEl).filter(function (g) { return !g.classList.contains('goze-yer-logo'); }).map(function (g) {
			var b = g.getBoundingClientRect(), im = $('.goze-foto', g);
			return { yer: g, x: b.left - s.left + b.width / 2, y: b.top - s.top + b.height / 2, w: b.width, h: b.height, foto: im && im.tagName === 'IMG' ? im.getAttribute('src') : '' };
		});
	}
	function mozaikKur(havuz, hedefler, hazir) {
		var W = sahne.clientWidth, H = sahne.clientHeight;
		var N = dusuk ? 20 : 36, tw = Math.sqrt(W * H / (N * 0.866)), th = tw * 1.1547, dy = th * 0.75, L = [], r, c, x, y;
		var sr = Math.ceil(H / 2 / dy) + 1, sc = Math.ceil(W / 2 / tw) + 1;
		for (r = -sr; r <= sr; r++) for (c = -sc; c <= sc; c++) {
			x = W / 2 + (c + (r & 1 ? 0.5 : 0)) * tw; y = H / 2 + r * dy;
			if (x > -tw * 0.3 && x < W + tw * 0.3 && y > -th * 0.3 && y < H + th * 0.3) L.push({ x: x, y: y, m: Math.sqrt((x - W / 2) * (x - W / 2) + (y - H / 2) * (y - H / 2)) });
		}
		L.sort(function (a, b) { return a.m - b.m; });
		L = L.slice(0, Math.round(N * 1.3));
		havuz = havuz.filter(function (f) { return hazir[f]; });
		hedefler.forEach(function (h) {
			if (!h.foto || !hazir[h.foto]) return;
			var en = -1, ed = 1e9;
			L.forEach(function (k, i) { var e = (k.x - h.x) * (k.x - h.x) + (k.y - h.y) * (k.y - h.y); if (!k.h && e < ed) { ed = e; en = i; } });
			if (en > -1) L[en].h = h;
		});
		/* hazır olmayan karo çizilmez */
		L = L.filter(function (k, i) { k.f = k.h ? k.h.foto : havuz.length ? havuz[i % havuz.length] : ''; return !!k.f; });
		var m = d.createElement('div'), ic = '';
		m.className = 'mozaik mz-canli';
		L.forEach(function (k) {
			ic += '<div class="mz-karo" style="left:' + (k.x - tw / 2 + 2).toFixed(1) + 'px;top:' + (k.y - th / 2 + 2).toFixed(1) + 'px;width:' + (tw - 4).toFixed(1) + 'px;height:' + (th - 4).toFixed(1) + 'px">' +
				'<img src="' + kac(k.f) + '" alt="" decoding="sync"></div>';
		});
		m.innerHTML = '<div class="mz-duvar"><div class="mz-ic">' + ic + '</div></div><div class="mz-ucus"></div>';
		sahne.appendChild(m);
		var K2 = $$('.mz-karo', m), en = 1;
		L.forEach(function (k, i) { k.el = K2[i]; en = Math.max(en, k.m); });
		return { m: m, L: L, en: en };
	}
	function acilis() {
		var merkez = $('.goze-yer-logo', vitrinEl);
		ariKoy(merkez);
		var gor = sakla('vitrin-acilis') === '1';
		sakla('vitrin-acilis', '1');
		if (/[?&]acilis=1/.test(location.search)) gor = false;
		if (gor) return;
		kilitle();
		sahne.classList.add('acilis-a', 'acilis-g', 'acilis-u');
		var serbest = false, mz = null, p = ariYer, adim;
		setTimeout(function () { serbest = true; }, 1200);
		/* dokunuş açılışı hızla bitirir; ilk 1,2 sn dokunuş yutulur, sonra dokunulan yer de çalışır */
		function atla() {
			if (hizli) return;
			hizli = true;
			if (!serbest) { yut = true; setTimeout(function () { yut = false; }, 450); }
			if (d.getAnimations) d.getAnimations().forEach(function (a) { try { if (isFinite(a.effect.getComputedTiming().endTime)) a.finish(); } catch (e) {} });
		}
		sahne.addEventListener('pointerdown', atla);
		d.addEventListener('keydown', atla);
		if (azalt) {
			/* hareket azaltılmış: kısa solma */
			sahne.classList.remove('acilis-g');
			adim = Promise.all($$('.goze-yer', vitrinEl).map(function (g) { return oyna(g, [{ opacity: 0 }, { opacity: 1 }], 400); }));
		} else {
			var hedefler = gozeHedefler(), havuz = kucukHavuz();
			adim = hazirla(havuz.concat(hedefler.map(function (h) { return h.foto; }).filter(Boolean)), 600).then(function (hazir) {
				if (hizli) return;
				/* ağ yavaşsa (hazır resim az) boş karo duvarı yerine kısa solma */
				if (Object.keys(hazir).length < 8) {
					sahne.classList.remove('acilis-g');
					return Promise.all($$('.goze-yer', vitrinEl).map(function (g, i) { return oyna(g, [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }], 360, i * 40); }));
				}
				mz = mozaikKur(havuz, hedefler, hazir);
				merkez.classList.add('gizli-logo');
				/* karolar merkezden dışa dönerek yerine oturur (ilk karede fotoğraf) */
				return Promise.all(mz.L.map(function (k, i) {
					return oyna(k.el, [{ opacity: 0, transform: 'scale(.3) rotate(' + (i % 2 ? 24 : -24) + 'deg)' }, { opacity: 1, transform: 'none' }], 280, k.m / mz.en * 260, true);
				})).then(function () {
					/* duvar geri eğilir, uçmayacak karolar söner */
					return Promise.all([oyna($('.mz-ic', mz.m), [{ transform: 'none' }, { transform: 'rotateX(16deg) scale(.86)' }], 300, 0, true)].concat(mz.L.filter(function (k) { return !k.h; }).map(function (k) {
						return oyna(k.el, [{ opacity: 1 }, { opacity: 0 }], 260, k.m / mz.en * 80, true);
					})));
				}).then(function () {
					/* 8 karo gözelerin yerine uçar (FLIP: önce bütün ölçümler, sonra yazımlar) */
					var s = sahne.getBoundingClientRect(), ucus = $('.mz-ucus', mz.m), U = mz.L.filter(function (k) { return k.h; });
					var R = U.map(function (k) { return k.el.getBoundingClientRect(); });
					return Promise.all(U.map(function (k, i) {
						var a = R[i], h = k.h;
						k.el.getAnimations().forEach(birak);
						k.el.style.cssText = 'left:' + (h.x - h.w / 2) + 'px;top:' + (h.y - h.h / 2) + 'px;width:' + h.w + 'px;height:' + h.h + 'px';
						ucus.appendChild(k.el);
						return oyna(k.el, [{ transform: 'translate(' + (a.left - s.left + a.width / 2 - h.x).toFixed(1) + 'px,' + (a.top - s.top + a.height / 2 - h.y).toFixed(1) + 'px) scale(' + (a.width / h.w).toFixed(3) + ')' }, { transform: 'none' }], 400, i * 25);
					}));
				}).then(function () {
					/* gözeler görünür, mozaik söner; logo damga gibi iner */
					sahne.classList.remove('acilis-g');
					merkez.classList.remove('gizli-logo');
					return Promise.all([oyna(mz.m, [{ opacity: 1 }, { opacity: 0 }], 200, 0, true), oyna(merkez, [{ opacity: 0, transform: 'scale(1.3)' }, { opacity: 1, transform: 'scale(1)' }], 300)]);
				});
			});
		}
		adim.then(function () {
			if (mz && mz.m.parentNode) mz.m.parentNode.removeChild(mz.m);
			sahne.classList.remove('acilis-g', 'acilis-u', 'acilis-a');
			merkez.classList.remove('gizli-logo');
			var is = ['.ust', '.not', '.gunun', '.ipucu', '.vitrin-alt', '.adres', '.serit'].map(function (s) { return oyna($(s, vitrinEl), [{ opacity: 0 }, { opacity: 1 }], 280); });
			is.push(oyna(sadeBtn, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], 380, 140));
			/* arı yalnız açılış sonunda konar */
			if (ari) {
				ari.src = ARI_U;
				is.push(oyna(ari, [{ transform: 'translate(' + (p.x + 90) + 'px,' + (p.y - 110) + 'px) rotate(-14deg)', opacity: 0 }, { transform: ariDur(p), opacity: 1 }], 380).then(function () { ari.src = ARI; }));
			}
			return Promise.all(is);
		}).then(function () {
			sahne.removeEventListener('pointerdown', atla);
			d.removeEventListener('keydown', atla);
			hizli = false;
			coz();
		});
	}

	/* ---------- perde: dokunulan göze büyüyüp ekranı kaplar; perde rengi = varış rengi = bölüm rengi ---------- */
	function bz(r) { return 'color-mix(in srgb,' + (r || '#3a2a1a') + ' 80%,#000)'; }
	function perdeKur(yer, renk) {
		var s = sahne.getBoundingClientRect(), g = yer.getBoundingClientRect();
		var cx = g.left - s.left + g.width / 2, cy = g.top - s.top + g.height / 2;
		var W = Math.ceil(2 * Math.sqrt(Math.pow(Math.max(cx, s.width - cx), 2) + Math.pow(Math.max(cy, s.height - cy), 2))) + 8, H = W * 1.1547;
		perde.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px;left:' + (cx - W / 2) + 'px;top:' + (cy - H / 2) + 'px;background:' + bz(renk);
		return g.width / W;
	}
	function perdeGizle() { perde.style.display = 'none'; }
	function icerikGir(el) {
		var h = sahne.clientHeight, is = [];
		$$('.gir', el).forEach(function (e) {
			if (is.length < 9 && e.getBoundingClientRect().top < h) is.push(oyna(e, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], 340, is.length * 70));
		});
		return Promise.all(is);
	}

	/* ---------- döner vitrin: fotoğraflı ürünler tabakta, 3B bir standın üstünde döner (fotoğrafsızlar yalnız listede) ---------- */
	var dv = null, ADIM = 30;
	function dvKur(b) {
		var T = urunleri(b.id), U = T.filter(fotolu);
		if (!U.length) U = T;
		bolumEl.className = bolumEl.className.replace(/\s*(dv-mod|gl-mod)/g, '') + ' dv-mod';
		bolumEl.innerHTML = '<div class="dv-zemin"><img class="dv-foto" alt=""><img class="dv-foto" alt=""></div>' +
			geriDugme('', '<h1 class="b-baslik" id="b-ad">' + kac(b.ad) + '</h1><button class="b-sade" type="button" data-is="sade">Tüm menü</button>') +
			'<div class="dv-sahne gir" role="listbox" aria-labelledby="b-ad" tabindex="0"><div class="dv-halka"></div></div>' +
			/* bölümde besin bilgisi olan ürün yoksa bilgi alanı eskisiyle birebir aynı; varsa yer baştan ayrılır (ürün değişince çark zıplamaz) */
			(besinliVar(U) ? '<div class="dv-bilgi gir besinli"><h2 class="dv-ad" aria-live="polite"></h2><div class="dv-fiyat"></div><div class="dv-detay"><p class="dv-aciklama"></p><div class="dv-besin"></div></div></div>'
				: '<div class="dv-bilgi gir"><h2 class="dv-ad" aria-live="polite"></h2><div class="dv-fiyat"></div><p class="dv-aciklama"></p></div>') +
			'<div class="dv-alt gir"><button class="dv-liste" type="button" data-is="liste">' + (U.length < T.length ? 'Tüm liste (' + T.length + ')' : 'Liste') + '</button><div class="dv-gez"><button class="dv-ok" type="button" data-is="dv" data-v="-1" aria-label="Önceki ürün">' + GERI + '</button><span class="dv-sayi"></span>' +
			'<button class="dv-ok" type="button" data-is="dv" data-v="1" aria-label="Sonraki ürün">' + ILERI + '</button></div></div>' +
			'<div class="bl-liste kapali"></div>';
		var s = $('.dv-sahne', bolumEl), r = s.getBoundingClientRect();
		var P = Math.round(Math.max(120, Math.min(r.width * 0.78, r.height * 0.9, 360)));
		s.style.setProperty('--p', P + 'px');
		dv = { b: b, U: U, T: T, aci: 0, merkez: -1, P: P, R: P * 1.9, sahne: s, halka: $('.dv-halka', s), ogeler: {}, tw: 0, kare: 0, fz: 0, acik: false };
		dvCiz();
		dvSurukle(s);
	}
	function dvPencere(c) {
		var bas = Math.max(0, c - 3), son = Math.min(dv.U.length - 1, c + 3), k, i, u, el;
		for (k in dv.ogeler) if (k < bas || k > son) { dv.ogeler[k].remove(); delete dv.ogeler[k]; }
		for (i = bas; i <= son; i++) if (!dv.ogeler[i]) {
			u = dv.U[i];
			el = d.createElement('button');
			el.type = 'button';
			el.className = 'dv-tabak' + (tukendi(u) ? ' tukendi' : '');
			el.setAttribute('data-i', i);
			el.setAttribute('role', 'option');
			el.setAttribute('aria-label', u.ad + (tukendi(u) ? ', tükendi' : ''));
			el.tabIndex = -1;
			el.innerHTML = foto(u.foto, u.ad, 'dv-resim', false);
			dv.halka.appendChild(el);
			dv.ogeler[i] = el;
		}
	}
	function dvCiz() {
		var son = (dv.U.length - 1) * ADIM, c = Math.max(0, Math.min(dv.U.length - 1, Math.round(dv.aci / ADIM))), k, t, el;
		if (c !== dv.merkez) { dv.merkez = c; dvPencere(c); dvBilgi(c); }
		for (k in dv.ogeler) {
			el = dv.ogeler[k];
			t = (k * ADIM - dv.aci) * Math.PI / 180;
			el.style.transform = 'translate3d(' + (dv.R * Math.sin(t) * 0.82).toFixed(1) + 'px,' + (dv.R * (Math.cos(t) - 1) * 0.32).toFixed(1) + 'px,' + (dv.R * (Math.cos(t) - 1)).toFixed(1) + 'px) scale(' + Math.max(0.3, 1 - (1 - Math.cos(t)) * 2.2).toFixed(3) + ')';
			el.style.opacity = Math.max(0, 1 - Math.abs(k * ADIM - dv.aci) / 105).toFixed(3);
			el.setAttribute('aria-selected', String(+k === c));
		}
		return son;
	}
	function dvBilgi(i) {
		var u = dv.U[i], ad = $('.dv-ad', bolumEl);
		if (!u) return;
		ad.innerHTML = String(u.ad).split(' ').map(function (s) {
			return '<span class="dv-kelime">' + Array.from(s).map(function (h) { return '<span class="dv-harf">' + kac(h) + '</span>'; }).join('') + '</span>';
		}).join(' ');
		$$('.dv-harf', ad).forEach(function (h, j) { oyna(h, [{ opacity: 0, transform: 'translateY(55%)' }, { opacity: 1, transform: 'none' }], 320, j * 16); });
		$('.dv-fiyat', bolumEl).innerHTML = fiyat(u);
		$('.dv-bilgi', bolumEl).classList.toggle('tukendi', tukendi(u));
		$('.dv-aciklama', bolumEl).textContent = u.aciklama || '';
		var bk = $('.dv-besin', bolumEl);
		if (bk) {
			/* iki sütun: solda içindekiler, sağda besin; açıklama yoksa besin tek başına ortada */
			bk.innerHTML = besinBlok(u, false);
			$('.dv-detay', bolumEl).className = 'dv-detay' + (bk.firstChild ? (String(u.aciklama || '').trim() ? ' iki' : ' tek') : '');
		}
		$('.dv-sayi', bolumEl).textContent = (i + 1) + ' / ' + dv.U.length;
		if (dv.acik) dvFoto(u);
	}
	/* zemin bölüm rengidir (sabit); ürün değişince yalnız bulanık ürün fotoğrafı çapraz geçer */
	function dvFoto(u) {
		var F = $$('.dv-foto', bolumEl), fy = F[1 - dv.fz], fe = F[dv.fz];
		dv.fz = 1 - dv.fz;
		fe.style.zIndex = 1; fy.style.zIndex = 2;
		if (!u || !u.foto || !/\.webp$/.test(u.foto)) { fy.classList.remove('acik'); fe.classList.remove('acik'); return; }
		fy.onerror = function () { fy.classList.remove('acik'); };
		fy.src = u.foto.replace(/\.webp$/, '-z.webp');
		fy.classList.add('acik');
		oyna(fy, [{ opacity: 0 }, { opacity: 0.28 }], 520).then(function () { if (dv && F[dv.fz] === fy) fe.classList.remove('acik'); });
	}
	function dvDur() { if (dv && dv.tw) { cancelAnimationFrame(dv.tw); dv.tw = 0; } }
	function dvGit(hedef) {
		if (!dv) return;
		hedef = Math.max(0, Math.min(dv.U.length - 1, hedef));
		dv.hedef = hedef;
		dvDur();
		var a0 = dv.aci, a1 = hedef * ADIM, t0 = performance.now(), sure = azalt ? 0 : Math.min(600, 300 + Math.abs(a1 - a0) * 3);
		if (!sure) { dv.aci = a1; dvCiz(); return; }
		(function adim(t) {
			var p = Math.min(1, (t - t0) / sure), e = 1 - Math.pow(1 - p, 3);
			dv.aci = a0 + (a1 - a0) * e;
			dvCiz();
			dv.tw = p < 1 ? requestAnimationFrame(adim) : 0;
		})(t0);
	}
	function dvSurukle(s) {
		var bas = null;
		s.addEventListener('pointerdown', function (e) {
			if (kilit || !dv) return;
			dvDur();
			bas = { x: e.clientX, a: dv.aci, t: performance.now(), iz: [[performance.now(), e.clientX]], hedef: e.target.closest('.dv-tabak') };
			try { s.setPointerCapture(e.pointerId); } catch (x) {}
		});
		s.addEventListener('pointermove', function (e) {
			if (!bas) return;
			var son = (dv.U.length - 1) * ADIM, a = bas.a - (e.clientX - bas.x) * ADIM / (dv.P * 0.85);
			if (a < 0) a *= 0.35; else if (a > son) a = son + (a - son) * 0.35;
			dv.aci = a;
			bas.iz.push([performance.now(), e.clientX]);
			if (bas.iz.length > 6) bas.iz.shift();
			if (!dv.kare) dv.kare = requestAnimationFrame(function () { dv.kare = 0; if (dv) dvCiz(); });
		});
		function birak(e) {
			if (!bas) return;
			var dx = e.clientX - bas.x, dt = performance.now() - bas.t, b = bas;
			bas = null;
			dv.isaret = performance.now();
			if (Math.abs(dx) < 8 && dt < 350) {
				var i = b.hedef ? +b.hedef.getAttribute('data-i') : dv.merkez;
				if (i === dv.merkez) dvSec(i, dv.ogeler[i]); else dvGit(i);
				return;
			}
			var a = b.iz[0], z = b.iz[b.iz.length - 1], v = z[0] > a[0] ? -(z[1] - a[1]) / (z[0] - a[0]) * ADIM / (dv.P * 0.85) : 0;
			dvGit(Math.round((dv.aci + v * 220) / ADIM));
		}
		s.addEventListener('pointerup', birak);
		s.addEventListener('pointercancel', birak);
		s.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowRight') dvGit(dv.merkez + 1);
			else if (e.key === 'ArrowLeft') dvGit(dv.merkez - 1);
			else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dvSec(dv.merkez, dv.ogeler[dv.merkez]); }
		});
	}
	function dvSec(i, el) {
		var u = dv && dv.U[i];
		if (!u || kilit) return;
		if (u.yildiz && u.foto) fotoSov(u, el); else panelAc(u.id, el);
	}

	/* liste görünümü (bölümün bütün ürünleri; fotoğrafsızlar harf kutusuyla) */
	function listeAc(kaynak) {
		var L = $('.bl-liste', bolumEl);
		if (kilit || !L || !dv) return;
		kilitle();
		L.innerHTML = '<div class="bl-ust"><div class="bl-satir"><button class="geri" type="button" data-is="geri" aria-label="Döner vitrine dön">' + GERI + '</button><h2 class="bl-ad">' + kac(dv.b.ad) + '</h2></div>' + serit() + (besinliVar(dv.T) ? '<p class="bl-not">' + kac(besinNot()) + '</p>' : '') + '</div>' +
			'<ul class="liste">' + dv.T.map(function (u) {
				return '<li><button class="satir' + (tukendi(u) ? ' tukendi' : '') + '" type="button" data-is="' + (u.yildiz && u.foto ? 'sov' : 'urun') + '" data-v="' + kac(u.id) + '">' + foto(u.foto, u.ad, 's-foto', false, true) +
					'<span class="s-orta">' + gunEt(u) + '<span class="s-ad">' + kac(u.ad) + '</span>' + (u.aciklama ? '<span class="s-aciklama">' + kac(u.aciklama) + '</span>' : '') + '</span>' +
					(besin(u) && besin(u).kcal ? '<span class="s-fiyat kcalli">' + fiyat(u) + kcalYazi(u, 's-kcal') + '</span>' : '<span class="s-fiyat">' + fiyat(u) + '</span>') + '</button></li>';
			}).join('') + '</ul>';
		goster(L); L.scrollTop = 0;
		it({ e: 'liste', kaynak: kaynak });
		oyna(L, [{ opacity: 0 }, { opacity: 1 }], 280).then(function () { odak($('.geri', L)); coz(); });
	}
	function listeKapat(anim) {
		var s = cek(), L = $('.bl-liste', bolumEl);
		if (!L) return;
		if (!anim) { gizle(L); return; }
		kilitle();
		oyna(L, [{ opacity: 1 }, { opacity: 0 }], 240, 0, true).then(function (a) { gizle(L); birak(a); odak(s.kaynak); coz(); });
	}

	/* ---------- yıldız ürün: tam ekran yakın çekim, 6 sn yavaş itme; altta ad, fiyat, "Bunu sor" ---------- */
	function fotoSov(u, kaynak) {
		if (kilit) return;
		kilitle();
		var zk = /\.webp$/.test(u.foto) ? u.foto.replace(/\.webp$/, '-z.webp') : u.foto;
		yildizEl.innerHTML = '<div class="fs-zemin"><img class="fs-bulanik" src="' + kac(zk) + '" alt="" decoding="async" draggable="false"></div><div class="fs-cerceve"><img class="fs-resim" src="' + kac(u.foto) + '" alt="' + kac(u.ad) + '"></div>' + geriDugme('Döner vitrine dön') +
			'<div class="fs-alt"><h2 class="fs-ad" id="fs-ad">' + kac(u.ad) + '</h2>' + fiyat(u) + besinBlok(u, true) + mesajDugme('Bunu sor', u.id) + '</div>';
		yildizEl.setAttribute('aria-labelledby', 'fs-ad');
		var bl = $('.fs-bulanik', yildizEl); if (bl) bl.addEventListener('error', function () { bl.src = u.foto; }, { once: true });
		goster(yildizEl);
		it({ e: 'yildiz', kaynak: kaynak });
		var c = $('.fs-cerceve', yildizEl), im = $('.fs-resim', yildizEl), b = c.getBoundingClientRect(), a = kaynak ? kaynak.getBoundingClientRect() : b, sk = b.width ? a.width / b.width : 1;
		if (kaynak) kaynak.style.visibility = 'hidden';
		Promise.all([
			oyna($('.fs-zemin', yildizEl), [{ opacity: 0 }, { opacity: 1 }], 300),
			oyna(c, [{ opacity: 0, transform: 'translate(' + (a.left + a.width / 2 - b.left - b.width / 2) + 'px,' + (a.top + a.height / 2 - b.top - b.height / 2) + 'px) scale(' + sk + ')' }, { opacity: 1, offset: 0.35 }, { opacity: 1, transform: 'none' }], 520),
			oyna($('.fs-alt', yildizEl), [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], 300, 320),
			oyna($('.b-ust', yildizEl), [{ opacity: 0 }, { opacity: 1 }], 300, 320)
		]).then(function () {
			if (im.animate) yildizEl.kb = im.animate([{ transform: 'scale(1)' }, { transform: azalt ? 'scale(1.02)' : 'scale(1.06)' }], { duration: 6000, easing: 'cubic-bezier(.25,.6,.3,1)', fill: 'forwards' });
			coz();
			odak($('.geri', yildizEl));
		});
	}
	function fotoSovKapat(anim) {
		var s = cek();
		function son() { birak(yildizEl.kb); gizle(yildizEl); yildizEl.innerHTML = ''; if (s.kaynak) { s.kaynak.style.visibility = ''; odak(s.kaynak); } }
		if (!anim) { son(); return; }
		kilitle();
		var c = $('.fs-cerceve', yildizEl), b = c.getBoundingClientRect(), a = s.kaynak && s.kaynak.isConnected ? s.kaynak.getBoundingClientRect() : null;
		Promise.all([
			oyna(yildizEl, [{ opacity: 1 }, { opacity: 1, offset: 0.4 }, { opacity: 0 }], 440, 0, true),
			a ? oyna(c, [{ transform: 'none' }, { transform: 'translate(' + (a.left + a.width / 2 - b.left - b.width / 2) + 'px,' + (a.top + a.height / 2 - b.top - b.height / 2) + 'px) scale(' + (a.width / b.width) + ')' }], 440, 0, true) : null
		]).then(function (x) { son(); x.forEach(birak); coz(); });
	}

	/* ---------- galeri bölümü (tip:"galeri"): hikâye gibi; tam ekran, ilerleme çubukları, 3 sn yavaş yakınlaşma,
	   sol/sağ yarıya dokun = önceki/sonraki, basılı tut = dur ---------- */
	var secili = '', hk = null, HK_SN = 3000;
	function galeriFotolar() { return ((K.ozelPasta || {}).fotolar || []).filter(function (f) { return f && f.foto; }); }
	function galeriMesaj() {
		var m = (K.ozelPasta || {}).mesaj || 'Merhaba, menünüzdeki özel pastalara baktım. Buna benzer bir pasta için bilgi alabilir miyim?';
		return m + (secili ? ' (Fotoğraf: ' + secili + ')' : '');
	}
	function galeriCiz(b) {
		var g = K.ozelPasta || {}, F = galeriFotolar();
		bolumEl.className = bolumEl.className.replace(/\s*(dv-mod|gl-mod)/g, '') + ' gl-mod';
		bolumEl.innerHTML = '<div class="hk-sahne gir" tabindex="0" aria-label="' + kac(b.ad) + ': sola ya da sağa dokun, basılı tut">' + F.map(function (f) {
			return '<img class="hk-resim" alt="' + kac(f.baslik || '') + '" decoding="async" draggable="false" data-src="' + kac(f.foto) + '">';
		}).join('') + '</div>' +
			'<div class="hk-cubuklar" aria-hidden="true">' + F.map(function () { return '<span><i></i></span>'; }).join('') + '</div>' +
			geriDugme('', '<h1 class="b-baslik" id="b-ad">' + kac(b.ad) + '</h1>') +
			'<div class="hk-alt gir"><p class="hk-baslik" aria-live="polite"></p>' + (g.aciklama ? '<p class="hk-aciklama">' + kac(g.aciklama) + '</p>' : '') + mesajDugme('Bunun benzerini sor') + '</div>';
		hk = { F: F, i: -1, bar: null, dur: false, basladi: false };
		if (F.length) hkGoster(0);
		hkOlaylar($('.hk-sahne', bolumEl));
	}
	function hkGoster(i) {
		if (!hk) return;
		i = Math.max(0, Math.min(hk.F.length - 1, i));
		var R = $$('.hk-resim', bolumEl), C = $$('.hk-cubuklar i', bolumEl), eski = R[hk.i], yeni = R[i], j;
		if (hk.bar) { hk.bar.cancel(); hk.bar = null; }
		C.forEach(function (c, k) { c.style.transform = k < i ? 'none' : 'scaleX(0)'; });
		for (j = i; j <= i + 1 && j < R.length; j++) if (!R[j].getAttribute('src')) R[j].src = R[j].getAttribute('data-src');
		hk.i = i;
		secili = hk.F[i].baslik || '';
		$('.hk-baslik', bolumEl).textContent = secili;
		if (eski !== yeni) {
			if (eski) eski.style.zIndex = 1;
			yeni.style.zIndex = 2;
			birak(yeni.kb);
			yeni.classList.add('acik');
			if (eski) oyna(yeni, [{ opacity: 0 }, { opacity: 1 }], 240).then(function () { if (hk && R[hk.i] !== eski) { eski.classList.remove('acik'); birak(eski.kb); } });
		}
		if (hk.basladi) hkOyna();
	}
	function hkOyna() {
		var i = hk.i, im = $$('.hk-resim', bolumEl)[i], c = $$('.hk-cubuklar i', bolumEl)[i];
		function basla() {
			if (!hk || hk.i !== i || hk.bar) return;
			hk.bar = c.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: HK_SN, easing: 'linear', fill: 'forwards' });
			birak(im.kb);
			im.kb = im.animate([{ transform: 'scale(1)' }, { transform: azalt ? 'scale(1.015)' : 'scale(1.08)' }], { duration: HK_SN, easing: 'linear', fill: 'forwards' });
			if (hk.dur) { hk.bar.pause(); im.kb.pause(); }
			var bar = hk.bar;
			bar.finished.then(function () { if (hk && hk.bar === bar && hk.i < hk.F.length - 1) hkGoster(hk.i + 1); }, function () {});
		}
		if (im.complete && im.naturalWidth) basla(); else if (im.decode) im.decode().then(basla, basla); else im.onload = basla;
	}
	function hkDurdur(p) {
		if (!hk) return;
		hk.dur = p;
		var im = $$('.hk-resim', bolumEl)[hk.i];
		[hk.bar, im && im.kb].forEach(function (a) { if (a) { if (p) a.pause(); else a.play(); } });
	}
	function hkKapat() { if (hk && hk.bar) hk.bar.cancel(); hk = null; }
	function hkOlaylar(s) {
		var bas = null, sayac = 0;
		s.addEventListener('pointerdown', function (e) {
			if (kilit || !hk) return;
			bas = { x: e.clientX };
			sayac = setTimeout(function () { if (bas) { bas.tut = true; hkDurdur(true); } }, 220);
		});
		function birak(e) {
			if (!bas || !hk) return;
			clearTimeout(sayac);
			var b = bas;
			bas = null;
			if (b.tut) { hkDurdur(false); return; }
			if (e.type !== 'pointerup') return;
			var r = s.getBoundingClientRect();
			hkGoster(hk.i + (e.clientX - r.left < r.width / 2 ? -1 : 1));
		}
		s.addEventListener('pointerup', birak);
		s.addEventListener('pointercancel', birak);
		s.addEventListener('contextmenu', function (e) { e.preventDefault(); });
		s.addEventListener('keydown', function (e) {
			if (!hk) return;
			if (e.key === 'ArrowRight') hkGoster(hk.i + 1);
			else if (e.key === 'ArrowLeft') hkGoster(hk.i - 1);
			else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); hkDurdur(!hk.dur); }
		});
	}

	/* ---------- pastanı kendin yap: üstten çekilmiş gerçek pasta fotoğrafı; yazı doğrudan kremaya, krema torbası gibi soldan sağa açılır ---------- */
	var yp = null;
	function ypDurum() {
		var py = yapici() || {}, T = turler(), kis = py.kisiler || [6, 10, 15, 20], kat = py.katlar || [1, 2, 3], s = null;
		try { s = JSON.parse(sakla('vitrin-yapici') || 'null'); } catch (e) {}
		s = s || {};
		if (!T.some(function (t) { return t.id === s.tur; })) s.tur = T[0].id;
		if (kis.indexOf(s.kisi) < 0) s.kisi = kis[Math.min(1, kis.length - 1)];
		if (kat.indexOf(s.kat) < 0) s.kat = kat[0];
		s.yazi = Array.from(String(s.yazi || '')).slice(0, py.yaziMax || 25).join('');
		return { s: s, T: T, kis: kis, kat: kat, max: py.yaziMax || 25 };
	}
	function ypTur() { var s = yp.s; return yp.T.filter(function (t) { return t.id === s.tur; })[0] || yp.T[0]; }
	function ypMesaj() {
		var s = yp.s, p = [ypTur().ad, s.kisi + ' kişilik', 'kat sayısı: ' + s.kat];
		if (s.yazi.trim()) p.push('üstünde "' + s.yazi.trim() + '" yazsın');
		return 'Merhaba, menünüzden pasta tasarladım: ' + p.join(', ') + '. Fiyat ve teslim günü için bilgi alabilir miyim?';
	}
	function yapCiz() {
		yp = ypDurum();
		var py = yapici() || {}, s = yp.s;
		function cip(alan, liste, yaz) {
			return '<div class="yp-secim" role="group">' + liste.map(function (x) {
				var v = typeof x === 'object' ? x.id : x;
				return '<button class="yp-cip" type="button" data-is="yp" data-alan="' + alan + '" data-v="' + kac(v) + '" aria-pressed="' + (String(s[alan]) === String(v)) + '">' + yaz(x) + '</button>';
			}).join('') + '</div>';
		}
		yapEl.innerHTML = geriDugme() + '<h1 class="yp-baslik gir" id="yap-ad">' + kac(py.baslik || 'Pastanı kendin yap') + '</h1>' +
			'<div class="yp-sahne gir"><div class="yp-pasta"><img class="yp-resim" alt="" src="' + kac(ypTur().foto) + '"><img class="yp-resim" alt="" style="opacity:0"><p class="yp-yazi" aria-hidden="true"></p></div></div>' +
			'<div class="yp-panel gir">' +
			(yp.T.length > 1 ? '<section class="yp-grup"><h2>Pasta</h2>' + cip('tur', yp.T, function (t) { return '<img src="' + kac(t.foto) + '" alt="" loading="lazy">' + kac(t.ad); }) + '</section>' : '') +
			'<section class="yp-grup"><h2>Kaç kişilik?</h2>' + cip('kisi', yp.kis, function (x) { return x + ' kişi'; }) + '</section>' +
			'<section class="yp-grup"><h2>Kat sayısı</h2>' + cip('kat', yp.kat, function (x) { return x === 1 ? 'Tek kat' : x + ' kat'; }) + '</section>' +
			'<section class="yp-grup"><h2><label for="yp-yazi">Pastanın üstüne yazı</label> <span class="yp-sayac"></span></h2><input class="yp-giris" id="yp-yazi" type="text" maxlength="' + yp.max + '" autocomplete="off" placeholder="Örn. İyi ki doğdun Ece"></section>' +
			'<div class="yp-mesaj"><p class="yp-mesaj-baslik">Kafeye gidecek mesaj</p><p class="yp-mesaj-metin"></p></div>' + mesajDugme("WhatsApp'tan sor") +
			'<p class="yp-not">Fiyat ve teslim günü kafeye sorulur.</p></div>';
		yp.on = 0;
		var g = $('.yp-giris', yapEl);
		g.value = s.yazi;
		g.addEventListener('input', function () { s.yazi = Array.from(g.value).slice(0, yp.max).join(''); ypYazi(); ypGuncelle(); });
		ypOlcek(false); ypYazi(true, true); ypGuncelle();
	}
	function ypGuncelle() {
		sakla('vitrin-yapici', JSON.stringify(yp.s));
		$('.yp-sayac', yapEl).textContent = Array.from(yp.s.yazi).length + '/' + yp.max;
		$('.yp-mesaj-metin', yapEl).textContent = ypMesaj();
		$$('.yp-cip', yapEl).forEach(function (b) { b.setAttribute('aria-pressed', String(String(yp.s[b.getAttribute('data-alan')]) === b.getAttribute('data-v'))); });
	}
	function ypOlcek(anim) {
		var i = yp.kis.indexOf(yp.s.kisi), o = 0.8 + 0.2 * (yp.kis.length > 1 ? i / (yp.kis.length - 1) : 1), p = $('.yp-pasta', yapEl), eski = p.style.transform;
		p.style.transform = 'scale(' + o.toFixed(3) + ')';
		if (anim && eski && !azalt) oyna(p, [{ transform: eski }, { transform: p.style.transform }], 420);
	}
	/* yazı tek satır; yeni harfler bir "pencere"yle açılır: dış kutu sola, iç yazı sağa aynı ölçüde kayar (yalnız transform) */
	function ypYazi(hepsi, sessiz) {
		var p = $('.yp-yazi', yapEl), t = ypTur(), yeni = yp.s.yazi.trim(), H = Array.from(yeni), E = hepsi ? [] : Array.from(p.getAttribute('data-y') || ''), ayni = 0;
		var koyu = /cikolata|kakao|kahve/.test(t.id);
		p.classList.toggle('koyu', koyu);
		p.style.color = t.yaziRenk || (koyu ? '#fff6e8' : '#5a2d17');
		p.style.fontSize = 'calc(var(--pc) * ' + Math.min(0.125, 1.5 / Math.max(1, H.length)).toFixed(4) + ')';
		p.setAttribute('data-y', yeni);
		clearTimeout(yp.nz);
		if (!H.length) { p.innerHTML = ''; return; }
		while (ayni < E.length && E[ayni] === H[ayni]) ayni++;
		p.innerHTML = '<span class="yp-pen"><span class="yp-ic">' + kac(H.slice(0, ayni).join('')) + '<span class="yp-yeni">' + kac(H.slice(ayni).join('')) + '</span></span></span>';
		if (sessiz || ayni >= H.length) return;
		var pen = $('.yp-pen', p), ic = $('.yp-ic', p), w = pen.offsetWidth, x0 = ayni ? $('.yp-yeni', p).offsetLeft : 0, kalan = w - x0;
		if (kalan <= 0 || hizli || !pen.animate) return;
		var o = { duration: Math.max(160, 900 * kalan / w) * (azalt ? 0.6 : 1), easing: 'cubic-bezier(.35,.1,.35,1)' };
		yp.kr = pen.animate([{ transform: 'translateX(' + (-kalan) + 'px)' }, { transform: 'none' }], o);
		ic.animate([{ transform: 'translateX(' + kalan + 'px)' }, { transform: 'none' }], o);
		var kr = yp.kr;
		kr.finished.then(function () { if (yp && yp.kr === kr) yp.nz = setTimeout(ypNefes, 450); }, function () {});
	}
	/* yazı bitince pasta bir kez "nefes alır" */
	function ypNefes() {
		var p = yapEl && $('.yp-pasta', yapEl), b;
		if (!p || azalt) return;
		b = p.style.transform || 'none';
		oyna(p, [{ transform: b }, { transform: b + ' scale(1.03)', offset: 0.45 }, { transform: b }], 700);
	}
	function ypSec(t) {
		var a = t.getAttribute('data-alan'), v = t.getAttribute('data-v'), s = yp.s;
		s[a] = a === 'tur' ? v : +v;
		if (a === 'tur') {
			var R = $$('.yp-resim', yapEl), yeni = R[1 - yp.on], eski = R[yp.on];
			yeni.src = ypTur().foto;
			yeni.style.opacity = '1';
			yp.on = 1 - yp.on;
			oyna(yeni, [{ opacity: 0 }, { opacity: 1 }], 450).then(function () { if (R[yp.on] !== eski) eski.style.opacity = '0'; });
			ypYazi(true);
		} else if (a === 'kisi') ypOlcek(true);
		ypGuncelle();
	}

	/* ---------- bölüme gir / çık (perde geçişi) ---------- */
	function ekranAc(tur, id, yer) {
		if (kilit || !yer) return;
		var py = yapici(), b = tur === 'yap' ? null : bolumBul(id), el = tur === 'yap' ? yapEl : bolumEl;
		if (tur !== 'yap' && !b) return;
		var renk = b ? b.renk || '#3a2a1a' : (py && py.renk) || (K.tema || {}).altin || '#8a5a1f';
		kilitle();
		el.style.setProperty('--b', renk);
		if (tur === 'yap') yapCiz(); else if (b.tip === 'galeri') galeriCiz(b); else dvKur(b);
		it({ e: tur, id: id, yer: yer });
		ariUc(yer).then(function () {
			var s0 = perdeKur(yer, renk);
			return oyna(perde, [{ transform: 'scale(' + s0 + ')', opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: 'scale(1)', opacity: 1 }], 560);
		}).then(function () {
			goster(el); el.scrollTop = 0; gizle(vitrinEl); perdeGizle();
			if (dv && tur === 'bolum' && b.tip !== 'galeri') { dvCiz(); dvGir(); dv.acik = true; dvFoto(dv.U[dv.merkez]); }
			return icerikGir(el);
		}).then(function () {
			if (hk && tur === 'bolum' && b.tip === 'galeri') { hk.basladi = true; hkOyna(); }
			if (tur === 'yap' && yp && yp.s.yazi.trim()) ypYazi(true);
			odak($('.geri', el)); coz();
		});
	}
	function dvGir() {
		/* stand açılırken tabaklar yandan dönerek yerine gelir */
		var a0 = Math.min(3, dv.U.length - 1) * ADIM;
		if (azalt || !a0) return;
		dv.aci = -ADIM * 1.6; dvCiz();
		dvGit(0);
	}
	function ekranKapat(anim) {
		var s = cek(), el = s.e === 'yap' ? yapEl : bolumEl, b = bolumBul(s.id), py = yapici();
		var renk = b ? b.renk || '#3a2a1a' : (py && py.renk) || (K.tema || {}).altin || '#8a5a1f';
		dvDur();
		if (s.e !== 'yap') hkKapat();
		function bitir() { el.innerHTML = ''; if (s.e !== 'yap') dv = null; }
		if (!anim) { gizle(el); bitir(); goster(vitrinEl); perdeGizle(); return; }
		kilitle();
		var s0 = perdeKur(s.yer, renk);
		oyna(el, [{ opacity: 1 }, { opacity: 0 }], 260, 0, true).then(function (a) {
			gizle(el); birak(a); bitir(); goster(vitrinEl);
			return oyna(perde, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(' + s0 + ')', opacity: 1, offset: 0.84 }, { transform: 'scale(' + s0 + ')', opacity: 0 }], 480, 0, true);
		}).then(function (a) { perdeGizle(); birak(a); odak($('.goze', s.yer)); coz(); });
	}

	/* ---------- ürün paneli: "Bunu sor" her zaman; fotoğraf yoksa boş alan yok ---------- */
	function panelAc(id, kaynak) {
		var u = urunBul(id);
		if (kilit || !u) return;
		kilitle();
		panelEl.style.setProperty('--b', (bolumBul(u.bolum) || {}).renk || bolumEl.style.getPropertyValue('--b') || '#3a2a1a');
		panelEl.innerHTML = '<div class="panel-arka" data-is="geri"></div><div class="panel-kutu' + (u.foto ? '' : ' fotosuz') + (tukendi(u) ? ' tukendi' : '') + '" role="dialog" aria-modal="true" aria-labelledby="p-ad">' +
			(u.foto ? foto(u.foto, u.ad, 'p-foto') : '') + '<div class="p-govde"><h2 class="p-ad" id="p-ad">' + kac(u.ad) + '</h2>' +
			(u.aciklama ? '<p class="p-aciklama">' + kac(u.aciklama) + '</p>' : '') + '<div class="p-fiyat">' + fiyat(u) + '</div>' + besinBlok(u, true) + mesajDugme('Bunu sor', u.id) + '</div>' +
			'<button class="p-kapat" type="button" data-is="geri" aria-label="Kapat">' + KAPAT + '</button></div>';
		goster(panelEl);
		it({ e: 'urun', id: id, kaynak: kaynak });
		Promise.all([
			oyna($('.panel-arka', panelEl), [{ opacity: 0 }, { opacity: 1 }], 320),
			oyna($('.panel-kutu', panelEl), [{ transform: 'translateY(100%)' }, { transform: 'none' }], 440)
		]).then(function () { odak($('.p-kapat', panelEl)); coz(); });
	}
	function panelKapat(anim) {
		var s = cek();
		function son() { gizle(panelEl); panelEl.innerHTML = ''; odak(s.kaynak); }
		if (!anim) { son(); return; }
		kilitle();
		Promise.all([
			oyna($('.panel-arka', panelEl), [{ opacity: 1 }, { opacity: 0 }], 300, 0, true),
			oyna($('.panel-kutu', panelEl), [{ transform: 'none' }, { transform: 'translateY(100%)' }], 360, 0, true)
		]).then(function () { son(); coz(); });
	}

	/* ---------- tüm menü: basılı menü kâğıdı; bölüm çipleri yapışkan, kaydırdıkça etkin çip işaretlenir ---------- */
	var YAZ = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 7V3h8v4M6 14H3.5V8h13v6H14"/><path d="M6 11.5h8V17H6z"/></svg>';
	var SUS = '<span class="sm-sus" aria-hidden="true"><svg viewBox="0 0 12 14"><path d="M6 1l5 3v6l-5 3-5-3V4z"/></svg></span>';
	var sadeGoz = null, sadeTik = 0;
	/* "Yazdır" düğmesi yalnız işletme sahibine: adres ?yazdir ile açılınca (menü doğrudan "Tüm menü"de açılır) */
	var yazdirKip = /[?&]yazdir(?:[=&]|$)/.test(w.location.search);
	function instaAd(s) { return String(s || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, ''); }
	function sadeCiz() {
		var ki = K.kimlik || {}, op = K.ozelPasta || {}, h = '', bs = bolumler().filter(function (b) { return b.tip === 'galeri' || urunleri(b.id).length; });
		h += '<header class="sm-bas"><button class="geri" type="button" data-is="geri" aria-label="Vitrine dön">' + GERI + '</button>' +
			(ki.logo ? '<img class="sm-logo" src="' + kac(ki.logo) + '" alt="">' : '') +
			'<h1 class="sm-ad" id="sade-ad">' + kac(ki.ad || 'Menü') + '</h1>' + (ki.altAd ? '<p class="sm-alt">' + kac(ki.altAd) + '</p>' : '') + serit() +
			(yazdirKip ? '<button class="sm-yazdir" type="button" data-is="yazdir" aria-label="Menüyü yazdır">' + YAZ + '<span>Yazdır</span></button>' : '') + '</header>';
		h += '<nav class="sm-cipler" aria-label="Bölümler"><div class="sm-cip-ic">' + bs.map(function (b) { return '<button type="button" data-is="git" data-v="' + kac(b.id) + '">' + kac(b.kisaAd || b.ad) + '</button>'; }).join('') + '</div></nav>';
		bs.forEach(function (b) {
			h += '<section class="sm-bolum" id="sade-' + kac(b.id) + '" data-v="' + kac(b.id) + '" aria-labelledby="sb-' + kac(b.id) + '"><h2 id="sb-' + kac(b.id) + '">' + kac(b.ad) + '</h2>' + SUS;
			if (b.tip === 'galeri') { h += (op.aciklama ? '<p class="sm-not">' + kac(op.aciklama) + '</p>' : '') + '<div class="sm-sor">' + mesajDugme('Özel pasta için yaz') + '</div></section>'; return; }
			h += '<ul>' + urunleri(b.id).map(function (u) {
				var f = yok(u) ? '<span class="sm-sor-f">Fiyatını sor</span>' : tutar(u), br = !yok(u) && u.birim ? '<span class="sm-birim">/ ' + kac(u.birim) + '</span>' : '', et = gunEt(u) + tukRozet(u), kc = kcalYazi(u, 'sm-kcal');
				/* kcal ekranda alt satırın sağında; yazdırmada satır sayısı artmasın diye adın yanında (sm-kcal-y) */
				return '<li><button class="sm-urun' + (u.foto ? ' fotolu' : '') + (tukendi(u) ? ' tukendi' : '') + '" type="button" data-is="urun" data-v="' + kac(u.id) + '">' + (u.foto ? foto(u.foto, u.ad, 'sm-foto', true, true) : '') +
					'<span class="sm-govde"><span class="sm-satir"><span class="sm-urun-ad">' + kac(u.ad) + '</span>' + kcalYazi(u, 'sm-kcal-y', true) + '<span class="sm-nokta" aria-hidden="true"></span><span class="sm-fiyat">' + f + '</span></span>' +
					(u.aciklama || br || et || kc ? '<span class="sm-alt2">' + (et ? '<span class="sm-etler">' + et + '</span>' : '') + '<span class="sm-aciklama">' + kac(u.aciklama || '') + '</span>' + br + kc + '</span>' : '') + '</span></button></li>';
			}).join('') + '</ul></section>';
		});
		var ig = instaAd(ki.instagram), tl = String(ki.telefon || '').replace(/[^\d+]/g, '');
		var hr = adresUrl(ki.harita), yr = adresUrl(ki.yorum), yz = [ki.adres, ki.telefon, ig ? '@' + ig : ''].filter(Boolean).join(' · ');
		var baglar = (hr ? '<a class="sm-link" href="' + kac(hr) + '" target="_blank" rel="noopener">Yol tarifi</a>' : '') + (yr ? '<a class="sm-link" href="' + kac(yr) + '" target="_blank" rel="noopener">Google\'da yorum yap</a>' : '') + dilekDugme('sm-link sm-dilek', 'Dilek, öneri, istek');
		var alt = (ki.adres ? '<p>' + kac(ki.adres) + '</p>' : '') + (tl ? '<p><a class="sm-tel" href="tel:' + kac(tl) + '">' + kac(ki.telefon) + '</a></p>' : '') +
			(tel() ? '<a class="sm-wa" href="https://wa.me/' + tel() + '" rel="noopener">WhatsApp\'tan yaz</a>' : '') +
			(ig ? '<p><a class="sm-ig" href="https://www.instagram.com/' + encodeURIComponent(ig) + '/" rel="noopener">Instagram: @' + kac(ig) + '</a></p>' : '');
		h += '<footer class="sm-son">' + SUS + '<p class="sm-son-ad">' + kac(ki.ad || '') + '</p>' + alt + '<div class="sm-baglar">' + baglar + '</div>' + (besinliVar(K.urunler) ? '<p class="sm-besin-not">' + kac(besinNot()) + '</p>' : '') + (yz ?'<p class="sm-yazdir-alt">' + kac(yz) + '</p>' : '') + '</footer>';
		sadeEl.innerHTML = h;
		sadeEl.setAttribute('aria-labelledby', 'sade-ad');
		if (bs[0]) sadeCip(bs[0].id, false);
		if (w.IntersectionObserver) {
			var ust = $('.sm-cipler', sadeEl).offsetHeight || 64;
			sadeGoz = new IntersectionObserver(function (es) {
				if (performance.now() < sadeTik) return;
				var son = null;
				es.forEach(function (e) { if (e.isIntersecting) son = e.target; });
				if (son) sadeCip(son.getAttribute('data-v'), true);
			}, { root: sadeEl, rootMargin: '-' + (ust + 2) + 'px 0px -58% 0px' });
			$$('.sm-bolum', sadeEl).forEach(function (s) { sadeGoz.observe(s); });
		}
	}
	/* etkin çipi işaretle; çip şeridinde ortaya kaydır */
	function sadeCip(id, kaydir) {
		var ic = $('.sm-cip-ic', sadeEl), c = null;
		if (!ic) return;
		$$('button', ic).forEach(function (b) { var e = b.getAttribute('data-v') === id; if (e) c = b; b.classList.toggle('etkin', e); if (e) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
		if (c && kaydir) ic.scrollTo({ left: Math.max(0, c.offsetLeft - (ic.clientWidth - c.offsetWidth) / 2), behavior: azalt ? 'auto' : 'smooth' });
	}
	function sadeGit(id) {
		var s = $('#sade-' + id, sadeEl);
		if (!s) return;
		sadeTik = performance.now() + 900;
		sadeCip(id, true);
		s.scrollIntoView({ behavior: azalt ? 'auto' : 'smooth', block: 'start' });
	}
	function sadeAc(kaynak) {
		if (kilit) return;
		kilitle();
		if (!sadeEl.firstChild) sadeCiz();
		goster(sadeEl); sadeEl.scrollTop = 0;
		it({ e: 'sade', kaynak: kaynak });
		oyna(sadeEl, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], 300).then(function () { odak($('.geri', sadeEl)); coz(); });
	}
	function sadeKapat(anim) {
		var s = cek();
		if (!anim) { gizle(sadeEl); return; }
		kilitle();
		oyna(sadeEl, [{ opacity: 1 }, { opacity: 0 }], 260, 0, true).then(function (a) { gizle(sadeEl); birak(a); odak(s.kaynak); coz(); });
	}

	/* ---------- geçmiş (telefonun geri tuşu); geçmiş kullanılamıyorsa doğrudan kapatılır ---------- */
	var KAPATICI = { bolum: ekranKapat, yap: ekranKapat, yildiz: fotoSovKapat, urun: panelKapat, liste: listeKapat, sade: sadeKapat };
	function esitle() {
		var hedef = (history.state && history.state.d) || 0;
		if (yigin.length > hedef) {
			while (yigin.length > hedef + 1) KAPATICI[yigin[yigin.length - 1].e](false);
			KAPATICI[yigin[yigin.length - 1].e](true);
		} else if (yigin.length < hedef) history.go(yigin.length - hedef);
	}
	function geri() {
		if (kilit || !yigin.length) return;
		if (tarih) history.back(); else KAPATICI[yigin[yigin.length - 1].e](true);
	}

	function olaylar() {
		w.addEventListener('popstate', function () { if (!tarih) return; if (kilit) bekleyen = true; else esitle(); });
		sahne.addEventListener('click', function (e) {
			if ((yut || kilit) && e.target.closest('a[data-is="logo"],a[data-is="dilek"]')) e.preventDefault();
			if (yut) { yut = false; return; }
			var tb = e.target.closest('.dv-tabak');
			if (tb && dv) { if (performance.now() - (dv.isaret || 0) < 500) return; return dvSec(+tb.getAttribute('data-i'), tb); }
			var t = e.target.closest('[data-is]');
			if (!t || kilit) return;
			var is = t.getAttribute('data-is'), v = t.getAttribute('data-v');
			if (is === 'bolum') ekranAc('bolum', v, t.closest('.goze-yer'));
			else if (is === 'yap') ekranAc('yap', 'yap', t.closest('.goze-yer'));
			else if (is === 'logo') { kilitle(); t.classList.add('isilti'); oyna(t, [{ transform: 'scale(1)' }, { transform: 'scale(1.07)', offset: 0.4 }, { transform: 'scale(1)' }], 520).then(function () { t.classList.remove('isilti'); coz(); }); }
			else if (is === 'gunun') { var gu = urunBul(v); if (gu) { if (gu.yildiz && gu.foto) fotoSov(gu, t); else panelAc(gu.id, t); } }
			else if (is === 'dilek') mesajGonder(t, e, dilekMesaj());
			else if (is === 'yazdir') w.print();
			else if (is === 'geri') geri();
			else if (is === 'dv') dvGit((dv.tw ? dv.hedef : dv.merkez) + (+v));
			else if (is === 'liste') listeAc(t);
			else if (is === 'sov') { var u = urunBul(v); if (u) fotoSov(u, t.querySelector('.s-foto')); }
			else if (is === 'urun') panelAc(v, t);
			else if (is === 'iste') mesajGonder(t, e, t.hasAttribute('data-urun') ? urunMesaj(t.getAttribute('data-urun')) : t.closest('#yap') ? ypMesaj() : galeriMesaj());
			else if (is === 'yp') ypSec(t);
			else if (is === 'sade') sadeAc(t);
			else if (is === 'git') sadeGit(v);
		});
		d.addEventListener('keydown', function (e) { if (e.key === 'Escape') geri(); });
		w.addEventListener('beforeprint', function () { if (!sadeEl.firstChild) sadeCiz(); });
		w.addEventListener('resize', function () { if (ariGoze && !kilit) ariKoy(ariGoze); igSigdir(); });
		d.addEventListener('error', function (e) {
			var t = e.target;
			if (t && t.tagName === 'IMG' && t.hasAttribute('data-buyuk')) { var b = t.getAttribute('data-buyuk'); t.removeAttribute('data-buyuk'); t.src = b; return; }
			if (t && t.tagName === 'IMG' && t.hasAttribute('data-yt')) {
				var s = d.createElement('span');
				s.className = t.className + ' yt';
				s.setAttribute('aria-hidden', 'true');
				s.innerHTML = '<span>' + kac(t.getAttribute('data-yt')) + '</span>';
				t.parentNode.replaceChild(s, t);
			}
		}, true);
	}

	w.Menu = {
		baslat: function () {
			K = w.KAFE;
			sahne = $('#sahne');
			if (!K || !sahne) return;
			vitrinEl = $('#vitrin'); perde = $('#perde'); bolumEl = $('#bolum'); yapEl = $('#yap');
			yildizEl = $('#yildiz'); panelEl = $('#panel'); sadeEl = $('#sade'); sadeBtn = $('#sade-dugme');
			[bolumEl, yapEl, yildizEl, panelEl, sadeEl].forEach(gizle);
			if (azalt) d.documentElement.classList.add('azalt');
			tema(); kimlik(); vitrinKur(); saatUygula(); olaylar();
			setInterval(function () { if (!kilit) saatUygula(); }, 60000);
			try { history.replaceState({ d: 0 }, ''); } catch (e) { tarih = false; }
			sahne.classList.remove('yukleniyor');
			if (yazdirKip) {
				/* sahibin yazdırma adresi: açılış animasyonu yok, sade liste doğrudan açık; geri tuşu vitrine döner */
				ariKoy($('.goze-yer-logo', vitrinEl));
				sadeCiz(); goster(sadeEl); it({ e: 'sade', kaynak: sadeBtn });
				odak($('.sm-yazdir', sadeEl));
			} else acilis();
		}
	};
})(window, document);
