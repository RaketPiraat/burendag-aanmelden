// Scherm Begroting: wat de commissie wil uitgeven en binnenkrijgen, naast wat er werkelijk is uitgegeven en binnengekomen.
// De cijfers komen van het achterwerk (momentopname.begroting). Met begroting_bewerken kun je posten toevoegen, wijzigen en
// verwijderen: dat gaat als opdracht en staat meteen op het scherm met "wordt verwerkt", tot de nieuwe stand binnen is.
// Wat er in het formulier getypt is blijft bewaard (begrStaat) en het formulier wordt bij bijwerken nooit opnieuw getekend.
// Vereist app.js (registreerScherm, el, euro, maakIcoon, beheerApp, SCHERMEN, heeftRecht).

var BEGR_MAX_POST = 60;
var BEGR_MAX_CENTEN = 10000000;
var BEGR_CATEGORIEEN = {
  uitgave: [['eten', 'Eten'], ['drinken', 'Drinken'], ['huur', 'Huur'], ['materiaal', 'Materiaal'], ['activiteiten', 'Activiteiten'], ['communicatie', 'Communicatie'], ['overig', 'Overig']],
  inkomst: [['deelnemers', 'Bijdragen deelnemers'], ['subsidie', 'Subsidie'], ['sponsor', 'Sponsoring'], ['overig', 'Overig']]
};
var BEGR_ICOON_BEWERK = '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>';
var BEGR_ICOON_WEG = '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10 11v6M14 11v6"/>';
var BEGR_ICOON_KOPIE = '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>';
var BEGR_ICOON_BEL = '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>';
var BEGR_TYPEN = { begrotingPostOpslaan: true, begrotingPostVerwijderen: true };
var BEGR_FOUT_VERSE_MS = 24 * 60 * 60 * 1000;

// formulier: null (dicht) of { oudePost, post, soort, categorie, bedrag, toelichting, fouten: [] }
var begrStaat = { email: '', formulier: null, kopie: '', verborgen: {}, focus: false };
var begrVak = null;   // { wortel, kop, formulier, melding, tegels, uitgaven, inkomsten, noot } van het getekende scherm
var begrApp = null;   // de laatste staat van de schil

function begrVergeetBijAnder_(email) {
  if (begrStaat.email === email) return;
  begrStaat = { email: email, formulier: null, kopie: '', verborgen: {}, focus: false };
}

function begrSleutel_(naam) { return String(naam === undefined || naam === null ? '' : naam).trim().toLowerCase(); }

function begrCategorieTekst_(soort, categorie) {
  var lijst = BEGR_CATEGORIEEN[soort] || [];
  for (var i = 0; i < lijst.length; i++) if (lijst[i][0] === categorie) return lijst[i][1];
  var s = String(categorie || '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// "12,50", "1.234,56", "€ 3" naar hele centen; null als het geen bedrag is (zoals het achterwerk het leest).
function begrCenten_(tekst) {
  if (typeof tekst !== 'string') return null;
  var t = tekst.replace(/€/g, '').replace(/\s+/g, '');
  var m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return null;
  var c = Number(m[1].replace(/\./g, '')) * 100 + (m[2] === undefined ? 0 : Number((m[2] + '0').slice(0, 2)));
  return isFinite(c) ? c : null;
}

// Bedrag in centen als invultekst: 1250 -> '12,50'.
function begrInvulBedrag_(centen) {
  var c = Math.round(Math.abs(Number(centen) || 0));
  return String(Math.floor(c / 100)) + ',' + ('0' + (c % 100)).slice(-2);
}

function begrJaar_(m) {
  var d = m && m.editie && m.editie.datum ? String(m.editie.datum) : '';
  return /^\d{4}/.test(d) ? d.slice(0, 4) : '';
}

function begrMagBewerken_() {
  var m = (begrApp && begrApp.momentopname) || {};
  return heeftRecht((begrApp && begrApp.rechten) || [], 'begroting_bewerken') && !(m.editie && m.editie.opSlot === true);
}

// ---- de posten: stand van het achterwerk plus wat nog verwerkt wordt ----

// Eigen opdrachten voor de begroting die nog niet in de gelezen stand zitten, oudste eerst.
function begrWachtend_(m) {
  var lijst = ((m && m.mijnOpdrachten) || []).filter(function (o) {
    return BEGR_TYPEN[o.type] === true && (o.status === 'nieuw' || o.status === 'onderweg') && o.gegevens && typeof o.gegevens === 'object';
  });
  var server = lijst.filter(function (o) { return o.status === 'nieuw'; }).reverse();
  var wachtrij = lijst.filter(function (o) { return o.status === 'onderweg'; });
  return server.concat(wachtrij);
}

function begrZoek_(posten, naam) {
  var s = begrSleutel_(naam);
  for (var i = 0; i < posten.length; i++) if (begrSleutel_(posten[i].post) === s) return i;
  return -1;
}

// De posten zoals ze er na het verwerken uitzien; nieuwe en gewijzigde posten hebben wacht = true, verwijderde weg = true.
function begrPosten_(m) {
  var posten = ((m && m.begroting && m.begroting.posten) || []).map(function (p) {
    return { post: p.post, soort: p.soort, categorie: p.categorie, begrootCenten: Number(p.begrootCenten) || 0, werkelijkCenten: Number(p.werkelijkCenten) || 0, toelichting: p.toelichting || '', wacht: false, weg: false };
  });
  begrWachtend_(m).forEach(function (o) {
    var g = o.gegevens;
    if (o.type === 'begrotingPostVerwijderen') {
      var i = begrZoek_(posten, g.post);
      if (i !== -1) posten[i].weg = true;
      return;
    }
    var centen = begrCenten_(String(g.begroot === undefined || g.begroot === null ? '' : g.begroot));
    if (centen === null || typeof g.post !== 'string' || g.post.trim() === '') return;
    var plek = begrSleutel_(g.oudePost) !== '' ? begrZoek_(posten, g.oudePost) : -1;
    if (plek === -1) plek = begrZoek_(posten, g.post);
    var bestaand = plek === -1 ? null : posten[plek];
    var nieuw = { post: g.post.trim(), soort: g.soort, categorie: g.categorie, begrootCenten: centen, toelichting: String(g.toelichting || '').trim(),
      werkelijkCenten: bestaand && bestaand.soort === g.soort && bestaand.categorie === g.categorie ? bestaand.werkelijkCenten : 0, wacht: true, weg: false };
    if (plek === -1) posten.push(nieuw); else posten[plek] = nieuw;
  });
  return posten;
}

function begrTotalen_(posten, m) {
  var t = { uitgavenBegroot: 0, uitgavenWerkelijk: 0, inkomstenBegroot: 0, inkomstenWerkelijk: 0 };
  posten.forEach(function (p) {
    if (p.weg) return;
    if (p.soort === 'inkomst') { t.inkomstenBegroot += p.begrootCenten; t.inkomstenWerkelijk += p.werkelijkCenten; }
    else { t.uitgavenBegroot += p.begrootCenten; t.uitgavenWerkelijk += p.werkelijkCenten; }
  });
  t.saldoBegroot = t.inkomstenBegroot - t.uitgavenBegroot;
  t.saldoWerkelijk = t.inkomstenWerkelijk - t.uitgavenWerkelijk;
  t.uitgavenZonderPost = Number(m && m.begroting && m.begroting.totalen && m.begroting.totalen.uitgavenZonderPost) || 0;
  return t;
}

// ---- onderdelen ----

function begrTegel_(label, waarde, sub) {
  return el('div', { class: 'kaart tegel' },
    el('span', { class: 'tegel-label' }, label),
    el('span', { class: 'tegel-waarde' }, waarde),
    el('span', { class: 'tegel-sub' }, sub));
}

function begrAantalPosten_(posten, soort) {
  return posten.filter(function (p) { return p.soort === soort && !p.weg; }).length;
}

function begrTekenTegels_(posten, t) {
  var nu = t.uitgavenBegroot > 0 ? Math.round(100 * t.uitgavenWerkelijk / t.uitgavenBegroot) : 0;
  var saldoTekst = t.saldoBegroot === 0 ? 'sluitend' : t.saldoBegroot > 0 ? 'overschot' : 'tekort: de uitgaven zijn hoger dan de inkomsten';
  var nu1 = begrAantalPosten_(posten, 'uitgave'), nu2 = begrAantalPosten_(posten, 'inkomst');
  var tegels = [
    begrTegel_('Begroot uitgeven', euro(t.uitgavenBegroot), meervoud_(nu1, 'post', 'posten')),
    begrTegel_('Begroot binnen', euro(t.inkomstenBegroot), meervoud_(nu2, 'post', 'posten') + ' (bijdragen, subsidie, sponsoring)'),
    begrTegel_('Begroot saldo', euro(t.saldoBegroot), saldoTekst),
    begrTegel_('Nu uitgegeven', euro(t.uitgavenWerkelijk), t.uitgavenBegroot > 0 ? nu + '% van de begroting' : 'nog niets begroot')
  ];
  begrVak.tegels.replaceChildren.apply(begrVak.tegels, tegels);
}

function begrBalk_(p, soort) {
  var pct = p.begrootCenten > 0 ? Math.round(100 * p.werkelijkCenten / p.begrootCenten) : 0;
  var over = soort === 'uitgave' && p.begrootCenten > 0 && p.werkelijkCenten > p.begrootCenten;
  var tekst;
  if (p.begrootCenten === 0) tekst = p.werkelijkCenten > 0 ? 'niet begroot' : '–';
  else tekst = pct + '% van begroot' + (over ? ' · boven de begroting' : '');
  var binnen = el('span', { style: 'width:' + Math.min(100, pct) + '%' });
  return el('div', { class: 'begr-stand' },
    el('div', { class: over ? 'balk begr-balk-over' : 'balk', role: 'img', 'aria-label': tekst }, binnen),
    el('div', { class: 'begr-stand-tekst' }, tekst));
}

function begrActies_(p) {
  if (!begrMagBewerken_() || p.wacht || p.weg) return null;
  return el('div', { class: 'begr-acties' },
    el('button', { type: 'button', class: 'knop knop-klein', title: 'Bewerken', 'aria-label': 'Post ' + p.post + ' bewerken', onclick: function () { begrOpenFormulier_(p); } }, maakIcoon(BEGR_ICOON_BEWERK), el('span', { class: 'begr-knoptekst' }, 'Bewerken')),
    el('button', { type: 'button', class: 'knop knop-klein knop-gevaar', title: 'Verwijderen', 'aria-label': 'Post ' + p.post + ' verwijderen', onclick: function () { begrVerwijder_(p); } }, maakIcoon(BEGR_ICOON_WEG), el('span', { class: 'begr-knoptekst' }, 'Verwijderen')));
}

function begrRij_(p, soort) {
  var sub = begrCategorieTekst_(soort, p.categorie) + (p.toelichting ? ' · ' + p.toelichting : '');
  var wacht = p.weg ? el('span', { class: 'label label-geel' }, 'wordt verwijderd') : p.wacht ? el('span', { class: 'label label-geel' }, 'wordt verwerkt') : null;
  return el('tr', { class: p.weg ? 'begr-rij begr-rij-weg' : 'begr-rij' },
    el('th', { scope: 'row', class: 'begr-post' },
      el('span', { class: 'rij-titel' }, p.post),
      el('span', { class: 'rij-sub' }, sub),
      wacht),
    el('td', { class: 'getal', 'data-label': 'Begroot' }, euro(p.begrootCenten)),
    el('td', { class: 'getal', 'data-label': 'Werkelijk' }, euro(p.werkelijkCenten)),
    el('td', { class: 'begr-stand-cel', 'data-label': 'Stand' }, begrBalk_(p, soort)),
    el('td', { class: 'begr-actiecel' }, begrActies_(p)));
}

function begrTabel_(titel, soort, posten, begroot, werkelijk, leegTekst) {
  var rijen = posten.filter(function (p) { return p.soort === soort; });
  var kop = el('h2', null, titel);
  if (rijen.length === 0) {
    return [kop, el('div', { class: 'leeg-klein' }, el('p', null, leegTekst))];
  }
  var lijst = rijen.map(function (p) { return begrRij_(p, soort); });
  var totaal = el('tr', { class: 'begr-totaal' },
    el('th', { scope: 'row' }, 'Totaal'),
    el('td', { class: 'getal', 'data-label': 'Begroot' }, euro(begroot)),
    el('td', { class: 'getal', 'data-label': 'Werkelijk' }, euro(werkelijk)),
    el('td', null), el('td', null));
  return [kop, el('div', { class: 'tabel-wrap' },
    el('table', { class: 'tabel begr-tabel' },
      el('caption', { class: 'verborgen' }, titel),
      el('thead', null, el('tr', null,
        el('th', { scope: 'col' }, 'Post'), el('th', { scope: 'col', class: 'getal' }, 'Begroot'), el('th', { scope: 'col', class: 'getal' }, 'Werkelijk tot nu'),
        el('th', { scope: 'col' }, 'Stand'), el('th', { scope: 'col' }, el('span', { class: 'verborgen' }, 'Acties')))),
      el('tbody', null, lijst, totaal)))];
}

// Hoort meer dan één uitgavepost bij dezelfde categorie, dan staat het werkelijke bedrag bij de eerste (de achterkant telt per categorie).
function begrGedeeldeCategorie_(posten) {
  var gezien = {};
  var dubbel = false;
  posten.forEach(function (p) {
    if (p.soort !== 'uitgave' || p.weg) return;
    if (gezien[p.categorie]) dubbel = true;
    gezien[p.categorie] = true;
  });
  return dubbel;
}

function begrTekenTabellen_(posten, t) {
  var u = begrTabel_('Uitgaven', 'uitgave', posten, t.uitgavenBegroot, t.uitgavenWerkelijk, 'Er zijn nog geen uitgaven begroot.');
  var i = begrTabel_('Inkomsten', 'inkomst', posten, t.inkomstenBegroot, t.inkomstenWerkelijk, 'Er zijn nog geen inkomsten begroot.');
  var uitNoten = [];
  if (begrGedeeldeCategorie_(posten)) uitNoten.push(el('p', { class: 'kas-noot' }, 'Horen meer posten bij dezelfde categorie, dan staat wat er werkelijk is uitgegeven bij de eerste post van die categorie. De andere posten tonen € 0,00.'));
  if (t.uitgavenZonderPost > 0) uitNoten.push(el('p', { class: 'kas-noot' }, 'Er is ook ' + euro(t.uitgavenZonderPost) + ' uitgegeven in categorieën waar nog geen post voor is. Dat staat hierboven niet bij.'));
  begrVak.uitgaven.replaceChildren.apply(begrVak.uitgaven, u.concat(uitNoten));
  begrVak.inkomsten.replaceChildren.apply(begrVak.inkomsten, i.concat([
    el('p', { class: 'kas-noot' }, 'Subsidie en sponsoring tellen mee zodra ze zijn toegezegd (zie Geldbronnen).')]));
}

// Meldingen: een wijziging die niet gelukt is (hooguit één, van de laatste 24 uur) en de herinnering over het Buurtbudget.
function begrTekenMelding_(m) {
  var nu = Date.now();
  var fout = ((m && m.mijnOpdrachten) || []).filter(function (o) {
    var t = Date.parse(o.ontvangenOp || '');
    return BEGR_TYPEN[o.type] === true && o.status === 'fout' && !begrStaat.verborgen[o.id] && (isNaN(t) || nu - t < BEGR_FOUT_VERSE_MS);
  })[0];
  var delen = [];
  if (fout) {
    delen.push(el('section', { class: 'strook strook-fout', role: 'alert' },
      el('span', { class: 'strook-tekst' }, 'Een wijziging in de begroting is niet gelukt' + (fout.melding ? ': ' + fout.melding : '.')),
      el('button', { type: 'button', class: 'knop', onclick: function () { begrStaat.verborgen[fout.id] = true; begrTekenMelding_(begrApp.momentopname); } }, 'Sluiten')));
  }
  var heeftBronnen = SCHERMEN.some(function (s) { return s.naam === 'geldbronnen'; }) && heeftRecht(begrApp.rechten || [], 'geldbronnen_zien');
  delen.push(el('section', { class: 'kaart begr-buurtbudget' },
    el('span', { class: 'begr-bel' }, maakIcoon(BEGR_ICOON_BEL)),
    el('div', { class: 'begr-bel-tekst' },
      el('div', { class: 'rij-titel' }, 'Eerst het Buurtbudget aanvragen, dan pas betalen'),
      el('div', null, 'De gemeente vergoedt alleen kosten die ná de aanvraag zijn gemaakt. Doe de aanbetaling aan de cateraar en het springkussen dus pas daarna.')),
    heeftBronnen ? el('a', { class: 'knop knop-hoofd', href: '#geldbronnen' }, 'Naar Geldbronnen') : null));
  begrVak.melding.replaceChildren.apply(begrVak.melding, delen);
}

// ---- tekst kopiëren ----

// Een nette lijst voor in een aanvraag: alleen wat begroot is, met toelichting waar die er is.
function begrTekst_(m, posten, t) {
  var jaar = begrJaar_(m);
  var naam = m && m.editie && m.editie.naam ? String(m.editie.naam) : 'Burendag Westvaartpark';
  var regels = ['Begroting ' + naam + (jaar && naam.indexOf(jaar) === -1 ? ' ' + jaar : ''), ''];
  function blok(titel, soort, totaal, totaalTekst) {
    var lijst = posten.filter(function (p) { return p.soort === soort && !p.weg; });
    if (lijst.length === 0) return;
    regels.push(titel);
    lijst.forEach(function (p) { regels.push('- ' + p.post + ': ' + euro(p.begrootCenten) + (p.toelichting ? ' (' + p.toelichting + ')' : '')); });
    regels.push(totaalTekst + ': ' + euro(totaal), '');
  }
  blok('UITGAVEN', 'uitgave', t.uitgavenBegroot, 'Totaal uitgaven');
  blok('INKOMSTEN', 'inkomst', t.inkomstenBegroot, 'Totaal inkomsten');
  regels.push('Saldo (inkomsten min uitgaven): ' + euro(t.saldoBegroot));
  return regels.join('\n');
}

function begrKopieer_(tekst) {
  function klaar(ok) {
    begrStaat.kopie = ok ? 'Gekopieerd. Je kunt het nu plakken.' : 'Kopiëren lukte niet. Selecteer de tekst zelf en kopieer hem.';
    begrTekenKop_();
    setTimeout(function () { begrStaat.kopie = ''; if (begrVak && begrVak.kop.isConnected) begrTekenKop_(); }, 4000);
  }
  function noodgreep() {
    var vak = el('textarea', { 'aria-hidden': 'true', tabindex: '-1', style: 'position:fixed;top:0;left:0;opacity:0' });
    vak.value = tekst;
    document.body.appendChild(vak);
    vak.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(vak);
    klaar(ok);
  }
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') navigator.clipboard.writeText(tekst).then(function () { klaar(true); }, noodgreep);
  else noodgreep();
}

function begrKopieerNu_() {
  var m = begrApp.momentopname || {};
  var posten = begrPosten_(m);
  begrKopieer_(begrTekst_(m, posten, begrTotalen_(posten, m)));
}

// ---- kop en knoppen ----

function begrTekenKop_() {
  var m = begrApp.momentopname || {};
  var jaar = begrJaar_(m);
  var posten = begrPosten_(m);
  var t = begrTotalen_(posten, m);
  var knoppen = [];
  if (posten.some(function (p) { return !p.weg; })) {
    knoppen.push(el('button', { type: 'button', class: 'knop', onclick: begrKopieerNu_ }, maakIcoon(BEGR_ICOON_KOPIE), 'Kopieer als tekst'));
  }
  if (begrMagBewerken_()) {
    knoppen.push(el('button', { type: 'button', class: 'knop knop-hoofd', onclick: function () { begrOpenFormulier_(null); } }, '+ Post toevoegen'));
  }
  begrVak.kop.replaceChildren(
    el('div', null, el('h1', null, 'Begroting' + (jaar ? ' ' + jaar : '')),
      el('p', null, 'Wat we van plan zijn uit te geven en binnen te krijgen, naast wat er echt gebeurt. Werkelijk komt vanzelf uit het kasboek.')),
    el('div', { class: 'begr-kopknoppen' }, el('div', { class: 'knoppen' }, knoppen),
      el('span', { class: 'begr-kopie', role: 'status', 'aria-live': 'polite' }, begrStaat.kopie)));
}

// ---- formulier ----

function begrOpenFormulier_(p) {
  begrStaat.formulier = p
    ? { oudePost: p.post, post: p.post, soort: p.soort, categorie: p.categorie, bedrag: begrInvulBedrag_(p.begrootCenten), toelichting: p.toelichting || '', fouten: [] }
    : { oudePost: '', post: '', soort: 'uitgave', categorie: '', bedrag: '', toelichting: '', fouten: [] };
  begrStaat.focus = true;
  begrTekenFormulier_();
}

function begrSluitFormulier_() {
  begrStaat.formulier = null;
  begrStaat.focus = false;
  begrTekenFormulier_();
}

function begrControleer_(f) {
  var fouten = [];
  var naam = f.post.trim();
  if (naam === '') fouten.push('Vul de naam van de post in.');
  else if (naam.length > BEGR_MAX_POST) fouten.push('De naam van de post is te lang (maximaal ' + BEGR_MAX_POST + ' tekens).');
  else if (naam.indexOf(',') !== -1) fouten.push('De naam van de post mag geen komma bevatten.');
  else {
    var posten = begrPosten_(begrApp.momentopname || {});
    var eigen = f.oudePost ? begrZoek_(posten, f.oudePost) : -1;
    var andere = begrZoek_(posten, naam);
    if (andere !== -1 && andere !== eigen && !posten[andere].weg) fouten.push('Er bestaat al een post met deze naam.');
  }
  if (!(BEGR_CATEGORIEEN[f.soort] || []).some(function (c) { return c[0] === f.categorie; })) fouten.push('Kies een categorie uit de lijst.');
  var centen = begrCenten_(f.bedrag);
  if (centen === null) fouten.push('Vul een bedrag in, bijvoorbeeld 12,50.');
  else if (centen > BEGR_MAX_CENTEN) fouten.push('Het bedrag is te hoog (maximaal € 100.000).');
  if (f.toelichting.trim().length > 300) fouten.push('De toelichting is te lang (maximaal 300 tekens).');
  return fouten;
}

function begrOpslaan_() {
  var f = begrStaat.formulier;
  if (!f) return;
  f.fouten = begrControleer_(f);
  if (f.fouten.length > 0) { begrStaat.focus = false; begrTekenFormulier_(); begrVak.formulier.querySelector('.begr-fouten').focus(); return; }
  var gegevens = { post: f.post.trim(), soort: f.soort, categorie: f.categorie, begroot: f.bedrag.trim(), toelichting: f.toelichting.trim() };
  if (f.oudePost) gegevens.oudePost = f.oudePost;
  begrStaat.formulier = null;
  begrApp.stuurOpdracht('begrotingPostOpslaan', gegevens);
  begrTekenFormulier_();
  begrTekenData_(); // staat de opdracht al in de wachtrij dan is dit hetzelfde als wat bijwerken tekende
}

function begrVerwijder_(p) {
  if (!window.confirm('Post "' + p.post + '" verwijderen uit de begroting?')) return;
  begrApp.stuurOpdracht('begrotingPostVerwijderen', { post: p.post });
}

function begrVeld_(id, label, kind, hulp) {
  return el('div', { class: 'veld' }, el('label', { for: id }, label), kind, hulp ? el('span', { class: 'begr-hulp', id: id + '-hulp' }, hulp) : null);
}

function begrTekenFormulier_() {
  var f = begrStaat.formulier;
  var vak = begrVak.formulier;
  if (!f || !begrMagBewerken_()) { begrStaat.formulier = null; vak.hidden = true; vak.replaceChildren(); return; }
  vak.hidden = false;
  var naam = el('input', { type: 'text', id: 'begr-post', maxlength: String(BEGR_MAX_POST), autocomplete: 'off', value: f.post, 'aria-describedby': 'begr-post-hulp',
    oninput: function (e) { f.post = e.target.value; } });
  naam.value = f.post;
  var soort = el('select', { id: 'begr-soort', onchange: function (e) {
    f.soort = e.target.value;
    if (!(BEGR_CATEGORIEEN[f.soort] || []).some(function (c) { return c[0] === f.categorie; })) f.categorie = '';
    vulCategorie();
  } },
    el('option', { value: 'uitgave' }, 'Uitgave (geld dat we uitgeven)'), el('option', { value: 'inkomst' }, 'Inkomst (geld dat binnenkomt)'));
  soort.value = f.soort;
  var categorie = el('select', { id: 'begr-categorie', onchange: function (e) { f.categorie = e.target.value; } });
  function vulCategorie() {
    var opties = [el('option', { value: '' }, 'Kies een categorie')].concat((BEGR_CATEGORIEEN[f.soort] || []).map(function (c) { return el('option', { value: c[0] }, c[1]); }));
    categorie.replaceChildren.apply(categorie, opties);
    categorie.value = f.categorie;
  }
  vulCategorie();
  var bedrag = el('input', { type: 'text', id: 'begr-bedrag', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00', maxlength: '14',
    oninput: function (e) { f.bedrag = e.target.value; } });
  bedrag.value = f.bedrag;
  var toelichting = el('input', { type: 'text', id: 'begr-toelichting', maxlength: '300', autocomplete: 'off', value: f.toelichting,
    oninput: function (e) { f.toelichting = e.target.value; } });
  toelichting.value = f.toelichting;
  var fouten = el('div', { class: 'begr-fouten' + (f.fouten.length ? '' : ' begr-fouten-leeg'), role: 'alert', tabindex: '-1' },
    f.fouten.length ? el('ul', null, f.fouten.map(function (t) { return el('li', null, t); })) : null);
  vak.replaceChildren(
    el('h2', null, f.oudePost ? 'Post bewerken' : 'Post toevoegen'),
    el('form', { class: 'begr-formulier', novalidate: 'novalidate', onsubmit: function (e) { e.preventDefault(); begrOpslaan_(); } },
      fouten,
      el('div', { class: 'begr-velden' },
        begrVeld_('begr-post', 'Naam van de post', naam, 'Bijvoorbeeld: Eten (cateraar). Geen komma\'s.'),
        begrVeld_('begr-soort', 'Soort', soort),
        begrVeld_('begr-categorie', 'Categorie', categorie, 'Hierop wordt wat er werkelijk is uitgegeven of binnengekomen bij deze post gezocht.'),
        begrVeld_('begr-bedrag', 'Begroot bedrag', el('span', { class: 'kas-bedragveld' }, el('span', { class: 'kas-euro', 'aria-hidden': 'true' }, '€'), bedrag)),
        begrVeld_('begr-toelichting', 'Toelichting (mag leeg)', toelichting)),
      el('div', { class: 'knoppen' },
        el('button', { type: 'submit', class: 'knop knop-hoofd' }, 'Opslaan'),
        el('button', { type: 'button', class: 'knop', onclick: begrSluitFormulier_ }, 'Annuleren'))));
  if (begrStaat.focus) { begrStaat.focus = false; naam.focus(); vak.scrollIntoView({ block: 'nearest' }); }
}

// ---- scherm ----

function begrTekenData_() {
  var m = begrApp.momentopname || {};
  var posten = begrPosten_(m);
  var t = begrTotalen_(posten, m);
  begrTekenKop_();
  begrTekenMelding_(m);
  begrTekenTegels_(posten, t);
  begrTekenTabellen_(posten, t);
}

function begrTeken_(container, staat) {
  begrApp = staat;
  begrVergeetBijAnder_(staat.email);
  begrVak = {
    wortel: container,
    kop: el('header', { class: 'paginakop' }),
    melding: el('div', { class: 'stroken begr-meldingen' }),
    formulier: el('section', { class: 'kaart begr-paneel', 'aria-label': 'Post toevoegen of bewerken', hidden: true }),
    tegels: el('section', { class: 'tegels', 'aria-label': 'Kerncijfers' }),
    uitgaven: el('section', { class: 'kaart begr-tabelkaart', 'aria-label': 'Uitgaven' }),
    inkomsten: el('section', { class: 'kaart begr-tabelkaart', 'aria-label': 'Inkomsten' })
  };
  container.replaceChildren(begrVak.kop, begrVak.formulier, begrVak.tegels, begrVak.uitgaven, begrVak.inkomsten, begrVak.melding);
  begrTekenData_();
  begrTekenFormulier_();
}

// Nieuwe gegevens: kop, cijfers en tabellen opnieuw; het formulier blijft zoals het is (er wordt misschien getypt).
function begrBijwerken_(container, staat) {
  if (!begrVak || begrVak.wortel !== container || !container.contains(begrVak.tegels)) { begrTeken_(container, staat); return; }
  begrApp = staat;
  begrVergeetBijAnder_(staat.email);
  begrTekenData_();
  if (begrStaat.formulier && !begrMagBewerken_()) begrTekenFormulier_(); // recht kwijt of editie op slot: formulier weg
}

registreerScherm({
  naam: 'begroting',
  titel: 'Begroting',
  recht: 'begroting_zien',
  icoon: 'begroting',
  teken: begrTeken_,
  bijwerken: begrBijwerken_
});
