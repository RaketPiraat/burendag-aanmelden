// Scherm Kas: vier saldi, het kasboek (nieuwste eerst, met filters) en de kascontrole.
// De kascontrole is een directe handeling (beheerKascontrole): de pagina toont het oordeel van het achterwerk en leest daarna opnieuw.
// Het verwachte saldo staat nooit in het kaartje van de kascontrole: de controleur typt eerst wat de bank zegt.
// Vereist app.js (registreerScherm, el, euro, maakIcoon, beheerApp, naarInloggen_, heeftRecht) en api.js (beheerVerzoek).

var KAS_PAGINA = 30;
var KAS_MAANDEN = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
var KAS_FILTERS = [
  { id: 'alles', tekst: 'Alles' },
  { id: 'bonnen', tekst: 'Bonnen' },
  { id: 'bank', tekst: 'Bank' },
  { id: 'terug', tekst: 'Terug te betalen' }
];
var KAS_CATEGORIEEN = {
  eten: 'Eten', drinken: 'Drinken', huur: 'Huur', materiaal: 'Materiaal', activiteiten: 'Activiteiten',
  communicatie: 'Communicatie', overig: 'Overig', contant: 'Contant'
};
var KAS_ICOON_CONTROLE = '<path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>';
var KAS_GEEN_VERBINDING = 'Geen verbinding. Probeer het zo nog eens.';

// Wat er getypt is en gekozen blijft bewaard zolang de pagina openstaat (ook bij bijwerken en even naar een ander scherm).
var kasStaat = { email: '', filter: 'alles', toon: KAS_PAGINA, bedrag: '', bezig: false, uitslag: null, focusTerug: false };
var kasVak = null;   // { wortel, tegels, chips, lijst, paneel, paneelSoort } van het getekende scherm
var kasApp = null;   // de laatste staat van de schil (herlees, momentopname)
// De foto van een bon: welke bon er nu wordt opgehaald, de pdf-links die klaarstaan (blob-adressen) en de open foto.
var kasFoto = { bezigId: '', pdf: {}, melding: '', overlay: null, url: '', toets: null, terug: '' };
var KAS_MAX_PDF_LINKS = 5;

function kasVergeetBijAnder_(email) {
  if (kasStaat.email === email) return;
  kasVergeet();
  kasStaat = { email: email, filter: 'alles', toon: KAS_PAGINA, bedrag: '', bezig: false, uitslag: null, focusTerug: false };
}

function kasDatum_(datum) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(datum || ''));
  return m ? Number(m[3]) + ' ' + KAS_MAANDEN[Number(m[2]) - 1] : '';
}

function kasHoofdletter_(t) {
  var s = String(t === null || t === undefined ? '' : t).trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Alleen https-adressen worden een link (nooit javascript: of data:).
function kasVeiligeUrl_(url) {
  return typeof url === 'string' && /^https:\/\/(drive|docs)\.google\.com\//i.test(url.trim()) ? url.trim() : '';
}

function kasCategorieTekst_(regel) {
  if (regel.bron === 'bank') return 'Bank';
  var c = String(regel.categorie || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(KAS_CATEGORIEEN, c) ? KAS_CATEGORIEEN[c] : kasHoofdletter_(c);
}

function kasStatusLabel_(status) {
  var s = String(status || '').trim().toLowerCase();
  if (s === 'terug te betalen') return { tekst: 'Terug te betalen', klasse: 'label label-geel' };
  if (s === 'terugbetaald') return { tekst: 'Terugbetaald', klasse: 'label' };
  if (s === 'geboekt') return { tekst: 'Geboekt', klasse: 'label' };
  return s === '' ? null : { tekst: kasHoofdletter_(s), klasse: 'label' };
}

// De regels van het kasboek, nieuwste eerst (bij dezelfde datum staat wat later is toegevoegd bovenaan).
function kasRegels_(kas) {
  var lijst = kas && Array.isArray(kas.kasboek) ? kas.kasboek : [];
  return lijst.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) {
    var x = String(a.r.datum || ''), y = String(b.r.datum || '');
    if (x === y) return b.i - a.i;
    return x < y ? 1 : -1;
  }).map(function (p) { return p.r; });
}

// Eigen bonnen die de server nog moet verwerken (of die nog in de wachtrij van deze telefoon staan).
function kasWachtend_(m) {
  return ((m && m.mijnOpdrachten) || []).filter(function (o) {
    return o.type === 'bonIndienen' && (o.status === 'nieuw' || o.status === 'onderweg') && o.gegevens && typeof o.gegevens === 'object';
  });
}

function kasPastBijFilter_(regel, filter) {
  if (filter === 'bonnen') return regel.bron === 'bon';
  if (filter === 'bank') return regel.bron === 'bank';
  if (filter === 'terug') return String(regel.status || '').trim().toLowerCase() === 'terug te betalen';
  return true;
}

// ---- onderdelen ----

function kasTegel_(label, waarde, sub) {
  return el('div', { class: 'kaart tegel' },
    el('span', { class: 'tegel-label' }, label),
    el('span', { class: 'tegel-waarde' }, waarde),
    el('span', { class: 'tegel-sub' }, sub));
}

function kasTekenTegels_(kas) {
  var s = kas && kas.saldi ? kas.saldi : {};
  var tegels = [
    s.verwachtBanksaldo === null || s.verwachtBanksaldo === undefined
      ? kasTegel_('Verwacht op de bank', 'Zichtbaar na de kascontrole', 'Zo tel je het saldo zelf na')
      : kasTegel_('Verwacht op de bank', euro(s.verwachtBanksaldo), 'Moet gelijk zijn aan wat de bank zegt'),
    kasTegel_('Contant in kas', euro(s.contant), 'Geld in contanten bij de commissie'),
    kasTegel_('Voorgeschoten door commissie', euro(s.voorgeschoten), 'Bonnen die nog terugbetaald moeten worden'),
    kasTegel_('Terug te betalen aan buren', euro(s.terugAanBuren), 'Geld dat buren nog terugkrijgen')
  ];
  kasVak.tegels.replaceChildren.apply(kasVak.tegels, tegels);
}

function kasBedragTekst_(regel) {
  var netto = (Number(regel.inCenten) || 0) - (Number(regel.uitCenten) || 0);
  if (netto > 0) return { tekst: '+ ' + euro(netto), klasse: 'kasrij-bedrag kasrij-plus' };
  if (netto < 0) return { tekst: '− ' + euro(-netto), klasse: 'kasrij-bedrag' };
  return { tekst: euro(0), klasse: 'kasrij-bedrag' };
}

// ---- foto van de bon ----
// De pagina vraagt de foto bij het achterwerk (beheerBonFoto, alleen met het kas-id) en toont hem hier in de pagina:
// de map met bonnen is niet meer gedeeld, dus een Drive-link zou niemand openen.

function kasMeldFoto_(tekst) {
  kasFoto.melding = tekst || '';
  if (!kasVak || !kasVak.fotoMelding) return;
  kasVak.fotoMelding.textContent = kasFoto.melding;
  kasVak.fotoMelding.hidden = kasFoto.melding === '';
}

function kasBonKnop_(regel) {
  var pdf = kasFoto.pdf[regel.id];
  if (pdf) return el('a', { class: 'kasrij-link', href: pdf, target: '_blank', rel: 'noopener noreferrer' }, 'Open de bon (pdf)');
  var bezig = kasFoto.bezigId === regel.id;
  return el('button', {
    type: 'button', class: 'kasrij-link kasrij-knop', 'data-kas-id': regel.id, disabled: kasFoto.bezigId !== '', 'aria-busy': bezig ? 'true' : null,
    onclick: function (e) { kasHaalFoto_(regel); }
  }, bezig ? 'Bon ophalen…' : 'Bon bekijken');
}

function kasBase64NaarBlob_(data, type) {
  var tekst = atob(data);
  var bytes = new Uint8Array(tekst.length);
  for (var i = 0; i < tekst.length; i++) bytes[i] = tekst.charCodeAt(i);
  return new Blob([bytes], { type: type });
}

function kasHaalFoto_(regel) {
  if (kasFoto.bezigId !== '') return;
  kasFoto.bezigId = regel.id;
  kasMeldFoto_('');
  kasTekenLijst_();
  var email = kasStaat.email;
  var klaar = function () { kasFoto.bezigId = ''; kasTekenLijst_(); };
  beheerVerzoek('beheerBonFoto', { kasId: regel.id }).then(function (a) {
    if (kasStaat.email !== email) return; // uitgelogd of een ander account: niets meer tonen
    if (a && a.ok === true && typeof a.data === 'string' && typeof a.mimeType === 'string') {
      var blob;
      try { blob = kasBase64NaarBlob_(a.data, a.mimeType); } catch (e) { blob = null; }
      if (blob && /^image\/(jpeg|png)$/.test(a.mimeType)) { klaar(); kasToonFoto_(URL.createObjectURL(blob), regel.id); return; }
      if (blob && a.mimeType === 'application/pdf') {
        kasFoto.pdf[regel.id] = URL.createObjectURL(blob);
        var ids = Object.keys(kasFoto.pdf);
        while (ids.length > KAS_MAX_PDF_LINKS) { var oud = ids.shift(); URL.revokeObjectURL(kasFoto.pdf[oud]); delete kasFoto.pdf[oud]; }
        klaar();
        return;
      }
      kasMeldFoto_('Deze bon is niet te tonen.');
    } else if (a && a.code === 'SESSIE' && typeof naarInloggen_ === 'function') {
      kasFoto.bezigId = '';
      naarInloggen_(a.melding || 'Je bent uitgelogd. Log opnieuw in.');
      return;
    } else {
      kasMeldFoto_(a && typeof a.melding === 'string' && a.melding ? a.melding : 'De bon kon nu niet worden opgehaald. Probeer het zo nog eens.');
    }
    klaar();
  }, function () {
    if (kasStaat.email !== email) return;
    kasMeldFoto_(KAS_GEEN_VERBINDING);
    klaar();
  });
}

// Toont de foto in een venster over de pagina. Sluiten met de knop, Escape of een klik naast de foto; het adres wordt dan vrijgegeven.
function kasToonFoto_(url, terugId) {
  kasSluitFoto_();
  var sluit = el('button', { type: 'button', class: 'knop knop-hoofd foto-sluit', onclick: function () { kasSluitFoto_(); } }, 'Sluiten');
  var overlay = el('div', {
    class: 'foto-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Foto van de bon',
    onclick: function (e) { if (e.target === overlay) kasSluitFoto_(); }
  }, el('div', { class: 'foto-kader' }, el('img', { class: 'foto-beeld', src: url, alt: 'Foto van de bon' }), sluit));
  kasFoto.toets = function (e) {
    if (e.key === 'Escape') { e.preventDefault(); kasSluitFoto_(); }
    else if (e.key === 'Tab') { e.preventDefault(); sluit.focus(); } // de sluitknop is het enige om naar toe te gaan
  };
  document.addEventListener('keydown', kasFoto.toets);
  kasFoto.overlay = overlay; kasFoto.url = url; kasFoto.terug = terugId || '';
  document.body.appendChild(overlay);
  sluit.focus();
}

function kasSluitFoto_() {
  if (kasFoto.toets) document.removeEventListener('keydown', kasFoto.toets);
  if (kasFoto.overlay && kasFoto.overlay.parentNode) kasFoto.overlay.parentNode.removeChild(kasFoto.overlay);
  if (kasFoto.url) URL.revokeObjectURL(kasFoto.url);
  var terugId = kasFoto.terug;
  kasFoto.toets = null; kasFoto.overlay = null; kasFoto.url = ''; kasFoto.terug = '';
  if (!terugId) return;
  // de lijst is intussen opnieuw getekend: zoek de knop van deze bon weer op en zet de aandacht daar terug
  var knoppen = document.querySelectorAll('.kasrij-knop');
  for (var i = 0; i < knoppen.length; i++) if (knoppen[i].getAttribute('data-kas-id') === terugId) { knoppen[i].focus(); return; }
}

// Uitgelogd of een ander account: foto en pdf-adressen weg.
function kasVergeet() {
  kasSluitFoto_();
  Object.keys(kasFoto.pdf).forEach(function (id) { URL.revokeObjectURL(kasFoto.pdf[id]); });
  kasFoto.pdf = {}; kasFoto.bezigId = ''; kasFoto.melding = '';
}

function kasRij_(regel) {
  var b = kasBedragTekst_(regel);
  var status = kasStatusLabel_(regel.status);
  var url = kasVeiligeUrl_(regel.bonUrl);
  var wie = regel.bron === 'bon' && regel.leverancier ? String(regel.leverancier) : '';
  return el('li', { class: 'kasrij' },
    el('span', { class: 'kasrij-datum' }, kasDatum_(regel.datum)),
    el('div', { class: 'kasrij-tekst' },
      el('div', { class: 'rij-titel' }, regel.omschrijving || 'Zonder omschrijving'),
      el('div', { class: 'kasrij-sub' },
        el('span', { class: 'rij-sub' }, kasCategorieTekst_(regel) + (wie ? ' · ' + wie : '')),
        status ? el('span', { class: status.klasse }, status.tekst) : null,
        url && regel.id ? kasBonKnop_(regel) : null)),
    el('span', { class: b.klasse }, b.tekst));
}

function kasWachtRij_(o) {
  var g = o.gegevens;
  var bedrag = String(g.bedrag === undefined || g.bedrag === null ? '' : g.bedrag).replace(/€/g, '').trim();
  var c = String(g.categorie || '').trim().toLowerCase();
  var cat = Object.prototype.hasOwnProperty.call(KAS_CATEGORIEEN, c) ? KAS_CATEGORIEEN[c] : kasHoofdletter_(c);
  return el('li', { class: 'kasrij kasrij-wacht' },
    el('span', { class: 'kasrij-datum' }, kasDatum_(g.datum)),
    el('div', { class: 'kasrij-tekst' },
      el('div', { class: 'rij-titel' }, g.omschrijving ? String(g.omschrijving) : 'Bon'),
      el('div', { class: 'kasrij-sub' },
        cat ? el('span', { class: 'rij-sub' }, cat) : null,
        el('span', { class: 'label label-geel' }, 'wordt verwerkt'))),
    el('span', { class: 'kasrij-bedrag' }, bedrag ? '− € ' + bedrag : ''));
}

function kasTekenLijst_() {
  var m = kasApp.momentopname || {};
  var f = kasStaat.filter;
  var wacht = f === 'alles' || f === 'bonnen' || f === 'terug' ? kasWachtend_(m) : [];
  var regels = kasRegels_(m.kas).filter(function (r) { return kasPastBijFilter_(r, f); });
  var zichtbaar = regels.slice(0, kasStaat.toon);
  var delen = [];
  if (wacht.length + regels.length === 0) {
    delen.push(el('div', { class: 'leeg-klein' }, maakIcoon('kas'),
      el('p', null, f === 'alles' ? 'Er staat nog niets in het kasboek.' : 'Hier staat niets bij.')));
  } else {
    delen.push(el('ul', { class: 'kaart-lijst kasboek-lijst' }, wacht.map(kasWachtRij_), zichtbaar.map(kasRij_)));
    if (regels.length > zichtbaar.length) {
      delen.push(el('div', { class: 'kasboek-meer' },
        el('button', { type: 'button', class: 'knop', onclick: function () { kasStaat.toon += KAS_PAGINA; kasTekenLijst_(); } },
          'Meer tonen (nog ' + (regels.length - zichtbaar.length) + ')')));
    }
  }
  kasVak.lijst.replaceChildren.apply(kasVak.lijst, delen);
}

function kasTekenChips_() {
  var chips = KAS_FILTERS.map(function (f) {
    return el('button', {
      type: 'button', class: 'kas-chip', 'data-filter': f.id, 'aria-pressed': kasStaat.filter === f.id ? 'true' : 'false',
      onclick: function () {
        kasStaat.filter = f.id; kasStaat.toon = KAS_PAGINA;
        Array.prototype.forEach.call(kasVak.chips.children, function (k) { k.setAttribute('aria-pressed', k.getAttribute('data-filter') === f.id ? 'true' : 'false'); });
        kasTekenLijst_();
      }
    }, f.tekst);
  });
  kasVak.chips.replaceChildren.apply(kasVak.chips, chips);
}

// ---- kascontrole ----

function kasUitslagBlok_() {
  var u = kasStaat.uitslag;
  if (!u) return null;
  var klasse = u.akkoord ? 'kas-uitslag kas-uitslag-goed' : 'kas-uitslag kas-uitslag-let';
  return el('div', { class: klasse, role: 'status' }, u.akkoord ? maakIcoon('<path d="M5 12.5l4.5 4.5L19 7.5"/>') : null, el('span', null, u.tekst));
}

// Alleen cijfers, punt, komma, spaties en een euroteken; verder laten we het aan het achterwerk.
function kasBedragLijktGoed_(t) {
  return /\d/.test(t) && /^[\s€\d.,\-]+$/.test(t);
}

function kasControleer_() {
  if (kasStaat.bezig) return;
  var tekst = String(kasStaat.bedrag || '').trim();
  if (!kasBedragLijktGoed_(tekst)) {
    kasStaat.uitslag = { akkoord: false, fout: true, tekst: 'Vul het bedrag in zoals de bank-app het toont, bijvoorbeeld 1.234,56.' };
    kasTekenPaneel_(true);
    return;
  }
  kasStaat.focusTerug = !!(kasVak && kasVak.paneel.contains(document.activeElement));
  kasStaat.bezig = true; kasStaat.uitslag = null;
  kasTekenPaneel_(true);
  var email = kasStaat.email;
  beheerVerzoek('beheerKascontrole', { werkelijk: tekst }).then(function (a) {
    if (kasStaat.email !== email) return;
    kasStaat.bezig = false;
    if (a && a.ok === true && typeof a.tekst === 'string') {
      kasStaat.uitslag = { akkoord: a.akkoord === true, tekst: a.tekst };
      if (a.akkoord === true) kasStaat.bedrag = '';
      if (kasApp && typeof kasApp.herlees === 'function') kasApp.herlees();
    } else if (a && a.code === 'SESSIE' && typeof naarInloggen_ === 'function') {
      naarInloggen_(a.melding || 'Je bent uitgelogd. Log opnieuw in.');
      return;
    } else {
      kasStaat.uitslag = { akkoord: false, fout: true, tekst: a && typeof a.melding === 'string' && a.melding ? a.melding : 'Het lukte nu niet. Er is niets vastgelegd. Probeer het zo nog eens.' };
      // na elk mislukt antwoord opnieuw lezen: de editie kan intussen op slot zijn gezet (dan verschijnt de badge 'Afgesloten')
      if (kasApp && typeof kasApp.herlees === 'function') kasApp.herlees();
    }
    kasTekenPaneel_(true);
  }, function () {
    if (kasStaat.email !== email) return;
    kasStaat.bezig = false;
    kasStaat.uitslag = { akkoord: false, fout: true, tekst: KAS_GEEN_VERBINDING + ' Er is niets vastgelegd.' };
    kasTekenPaneel_(true);
  });
}

function kasPaneelSoort_(m) {
  var rechten = kasApp.rechten || [];
  if (!heeftRecht(rechten, 'kascontrole_doen')) return '';
  return m.editie && m.editie.opSlot === true ? 'slot' : 'doen';
}

// Bouwt het kaartje van de kascontrole. Met nieuw=false (bijwerken) blijft een bestaand invulveld ongemoeid.
function kasTekenPaneel_(nieuw) {
  var m = kasApp.momentopname || {};
  var soort = kasPaneelSoort_(m);
  if (soort === '') { kasVak.paneel.hidden = true; kasVak.paneel.replaceChildren(); kasVak.paneelSoort = ''; return; }
  kasVak.paneel.hidden = false;
  if (soort === 'slot') {
    var weg = kasStaat.uitslag && kasStaat.uitslag.akkoord ? kasUitslagBlok_() : null;
    kasVak.paneel.replaceChildren(
      el('div', { class: 'kas-paneelkop' }, maakIcoon(KAS_ICOON_CONTROLE), el('h2', null, 'Kascontrole')),
      el('div', { class: 'kas-slot' }, maakIcoon('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), el('span', null, 'Afgesloten — de kascontrole is akkoord')),
      weg,
      el('p', { class: 'kas-noot' }, 'De editie staat op slot. Je kunt nu het financieel verslag maken.'));
    kasVak.paneelSoort = 'slot';
    return;
  }
  // Het veld bestaat al en er is niets nieuws te tekenen: laat het zoals het is (er wordt misschien getypt).
  if (!nieuw && kasVak.paneelSoort === 'doen') return;
  var veld = el('input', {
    type: 'text', id: 'kas-bedrag', inputmode: 'decimal', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    placeholder: '0,00', maxlength: '30', value: kasStaat.bedrag, 'aria-describedby': 'kas-uitleg',
    oninput: function (e) { kasStaat.bedrag = e.target.value; }
  });
  veld.value = kasStaat.bedrag;
  var knop = el('button', { type: 'submit', class: 'knop knop-hoofd', disabled: kasStaat.bezig }, kasStaat.bezig ? 'Even geduld…' : 'Controleren');
  var uitslag = kasUitslagBlok_();
  var uitslagVak = el('div', { class: 'kas-uitslagvak', 'aria-live': 'polite' }, uitslag);
  kasVak.paneel.replaceChildren(
    el('div', { class: 'kas-paneelkop' }, maakIcoon(KAS_ICOON_CONTROLE), el('h2', null, 'Kascontrole')),
    el('p', { id: 'kas-uitleg', class: 'kas-noot kas-noot-groot' }, 'Kijk in de bank-app wat er op de rekening staat en typ dat bedrag.'),
    el('form', { class: 'kas-formulier', novalidate: 'novalidate', onsubmit: function (e) { e.preventDefault(); kasControleer_(); } },
      el('label', { class: 'veld', for: 'kas-bedrag' }, 'Saldo volgens de bank',
        el('span', { class: 'kas-bedragveld' }, el('span', { class: 'kas-euro', 'aria-hidden': 'true' }, '€'), veld)),
      knop),
    uitslagVak,
    el('p', { class: 'kas-noot' }, 'Klopt het, dan gaat de editie op slot en kun je het financieel verslag maken.'));
  kasVak.paneelSoort = 'doen';
  if (kasStaat.focusTerug && !kasStaat.bezig) { kasStaat.focusTerug = false; knop.focus(); }
}

// ---- scherm ----

function kasTeken_(container, staat) {
  kasApp = staat;
  kasVergeetBijAnder_(staat.email);
  var m = staat.momentopname || {};
  var tegels = el('section', { class: 'tegels', 'aria-label': 'Saldo' });
  var chips = el('div', { class: 'kas-chips', role: 'group', 'aria-label': 'Filter op soort' });
  var lijst = el('div', { class: 'kasboek-inhoud' });
  var fotoMelding = el('div', { class: 'strook strook-fout kas-fotomelding', role: 'alert', hidden: true });
  var paneel = el('section', { class: 'kaart kas-paneel', 'aria-label': 'Kascontrole' });
  kasVak = { wortel: container, tegels: tegels, chips: chips, lijst: lijst, paneel: paneel, paneelSoort: '', fotoMelding: fotoMelding };
  var acties = heeftRecht(staat.rechten || [], 'bon_indienen')
    ? el('div', { class: 'knoppen' }, el('a', { class: 'knop', href: '#bon' }, 'Bon indienen')) : null;
  container.replaceChildren(
    el('header', { class: 'paginakop' },
      el('div', null, el('h1', null, 'Kas'), el('p', null, 'Alle geld in en uit, met bonnen. Het verwachte banksaldo moet gelijk zijn aan wat de bank zegt.')),
      acties),
    tegels,
    el('div', { class: 'kas-kolommen' },
      el('section', { class: 'kaart kasboek', 'aria-label': 'Kasboek' }, el('h2', null, 'Kasboek'), chips, fotoMelding, lijst),
      paneel));
  kasTekenTegels_(m.kas);
  kasTekenChips_();
  kasTekenLijst_();
  kasTekenPaneel_(true);
  kasMeldFoto_(kasFoto.melding);
}

// Nieuwe gegevens: saldi en lijst opnieuw, het kaartje van de kascontrole alleen als het van soort verandert (zodat een getypt bedrag blijft).
function kasBijwerken_(container, staat) {
  if (!kasVak || kasVak.wortel !== container || !container.contains(kasVak.tegels)) { kasTeken_(container, staat); return; }
  kasApp = staat;
  kasVergeetBijAnder_(staat.email);
  var m = staat.momentopname || {};
  kasTekenTegels_(m.kas);
  kasTekenLijst_();
  var soort = kasPaneelSoort_(m);
  if (soort !== kasVak.paneelSoort || soort === 'slot') kasTekenPaneel_(true);
  else kasTekenPaneel_(false);
}

registreerScherm({
  naam: 'kas',
  titel: 'Kas',
  recht: 'kas_zien',
  icoon: 'kas',
  teken: kasTeken_,
  bijwerken: kasBijwerken_
});
