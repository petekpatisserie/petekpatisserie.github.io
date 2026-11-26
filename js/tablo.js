/* js/tablo.js — Fiyat tablosu modülü (Google E-Tablolar "Web'de yayınla -> CSV" -> menü verisi)
   Menu.baslat() çağrılmadan ÖNCE Tablo.uygula(KAFE) çalıştırılır: CSV okunur, KAFE.urunler ve KAFE.gununUrunu
   tablodaki hale getirilir. Tablo okunamazsa sırayla cihazdaki son başarılı kopya, o da yoksa veri dosyası kullanılır.
   Modül hata fırlatmaz, Promise her zaman çözülür, ekrana hiçbir şey basmaz (uyarılar yalnız console.warn "[tablo]").
   Dışa açık tek nesne: window.Tablo = { uygula, coz, csv, sayi, sablon }. Kütüphane, import/export, ?. ve ?? yoktur. */
(function (global) {
  'use strict';

  var MIN_SATIR = 3;            // bundan az geçerli satır varsa tablo tamamen yok sayılır
  var FIYAT_MAKS = 100000;
  var AD_MAKS = 80;
  var ACIKLAMA_MAKS = 200;
  var BIRIM_MAKS = 20;
  var KOD_MAKS = 80;
  var VARSAYILAN_ZAMAN = 4000;
  var CSV_MAKS = 500000;        // karakter; bundan büyük metin tablo sayılmaz
  var VARSAYILAN_ANAHTAR = 'menu-tablo';

  var BASLIK = ['Bölüm', 'Ürün adı', 'Açıklama', 'Fiyat', 'Birim', 'Durum', 'Günün ürünü', 'Kod'];

  // Başlık eşleşmesi: harf/boşluk/noktalama farkı önemsiz (bkz. basligaCevir)
  var SUTUN_TAKMA = {
    bolum: ['bolum', 'kategori'],
    ad: ['urunadi', 'urun', 'urunismi'],
    aciklama: ['aciklama'],
    fiyat: ['fiyat', 'fiyati'],
    birim: ['birim'],
    durum: ['durum', 'stok'],
    gunun: ['gununurunu', 'gununurun', 'gunun'],
    kod: ['kod', 'urunkodu', 'id']
  };

  var TR_HARITA = {
    'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'â': 'a', 'î': 'i', 'û': 'u',
    'Ç': 'c', 'Ğ': 'g', 'İ': 'i', 'I': 'i', 'Ö': 'o', 'Ş': 's', 'Ü': 'u', 'Â': 'a', 'Î': 'i', 'Û': 'u'
  };

  /* ---------- küçük yardımcılar ---------- */

  function harita() { return Object.create(null); }

  function simdi() { return new Date().getTime(); }

  function mesaj(e) {
    try {
      if (e && e.name === 'AbortError') return 'istek iptal edildi';
      return (e && e.message) ? String(e.message) : String(e);
    } catch (x) { return 'bilinmeyen hata'; }
  }

  // Türkçe harfleri sadeleştirir, küçültür: "ÇİKOLATALI" -> "cikolatali"
  function sade(s) {
    s = String(s == null ? '' : s);
    s = s.replace(/[çğıöşüâîûÇĞİIÖŞÜÂÎÛ]/g, function (c) { return TR_HARITA[c]; });
    s = s.toLowerCase();
    if (typeof s.normalize === 'function') {
      try { s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { /* eski tarayıcı */ }
    }
    return s;
  }

  // Eşleştirme anahtarı: harf, boşluk, "-" ve "_" farkı önemsiz
  function norm(s) {
    s = String(s == null ? '' : s).replace(/[\u200b-\u200f\u2060\ufeff]/g, '');
    return sade(s).replace(/[\s_\-\u2010-\u2015]+/g, ' ').replace(/^ +| +$/g, '');
  }

  // Başlık anahtarı: yalnız a-z0-9 kalır ("Ürün Adı" -> "urunadi")
  function basligaCevir(s) {
    return sade(s).replace(/[^a-z0-9]/g, '');
  }

  // Denetim karakterlerini temizler, boşlukları toplar, sınırlar (metni olduğu gibi bırakır, etiket eklemez)
  function temizle(s, maks) {
    s = String(s == null ? '' : s);
    s = s.replace(/[\u200b-\u200f\u2060\ufeff\u202a-\u202e]/g, '');
    s = s.replace(/[\u0000-\u001f\u007f-\u009f\u00a0\u2028\u2029]/g, ' ');
    s = s.replace(/ {2,}/g, ' ').replace(/^ +| +$/g, '');
    if (s.length > maks) {
      s = s.slice(0, maks);
      var son = s.charCodeAt(s.length - 1);
      if (son >= 0xD800 && son <= 0xDBFF) s = s.slice(0, s.length - 1); // yarım emoji bırakma
      s = s.replace(/ +$/, '');
    }
    return s;
  }

  function satirBos(satir) {
    if (!satir) return true;
    for (var i = 0; i < satir.length; i++) {
      if (String(satir[i] == null ? '' : satir[i]).replace(/^\s+|\s+$/g, '') !== '') return false;
    }
    return true;
  }

  function hucre(satir, idx) {
    if (idx < 0 || !satir || idx >= satir.length || satir[idx] == null) return '';
    return String(satir[idx]);
  }

  /* ---------- CSV ayrıştırıcı ---------- */

  function csvIc(metin) {
    var s = String(metin == null ? '' : metin);
    if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
    var satirlar = [];
    var satir = [];
    var alan = '';
    var tirnakta = false;
    var alanBasi = true;
    var n = s.length;
    var i = 0;
    var c;
    while (i < n) {
      c = s.charAt(i);
      if (tirnakta) {
        if (c === '"') {
          if (s.charAt(i + 1) === '"') { alan += '"'; i += 2; continue; }
          tirnakta = false; i++; continue;
        }
        if (c === '\r') {                       // tırnak içi satır sonu tek "\n" olur
          alan += '\n';
          if (s.charAt(i + 1) === '\n') i++;
          i++; continue;
        }
        alan += c; i++; continue;
      }
      if (c === '"' && alanBasi) { tirnakta = true; alanBasi = false; i++; continue; }
      if (c === ',') { satir.push(alan); alan = ''; alanBasi = true; i++; continue; }
      if (c === '\r' || c === '\n') {
        satir.push(alan);
        satirlar.push(satir);
        satir = []; alan = ''; alanBasi = true;
        if (c === '\r' && s.charAt(i + 1) === '\n') i++;
        i++; continue;
      }
      alan += c; alanBasi = false; i++;
    }
    if (alan !== '' || satir.length > 0) {
      satir.push(alan);
      satirlar.push(satir);
    }
    while (satirlar.length > 0 && satirBos(satirlar[satirlar.length - 1])) satirlar.pop();
    return satirlar;
  }

  function csv(metin) {
    try { return csvIc(metin); } catch (e) { return []; }
  }

  /* ---------- fiyat çevirici ---------- */

  function binlikGecerli(str, ayrac) {
    var g = str.split(ayrac);
    if (!/^[0-9]{1,3}$/.test(g[0])) return false;
    for (var i = 1; i < g.length; i++) {
      if (!/^[0-9]{3}$/.test(g[i])) return false;
    }
    return true;
  }

  function aralikli(n) {
    if (typeof n !== 'number' || !isFinite(n)) return null;
    n = Math.round(n * 100) / 100;
    if (n <= 0 || n > FIYAT_MAKS) return null;
    return n;
  }

  function sayi(metin) {
    try {
      if (typeof metin === 'number') return aralikli(metin);
      var s = String(metin == null ? '' : metin);
      s = s.replace(/[\u200b-\u200f\ufeff]/g, '');
      s = s.replace(/₺|tl|try|lira/gi, '');
      s = s.replace(/[\s\u00a0\u202f]+/g, '');
      s = s.replace(/([0-9])[.,]?[-\u2013\u2014]+$/, '$1');      // "310,-" gibi yazımlar
      var m = /^([+-]?)([0-9.,]+)$/.exec(s);
      if (!m || m[1] === '-') return null;
      s = m[2];
      var nokta = s.split('.').length - 1;
      var virgul = s.split(',').length - 1;
      var tam = '';
      var kesir = '';
      var p;
      if (nokta > 0 && virgul > 0) {
        var ondalik = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
        var binlik = ondalik === '.' ? ',' : '.';
        p = s.split(ondalik);
        if (p.length !== 2) return null;
        if (!binlikGecerli(p[0], binlik)) return null;
        tam = p[0].split(binlik).join('');
        kesir = p[1];
      } else if (virgul > 0) {
        p = s.split(',');
        if (p.length === 2) {                      // tek virgül: ondalık (Türkçe yazım)
          tam = p[0]; kesir = p[1];
        } else {                                   // çok virgül: binlik (1,250,000)
          if (!binlikGecerli(s, ',')) return null;
          tam = p.join('');
        }
      } else if (nokta > 0) {
        p = s.split('.');
        if (p.length === 2) {
          if (p[1].length === 3 && p[0] !== '0' && /^[0-9]{1,3}$/.test(p[0])) {
            tam = p[0] + p[1];                     // "1.250" -> 1250 (binlik)
          } else {
            tam = p[0]; kesir = p[1];              // "310.50" -> 310,5 (ondalık)
          }
        } else {
          if (!binlikGecerli(s, '.')) return null; // "1.250.000"
          tam = p.join('');
        }
      } else {
        tam = s;
      }
      if (!/^[0-9]*$/.test(tam) || !/^[0-9]*$/.test(kesir)) return null;
      if (tam === '' && kesir === '') return null;
      return aralikli(parseFloat((tam === '' ? '0' : tam) + (kesir === '' ? '' : '.' + kesir)));
    } catch (e) {
      return null;
    }
  }

  /* ---------- tablo hücrelerini yorumlama ---------- */

  function bosFiyat(metin) {
    var k = norm(metin);
    return k === '' || /^[\u2013\u2014\-\. ]*$/.test(k) || k === 'fiyatini sor' || k === 'sor';
  }

  function durumCoz(metin) {
    var k = norm(metin);
    if (k === '' || k === 'var' || k === 'mevcut' || k === 'stokta') return 'var';
    if (k.indexOf('gizl') === 0 || k === 'sakla') return 'gizle';
    if (k.indexOf('tuken') === 0 || k.indexOf('bitti') === 0 || k === 'yok' || k === 'stokta yok') return 'tukendi';
    return null;
  }

  var HAYIR = { 'false': 1, '0': 1, 'hayir': 1, 'h': 1, 'no': 1, 'n': 1, 'yok': 1, '-': 1, 'bos': 1 };

  // "evet", "x", "✓", "TRUE", "1" gibi dolu değer = işaretli; boş ya da FALSE/0/hayır = işaretsiz
  function isaretli(metin) {
    var k = norm(metin);
    if (k === '') return false;
    return !(k in HAYIR);
  }

  function sutunlariBul(baslik) {
    var kol = {};
    var anahtarlar = [];
    var i;
    for (i = 0; i < baslik.length; i++) anahtarlar.push(basligaCevir(baslik[i]));
    for (var ad in SUTUN_TAKMA) {
      if (!Object.prototype.hasOwnProperty.call(SUTUN_TAKMA, ad)) continue;
      kol[ad] = -1;
      for (i = 0; i < anahtarlar.length && kol[ad] < 0; i++) {
        if (anahtarlar[i] !== '' && SUTUN_TAKMA[ad].indexOf(anahtarlar[i]) >= 0) kol[ad] = i;
      }
    }
    return kol;
  }

  function yeniId(ad, kullanilan) {
    var taban = sade(ad).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '');
    if (!taban) taban = 'urun';
    var id = taban;
    var n = 2;
    while (id in kullanilan) { id = taban + '-' + n; n++; }
    kullanilan[id] = true;
    return id;
  }

  /* ---------- Tablo.coz: CSV metni + mevcut KAFE -> yeni ürün listesi ---------- */

  function cozIc(csvMetni, K) {
    var uyarilar = [];
    var eskiler = (K && Array.isArray(K.urunler)) ? K.urunler : [];
    var eskiGun = (K && K.gununUrunu) ? K.gununUrunu : null;

    function gecersiz(neden) {
      uyarilar.push(neden);
      return { urunler: eskiler.slice(), gununUrunu: eskiGun, uyarilar: uyarilar, gecerli: false };
    }

    var metin = (csvMetni == null) ? '' : String(csvMetni);
    if (metin.length > CSV_MAKS) return gecersiz('Tablo metni çok büyük, yok sayıldı.');
    if (/^[\s\ufeff]*<(!doctype|html|head|body|\?xml)/i.test(metin)) {
      return gecersiz('Tablo yerine bir web sayfası (HTML) döndü; bağlantı yayınlanmamış olabilir.');
    }

    var satirlar = csv(metin);
    var bi = -1;
    var i;
    for (i = 0; i < satirlar.length; i++) {
      if (!satirBos(satirlar[i])) { bi = i; break; }
    }
    if (bi < 0) return gecersiz('Tablo boş.');

    var kol = sutunlariBul(satirlar[bi]);
    if (kol.ad < 0 || kol.bolum < 0) {
      return gecersiz('Başlık satırında "Ürün adı" ve/veya "Bölüm" sütunu bulunamadı.');
    }
    var eksik = [];
    if (kol.aciklama < 0) eksik.push('Açıklama');
    if (kol.fiyat < 0) eksik.push('Fiyat');
    if (kol.birim < 0) eksik.push('Birim');
    if (eksik.length > 0) {
      uyarilar.push('Sütun bulunamadı: ' + eksik.join(', ') + '. Bu alanlar için veri dosyasındaki değerler korunur.');
    }

    // bölüm adı / kısa ad / id -> bölüm id (galeri tipli bölüm hariç)
    var bolumHarita = harita();
    var galeriHarita = harita();
    var bl = (K && Array.isArray(K.bolumler)) ? K.bolumler : [];
    var alanlar = ['ad', 'kisaAd', 'id'];
    var a, b, k;
    for (a = 0; a < alanlar.length; a++) {
      for (i = 0; i < bl.length; i++) {
        b = bl[i];
        if (!b || b.tip === 'galeri') continue;
        k = norm(b[alanlar[a]]);
        if (k !== '' && !(k in bolumHarita)) bolumHarita[k] = b.id;
      }
    }
    for (i = 0; i < bl.length; i++) {
      b = bl[i];
      if (b && b.tip === 'galeri') {
        galeriHarita[norm(b.ad)] = true;
        galeriHarita[norm(b.id)] = true;
      }
    }

    // mevcut ürün dizinleri
    var idHarita = harita();
    var idNormHarita = harita();
    var adHarita = harita();
    var tumId = harita();
    var e;
    for (i = 0; i < eskiler.length; i++) {
      e = eskiler[i];
      if (!e || e.id == null || String(e.id) === '') continue;
      var eid = String(e.id);
      tumId[eid] = true;
      if (!(eid in idHarita)) idHarita[eid] = e;
      k = norm(eid);
      if (!(k in idNormHarita)) idNormHarita[k] = e;
      k = norm(e.ad);
      if (k !== '' && !(k in adHarita)) adHarita[k] = e;
    }

    var sonuc = [];
    var kullanilan = harita();   // eşleşen mevcut ürün id'leri
    var gorulenAd = harita();
    var gecerliSatir = 0;
    var gun = null;

    for (i = bi + 1; i < satirlar.length; i++) {
      var r = satirlar[i];
      if (satirBos(r)) continue;
      var no = i + 1;
      var ad = temizle(hucre(r, kol.ad), AD_MAKS);
      if (ad === '') { uyarilar.push('Satır ' + no + ': ürün adı boş, satır atlandı.'); continue; }
      var etiket = 'Satır ' + no + ' ("' + ad + '")';

      var hamBolum = hucre(r, kol.bolum);
      var bk = norm(hamBolum);
      if (!(bk in bolumHarita)) {
        if (bk !== '' && (bk in galeriHarita)) uyarilar.push(etiket + ': galeri bölümüne ürün eklenemez, satır atlandı.');
        else uyarilar.push(etiket + ': bölüm tanınmadı ("' + temizle(hamBolum, 40) + '"), satır atlandı.');
        continue;
      }
      var bid = bolumHarita[bk];

      // eşleştirme: önce Kod, sonra ad
      var kod = temizle(hucre(r, kol.kod), KOD_MAKS);
      var adAnahtar = norm(ad);
      var eski = null;
      if (kod !== '') {
        if (kod in idHarita) eski = idHarita[kod];
        else {
          var kn = norm(kod);
          if (kn in idNormHarita) eski = idNormHarita[kn];
        }
      }
      if (eski) {
        if (String(eski.id) in kullanilan) {
          uyarilar.push(etiket + ': aynı Kod ikinci kez geçiyor, satır atlandı (ilki geçerli).');
          continue;
        }
      } else {
        if (adAnahtar in gorulenAd) {
          uyarilar.push(etiket + ': aynı ürün adı ikinci kez geçiyor, satır atlandı (ilki geçerli).');
          continue;
        }
        if (adAnahtar in adHarita) {
          var aday = adHarita[adAnahtar];
          if (!(String(aday.id) in kullanilan)) eski = aday;
        }
      }
      gorulenAd[adAnahtar] = true;
      if (eski) kullanilan[String(eski.id)] = true;
      gecerliSatir++;

      var durum = durumCoz(hucre(r, kol.durum));
      if (durum === null) {
        uyarilar.push(etiket + ': Durum anlaşılamadı ("' + temizle(hucre(r, kol.durum), 30) + '"), "Var" sayıldı.');
        durum = 'var';
      }
      var gunIsareti = (kol.gunun >= 0) && isaretli(hucre(r, kol.gunun));

      if (durum === 'gizle') {
        if (gunIsareti) uyarilar.push(etiket + ': gizli ürün günün ürünü olamaz.');
        continue;
      }

      var aciklama;
      if (kol.aciklama >= 0) aciklama = temizle(hucre(r, kol.aciklama), ACIKLAMA_MAKS);
      else aciklama = (eski && eski.aciklama != null) ? eski.aciklama : '';

      var birim;
      if (kol.birim >= 0) birim = temizle(hucre(r, kol.birim), BIRIM_MAKS);
      else birim = (eski && eski.birim != null) ? eski.birim : '';

      var fiyat = null;
      if (kol.fiyat >= 0) {
        var hamFiyat = hucre(r, kol.fiyat);
        if (!bosFiyat(hamFiyat)) {
          fiyat = sayi(hamFiyat);
          if (fiyat === null) {
            uyarilar.push(etiket + ': fiyat anlaşılamadı ya da 0–100.000 aralığı dışında ("' + temizle(hamFiyat, 30) + '"), "Fiyatını sor" gösterilecek.');
          }
        }
      } else if (eski && typeof eski.fiyat === 'number') {
        fiyat = eski.fiyat;
      }

      var u;
      if (eski) {
        u = {};
        for (var anahtar in eski) {
          if (Object.prototype.hasOwnProperty.call(eski, anahtar)) u[anahtar] = eski[anahtar];
        }
        if (!('foto' in u)) u.foto = null;
        if (!('yildiz' in u)) u.yildiz = false;
        u.bolum = bid;
        u.ad = ad;
        u.aciklama = aciklama;
        u.fiyat = fiyat;
        u.birim = birim;
        u.tukendi = (durum === 'tukendi');
      } else {
        u = {
          id: yeniId(ad, tumId),
          bolum: bid,
          ad: ad,
          aciklama: aciklama,
          fiyat: fiyat,
          birim: birim,
          foto: null,
          yildiz: false,
          tukendi: (durum === 'tukendi')
        };
      }
      sonuc.push(u);

      if (gunIsareti) {
        if (durum === 'tukendi') uyarilar.push(etiket + ': tükendi ürün günün ürünü olamaz.');
        else if (gun === null) gun = u.id;
        else uyarilar.push(etiket + ': birden çok ürün günün ürünü işaretli, ilki geçerli.');
      }
    }

    if (gecerliSatir < MIN_SATIR) {
      return gecersiz('Tabloda geçerli ürün satırı çok az (' + gecerliSatir + ' < ' + MIN_SATIR + '), tablo yok sayıldı.');
    }
    if (sonuc.length === 0) {
      return gecersiz('Tablodaki tüm ürünler gizli; menü boş kalacağı için tablo yok sayıldı.');
    }
    return { urunler: sonuc, gununUrunu: gun, uyarilar: uyarilar, gecerli: true };
  }

  function coz(csvMetni, K) {
    try {
      return cozIc(csvMetni, K);
    } catch (e) {
      return {
        urunler: (K && Array.isArray(K.urunler)) ? K.urunler.slice() : [],
        gununUrunu: (K && K.gununUrunu) ? K.gununUrunu : null,
        uyarilar: ['Tablo çözülürken beklenmeyen hata: ' + mesaj(e)],
        gecerli: false
      };
    }
  }

  /* ---------- Tablo.sablon: mevcut KAFE'den başlangıç CSV'si ---------- */

  function csvHucre(v) {
    var s = (v == null) ? '' : String(v);
    if (/[",\r\n]/.test(s) || /^\s|\s$/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function fiyatYaz(f) {
    if (typeof f !== 'number' || !isFinite(f)) return '';
    var s = String(f);
    if (s.indexOf('.') >= 0) s = s.replace('.', ',');   // Türkçe E-Tablo yerelinde ondalık virgüldür
    return s;
  }

  function sablon(K) {
    try {
      var satirlar = [];
      var i;
      var bl = (K && Array.isArray(K.bolumler)) ? K.bolumler : [];
      var adlar = harita();
      var galeri = harita();
      for (i = 0; i < bl.length; i++) {
        if (!bl[i]) continue;
        if (bl[i].tip === 'galeri') galeri[String(bl[i].id)] = true;
        else adlar[String(bl[i].id)] = (bl[i].ad != null && bl[i].ad !== '') ? bl[i].ad : bl[i].id;
      }
      var hucreler = [];
      for (i = 0; i < BASLIK.length; i++) hucreler.push(csvHucre(BASLIK[i]));
      satirlar.push(hucreler.join(','));
      var us = (K && Array.isArray(K.urunler)) ? K.urunler : [];
      for (i = 0; i < us.length; i++) {
        var u = us[i];
        if (!u || (String(u.bolum) in galeri)) continue;
        var bAd = (String(u.bolum) in adlar) ? adlar[String(u.bolum)] : u.bolum;
        satirlar.push([
          csvHucre(bAd),
          csvHucre(u.ad),
          csvHucre(u.aciklama),
          csvHucre(fiyatYaz(u.fiyat)),
          csvHucre(u.birim),
          csvHucre('Var'),
          csvHucre(''),
          csvHucre(u.id)
        ].join(','));
      }
      return satirlar.join('\r\n') + '\r\n';
    } catch (e) {
      return BASLIK.join(',') + '\r\n';
    }
  }

  /* ---------- önbellek (localStorage; hata verirse sessizce geçilir) ---------- */

  function onbellekOku(a) {
    try {
      var ham = global.localStorage.getItem(a.anahtar);
      if (!ham) return null;
      var kayit = JSON.parse(ham);
      if (kayit && typeof kayit.csv === 'string' && kayit.u === a.url) return kayit.csv;
    } catch (e) { /* gizli sekme vb. */ }
    return null;
  }

  function onbellekYaz(a, metin) {
    try {
      global.localStorage.setItem(a.anahtar, JSON.stringify({ s: 1, u: a.url, t: simdi(), csv: metin }));
    } catch (e) { /* kota / gizli sekme */ }
  }

  /* ---------- Tablo.uygula ---------- */

  function ayarCoz(K, ayar) {
    var t = ayar || (K && K.tablo) || null;
    if (!t || typeof t !== 'object') return null;
    var url = (typeof t.url === 'string') ? t.url.replace(/^\s+|\s+$/g, '') : '';
    var ms = Number(t.zamanAsimi);
    if (!(ms > 0)) ms = VARSAYILAN_ZAMAN;
    return {
      url: url,
      ms: ms,
      anahtar: t.onbellekAnahtari ? String(t.onbellekAnahtari) : VARSAYILAN_ANAHTAR,
      atla: t.onbellekAtla !== false
    };
  }

  function urunSayisi(K) {
    return (K && Array.isArray(K.urunler)) ? K.urunler.length : 0;
  }

  function sonucYap(kaynak, K, asil, uyarilar, t0) {
    var simdiki = (K && Array.isArray(K.urunler)) ? K.urunler : [];
    var eskiId = harita();
    var yeniIdler = harita();
    var eklenen = [];
    var cikan = [];
    var i;
    for (i = 0; i < asil.length; i++) if (asil[i] && asil[i].id != null) eskiId[String(asil[i].id)] = true;
    for (i = 0; i < simdiki.length; i++) {
      if (simdiki[i] && simdiki[i].id != null) {
        yeniIdler[String(simdiki[i].id)] = true;
        if (!(String(simdiki[i].id) in eskiId)) eklenen.push(simdiki[i].id);
      }
    }
    for (i = 0; i < asil.length; i++) {
      if (asil[i] && asil[i].id != null && !(String(asil[i].id) in yeniIdler)) cikan.push(asil[i].id);
    }
    return {
      kaynak: kaynak,
      urunSayisi: simdiki.length,
      eklenen: eklenen,
      cikan: cikan,
      uyarilar: uyarilar.slice(),
      sureMs: simdi() - t0
    };
  }

  function uyariYaz(uyarilar) {
    try {
      if (!global.console || typeof global.console.warn !== 'function') return;
      for (var i = 0; i < uyarilar.length; i++) global.console.warn('[tablo] ' + uyarilar[i]);
    } catch (e) { /* konsol yoksa sorun değil */ }
  }

  function uygula(K, ayar) {
    var t0 = simdi();
    return new Promise(function (tamam) {
      var bitti = false;
      var zamanlayici = null;
      var ctl = null;
      var asil = [];
      var uyarilar = [];
      var a = null;

      function bitir(kaynak) {
        if (bitti) return;
        bitti = true;
        if (zamanlayici) clearTimeout(zamanlayici);
        var s;
        try {
          s = sonucYap(kaynak, K, asil, uyarilar, t0);
        } catch (e) {
          s = { kaynak: 'dosya', urunSayisi: urunSayisi(K), eklenen: [], cikan: [], uyarilar: uyarilar.slice(), sureMs: simdi() - t0 };
        }
        uyariYaz(uyarilar);
        tamam(s);
      }

      // Tablo kullanılamadı: önce cihazdaki son başarılı kopya, yoksa veri dosyası (K'ya dokunulmaz)
      function yedekle() {
        if (bitti) return;
        var kaynak = 'dosya';
        try {
          var kayit = onbellekOku(a);
          if (kayit !== null) {
            var c = coz(kayit, K);
            if (c.gecerli) {
              K.urunler = c.urunler;
              K.gununUrunu = c.gununUrunu;
              uyarilar.push('Önbellekteki son başarılı tablo kullanıldı.');
              kaynak = 'onbellek';
            }
          }
        } catch (e) { /* sessizce geç */ }
        bitir(kaynak);
      }

      function basari(metin) {
        if (bitti) return;                       // zaman aşımından sonra gelen cevap yok sayılır
        try {
          var c = coz(metin, K);
          for (var i = 0; i < c.uyarilar.length; i++) uyarilar.push(c.uyarilar[i]);
          if (!c.gecerli) {
            uyarilar.push('Tablo yok sayıldı.');
            yedekle();
            return;
          }
          K.urunler = c.urunler;
          K.gununUrunu = c.gununUrunu;
          onbellekYaz(a, metin);
          bitir('tablo');
        } catch (e) {
          uyarilar.push('Tablo uygulanırken beklenmeyen hata: ' + mesaj(e));
          yedekle();
        }
      }

      function hata(e) {
        if (bitti) return;
        uyarilar.push('Tablo okunamadı: ' + mesaj(e));
        yedekle();
      }

      try {
        a = ayarCoz(K, ayar);
        if (!K || typeof K !== 'object' || !a || a.url === '') {
          bitti = true;
          tamam({ kaynak: 'dosya', urunSayisi: urunSayisi(K), eklenen: [], cikan: [], uyarilar: [], sureMs: 0 });
          return;
        }
        asil = Array.isArray(K.urunler) ? K.urunler.slice() : [];

        zamanlayici = setTimeout(function () {
          if (bitti) return;
          uyarilar.push('Tablo ' + a.ms + ' ms içinde gelmedi (zaman aşımı).');
          yedekle();
          try { if (ctl) ctl.abort(); } catch (x) { /* önemsiz */ }
        }, a.ms);

        var adres = a.url;
        if (a.atla) adres += (adres.indexOf('?') < 0 ? '?' : '&') + '_t=' + simdi();
        var secenek = { cache: 'no-store', credentials: 'omit', mode: 'cors' };
        if (typeof global.AbortController === 'function') {
          ctl = new global.AbortController();
          secenek.signal = ctl.signal;
        }
        global.fetch(adres, secenek).then(function (r) {
          if (!r || !r.ok) throw new Error('HTTP ' + (r ? r.status : '?'));
          return r.text();
        }).then(basari, hata);
      } catch (e) {
        uyarilar.push('Tablo başlatılamadı: ' + mesaj(e));
        yedekle();
      }
    });
  }

  global.Tablo = {
    uygula: uygula,
    coz: coz,
    csv: csv,
    sayi: sayi,
    sablon: sablon
  };
})(typeof window !== 'undefined' ? window : this);