// Scherm Geldbronnen: subsidies, sponsors en giften voor de editie, als bord met een kolom per stap (verkennen tot verantwoorden).
// De gegevens komen van het achterwerk (momentopname.geldbronnen). Met geldbronnen_bewerken kun je bronnen toevoegen, wijzigen en
// verwijderen: dat gaat als opdracht en staat meteen op het scherm met "wordt verwerkt", tot de nieuwe stand binnen is.
// Wat in het formulier getypt is blijft bewaard (gbStaat) en het formulier wordt bij bijwerken nooit opnieuw getekend.
// Vereist app.js (registreerScherm, el, euro, maakIcoon, meervoud_, heeftRecht).

var GB_STATUSSEN = [['verkennen', 'Verkennen'], ['aanvragen', 'Aanvragen'], ['toegezegd', 'Toegezegd'], ['ontvangen', 'Ontvangen'], ['verantwoorden', 'Verantwoorden'], ['afgerond', 'Afgerond'], ['afgewezen', 'Afgewezen']];
var GB_SOORTEN = [['subsidie', 'Subsidie'], ['sponsoring', 'Sponsoring'], ['gift', 'Gift'], ['overig', 'Overig']];
var GB_MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
var GB_TELT_MEE = ['toegezegd', 'ontvangen', 'verantwoorden', 'afgerond'];
var GB_ONTVANGEN = ['ontvangen', 'verantwoorden', 'afgerond'];
var GB_NOG_AAN_TE_VRAGEN = ['verkennen', 'aanvragen'];
var GB_TERMIJN_DAGEN = 45;
var GB_MAX_NAAM = 80;
var GB_MAX_CONTACT = 120;
var GB_MAX_TOELICHTING = 500;
var GB_MAX_CENTEN = 10000000;
var GB_MIJN = 'mijn'; // waarde van het filter 'Mijn geldbronnen'
var GB_TYPEN = { geldbronOpslaan: true, geldbronVerwijderen: true };
var GB_FOUT_VERSE_MS = 24 * 60 * 60 * 1000;
var GB_ICOON_BEL = '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>';
var GB_ICOON_PLUS = '<path d="M12 5v14M5 12h14"/>';

// formulier: null (dicht) of { id, nieuw, naam, soort, status, bedrag, termijn, verantwoording, contact, toelichting, opgepaktDoor, opgepaktDoorNaam, fouten: [] }
var gbStaat = { email: '', formulier: null, filter: 'alle', afgewezenOpen: false, verborgen: {}, focus: false };
var gbVak = null;   // { wortel, kop, melding, formulier, balk, tegels, filter, bord } van het getekende scherm
var gbApp = null;   // de laatste staat van de schil

function gbVergeetBijAnder_(email) {
  if (gbStaat.email === email) return;
  gbStaat = { email: email, formulier: null, filter: 'alle', afgewezenOpen: false, verborgen: {}, focus: false };
}

function gbTekst_(w) { return w === undefined || w === null ? '' : String(w).trim(); }

function gbLabel_(lijst, sleutel) {
  for (var i = 0; i < lijst.length; i++) if (lijst[i][0] === sleutel) return lijst[i][1];
  return String(sleutel || '');
}

// "350", "12,50", "1.234,56", "€ 3" naar hele centen; null als het geen bedrag is (zoals het achterwerk het leest).
function gbCenten_(tekst) {
  if (typeof tekst !== 'string') return null;
  var t = tekst.replace(/€/g, '').replace(/\s+/g, '');
  var m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(t);
  if (!m) return null;
  var c = Number(m[1].replace(/\./g, '')) * 100 + (m[2] === undefined ? 0 : Number((m[2] + '0').slice(0, 2)));
  return isFinite(c) ? c : null;
}

// Bedrag in centen als invultekst: 35000 -> '350', 1250 -> '12,50'.
function gbInvulBedrag_(centen) {
  var c = Math.round(Math.abs(Number(centen) || 0));
  return String(Math.floor(c / 100)) + (c % 100 === 0 ? '' : ',' + ('0' + (c % 100)).slice(-2));
}

function gbNieuwId_() {
  var bytes = crypto.getRandomValues(new Uint8Array(6));
  var id = 'G-';
  for (var i = 0; i < 6; i++) id += ('0' + bytes[i].toString(16)).slice(-2);
  return id;
}

function gbIsDatum_(t) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return false;
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function gbDatumTekst_(iso) {
  if (!gbIsDatum_(iso)) return '';
  var d = iso.split('-');
  return Number(d[2]) + ' ' + GB_MAANDEN[Number(d[1]) - 1] + ' ' + d[0];
}

function gbVandaag_() {
  var w = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).forEach(function (d) { w[d.type] = d.value; });
  return w.year + '-' + w.month + '-' + w.day;
}

function gbDagen_(van, tot) {
  var a = van.split('-'), b = tot.split('-');
  return Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000);
}

function gbPlusDagen_(iso, dagen) {
  var d = iso.split('-');
  var n = new Date(Date.UTC(+d[0], +d[1] - 1, +d[2] + dagen));
  return n.getUTCFullYear() + '-' + ('0' + (n.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + n.getUTCDate()).slice(-2);
}

function gbDagenTekst_(dagen) {
  if (dagen === 0) return 'vandaag';
  return 'nog ' + (dagen === 1 ? '1 dag' : dagen + ' dagen');
}

// Mijn e-mailadres in kleine letters, voor 'Mijn geldbronnen'.
function gbIkEmail_() {
  var m = (gbApp && gbApp.momentopname) || {};
  return gbTekst_((m.ik && m.ik.email) || (gbApp && gbApp.email)).toLowerCase();
}

// De naam van een lid uit de kandidaten (actieve leden), of null.
function gbKandidaatNaam_(m, email) {
  var lijst = (m && m.geldbronnen && m.geldbronnen.kandidaten) || [];
  for (var i = 0; i < lijst.length; i++) if (gbTekst_(lijst[i].email).toLowerCase() === email) return gbTekst_(lijst[i].naam) || email;
  return null;
}

function gbMagBewerken_() {
  // ook als de editie op slot staat: verantwoorden loopt na de kascontrole door
  return heeftRecht((gbApp && gbApp.rechten) || [], 'geldbronnen_bewerken');
}

// ---- de bronnen: stand van het achterwerk plus wat nog verwerkt wordt ----

// Eigen opdrachten voor de geldbronnen die nog niet in de gelezen stand zitten, oudste eerst.
function gbWachtend_(m) {
  var lijst = ((m && m.mijnOpdrachten) || []).filter(function (o) {
    return GB_TYPEN[o.type] === true && (o.status === 'nieuw' || o.status === 'onderweg') && o.gegevens && typeof o.gegevens === 'object';
  });
  var server = lijst.filter(function (o) { return o.status === 'nieuw'; }).reverse();
  var wachtrij = lijst.filter(function (o) { return o.status === 'onderweg'; });
  return server.concat(wachtrij);
}

function gbZoek_(bronnen, id) {
  for (var i = 0; i < bronnen.length; i++) if (bronnen[i].id === id) return i;
  return -1;
}

// De bronnen zoals ze er na het verwerken uitzien; nieuwe en gewijzigde bronnen hebben wacht = true, verwijderde weg = true.
function gbBronnen_(m) {
  var bronnen = ((m && m.geldbronnen && m.geldbronnen.bronnen) || []).map(function (b) {
    return { id: b.id, naam: b.naam, soort: b.soort, bedragCenten: Number(b.bedragCenten) || 0, termijn: b.termijn || '', status: b.status, contact: b.contact || '',
      toelichting: b.toelichting || '', verantwoording: b.verantwoording || '', opgepaktDoor: gbTekst_(b.opgepaktDoor).toLowerCase(),
      opgepaktDoorNaam: gbTekst_(b.opgepaktDoorNaam), wacht: false, weg: false };
  });
  gbWachtend_(m).forEach(function (o) {
    var g = o.gegevens;
    var plek = gbZoek_(bronnen, g.id);
    if (o.type === 'geldbronVerwijderen') {
      if (plek !== -1) bronnen[plek].weg = true;
      return;
    }
    var centen = gbCenten_(String(g.bedrag === undefined || g.bedrag === null ? '' : g.bedrag));
    if (centen === null || typeof g.naam !== 'string' || g.naam.trim() === '' || typeof g.id !== 'string') return;
    var nieuw = { id: g.id, naam: g.naam.trim(), soort: g.soort, bedragCenten: centen, termijn: gbTekst_(g.termijn), status: g.status, contact: gbTekst_(g.contact),
      toelichting: gbTekst_(g.toelichting), verantwoording: gbTekst_(g.verantwoording), opgepaktDoor: '', opgepaktDoorNaam: '', wacht: true, weg: false };
    // zoals het achterwerk: een opdracht zonder dit veld laat wie de bron oppakt ongemoeid
    if (g.opgepaktDoor === undefined || g.opgepaktDoor === null) {
      if (plek !== -1) { nieuw.opgepaktDoor = bronnen[plek].opgepaktDoor; nieuw.opgepaktDoorNaam = bronnen[plek].opgepaktDoorNaam; }
    } else {
      nieuw.opgepaktDoor = gbTekst_(g.opgepaktDoor).toLowerCase();
      var oud = plek !== -1 && bronnen[plek].opgepaktDoor === nieuw.opgepaktDoor ? bronnen[plek].opgepaktDoorNaam : '';
      nieuw.opgepaktDoorNaam = nieuw.opgepaktDoor === '' ? '' : oud || gbKandidaatNaam_(m, nieuw.opgepaktDoor) || nieuw.opgepaktDoor;
    }
    if (plek === -1) bronnen.push(nieuw); else bronnen[plek] = nieuw;
  });
  return bronnen;
}

function gbZichtbaar_(bronnen) { return bronnen.filter(function (b) { return !b.weg; }); }

function gbSom_(bronnen, statussen) {
  var som = 0;
  bronnen.forEach(function (b) { if (statussen.indexOf(b.status) !== -1) som += b.bedragCenten; });
  return som;
}

// De bron met de vroegste termijn vanaf vandaag die nog aangevraagd moet worden (zelfde regel als het achterwerk).
function gbEerstvolgende_(bronnen) {
  var vandaag = gbVandaag_();
  var beste = null;
  bronnen.forEach(function (b) {
    if (GB_NOG_AAN_TE_VRAGEN.indexOf(b.status) === -1 || !gbIsDatum_(b.termijn)) return;
    var dagen = gbDagen_(vandaag, b.termijn);
    if (dagen < 0) return;
    if (beste === null || dagen < beste.dagen) beste = { bron: b, dagen: dagen };
  });
  return beste;
}

// ---- onderdelen ----

function gbTegel_(label, waarde, sub) {
  return el('div', { class: 'kaart tegel' },
    el('span', { class: 'tegel-label' }, label),
    el('span', { class: 'tegel-waarde' }, waarde),
    el('span', { class: 'tegel-sub' }, sub));
}

function gbTekenTegels_(bronnen) {
  var m = gbApp.momentopname || {};
  var begroot = Number(m.geldbronnen && m.geldbronnen.totaal && m.geldbronnen.totaal.begroot) || 0;
  var toegezegd = gbSom_(bronnen, GB_TELT_MEE);
  var ontvangen = gbSom_(bronnen, GB_ONTVANGEN);
  var aangevraagd = gbSom_(bronnen, ['aanvragen']);
  var tegels = [
    gbTegel_('Begroot uit subsidie en sponsoring', euro(begroot), begroot > 0 ? 'zie de begroting' : 'nog niets begroot'),
    gbTegel_('Toegezegd', euro(toegezegd), aangevraagd > 0 ? 'daarnaast ' + euro(aangevraagd) + ' aan te vragen' : 'telt vanzelf mee in de begroting'),
    gbTegel_('Ontvangen', euro(ontvangen), toegezegd > ontvangen ? euro(toegezegd - ontvangen) + ' moet nog binnenkomen' : 'op de bank of in de kas')
  ];
  gbVak.tegels.replaceChildren.apply(gbVak.tegels, tegels);
}

function gbTekenBalk_(bronnen) {
  var e = gbEerstvolgende_(bronnen);
  if (e === null) { gbVak.balk.replaceChildren(); gbVak.balk.hidden = true; return; }
  gbVak.balk.hidden = false;
  var b = e.bron;
  var sub = gbDatumTekst_(b.termijn) + ' (' + gbDagenTekst_(e.dagen) + ')' + (b.toelichting ? '. ' + b.toelichting : '');
  gbVak.balk.replaceChildren(
    el('span', { class: 'gb-balk-icoon' }, maakIcoon(GB_ICOON_BEL)),
    el('div', { class: 'gb-balk-tekst' },
      el('div', { class: 'gb-balk-titel' }, 'Eerstvolgende termijn: ' + b.naam),
      el('div', { class: 'gb-balk-sub' }, sub)),
    gbMagBewerken_() && !b.wacht ? el('button', { type: 'button', class: 'knop gb-balk-knop', onclick: function () { gbOpenFormulier_(b); } }, 'Openen') : '');
}

function gbTekenFilter_(bronnen) {
  var zicht = gbZichtbaar_(bronnen);
  var ik = gbIkEmail_();
  var mijn = ik === '' ? 0 : zicht.filter(function (b) { return b.opgepaktDoor === ik; }).length;
  var opties = [['alle', 'Alles', zicht.length], [GB_MIJN, 'Mijn geldbronnen', mijn]].concat(GB_STATUSSEN.map(function (s) {
    return [s[0], s[1], zicht.filter(function (b) { return b.status === s[0]; }).length];
  }));
  gbVak.filter.replaceChildren(el('fieldset', { class: 'chips gb-filter' },
    el('legend', null, 'Toon'),
    opties.map(function (o) {
      var invoer = el('input', { type: 'radio', name: 'gb-filter', value: o[0], onchange: function () { gbStaat.filter = o[0]; gbTekenBord_(gbBronnen_(gbApp.momentopname)); } });
      invoer.checked = gbStaat.filter === o[0];
      return el('label', { class: 'chip' }, invoer, o[1] + ' (' + o[2] + ')');
    })));
}

function gbTermijnRegel_(b) {
  var delen = [];
  if (gbIsDatum_(b.termijn)) {
    var open = GB_NOG_AAN_TE_VRAGEN.indexOf(b.status) !== -1;
    var dagen = gbDagen_(gbVandaag_(), b.termijn);
    var tekst = 'Uiterlijk ' + gbDatumTekst_(b.termijn);
    var dringend = false;
    if (open) {
      if (dagen < 0) { tekst += ' (verstreken)'; dringend = true; }
      else { tekst += ' (' + gbDagenTekst_(dagen) + ')'; dringend = dagen <= GB_TERMIJN_DAGEN; }
    }
    delen.push(el('span', { class: dringend ? 'gb-regel gb-regel-let' : 'gb-regel' }, tekst));
  }
  if (gbIsDatum_(b.verantwoording)) {
    var v = gbDagen_(gbVandaag_(), b.verantwoording);
    delen.push(el('span', { class: 'gb-regel' }, 'Verantwoorden vóór ' + gbDatumTekst_(b.verantwoording) + (v >= 0 && b.status !== 'afgerond' && GB_TELT_MEE.indexOf(b.status) !== -1 ? ' (' + gbDagenTekst_(v) + ')' : '')));
  }
  return delen;
}

function gbKaart_(b) {
  var kan = gbMagBewerken_() && !b.wacht && !b.weg;
  var inhoud = [
    el('span', { class: 'gb-kaart-kop' },
      el('span', { class: 'gb-naam' }, b.naam),
      el('span', { class: 'label label-grijs' }, gbLabel_(GB_SOORTEN, b.soort))),
    el('span', { class: 'gb-bedrag' }, b.bedragCenten > 0 ? euro(b.bedragCenten) : 'Bedrag nog onbekend'),
    b.toelichting ? el('span', { class: 'gb-toelichting' }, b.toelichting) : null,
    gbTermijnRegel_(b),
    el('span', { class: 'gb-regel gb-contact' }, b.contact ? b.contact : 'Contact nog onbekend'),
    el('span', { class: 'gb-regel gb-opgepakt' }, b.opgepaktDoor ? 'Opgepakt door: ' + (b.opgepaktDoorNaam || b.opgepaktDoor) : 'Nog niemand'),
    el('span', { class: 'gb-kaart-voet' },
      el('span', { class: 'label ' + gbStatusKlasse_(b.status) }, gbLabel_(GB_STATUSSEN, b.status)),
      b.weg ? el('span', { class: 'label label-geel' }, 'wordt verwijderd') : b.wacht ? el('span', { class: 'label label-geel' }, 'wordt verwerkt') : null)
  ];
  var kaart = kan
    ? el('button', { type: 'button', class: 'gb-kaart gb-kaart-knop', 'aria-label': 'Geldbron ' + b.naam + ' openen', onclick: function () { gbOpenFormulier_(b); } }, inhoud)
    : el('div', { class: b.weg ? 'gb-kaart gb-kaart-weg' : 'gb-kaart' }, inhoud);
  return el('li', null, kaart);
}

function gbStatusKlasse_(status) {
  if (status === 'afgewezen') return 'label-fout';
  if (status === 'verkennen') return 'label-grijs';
  if (status === 'aanvragen') return 'label-geel';
  return '';
}

function gbKolom_(status, titel, bronnen) {
  var lijst = bronnen.filter(function (b) { return b.status === status; });
  var inhoud = lijst.length === 0
    ? el('li', { class: 'gb-leeg' }, 'Nog niets')
    : lijst.map(gbKaart_);
  return el('section', { class: 'gb-kolom', 'aria-label': titel },
    el('h2', null, el('span', null, titel), el('span', { class: 'gb-aantal' }, String(lijst.filter(function (b) { return !b.weg; }).length))),
    el('ul', { class: 'gb-lijst' }, inhoud));
}

function gbTekenBord_(alleBronnen) {
  var ik = gbIkEmail_();
  var bronnen = gbStaat.filter === GB_MIJN ? alleBronnen.filter(function (b) { return ik !== '' && b.opgepaktDoor === ik; }) : alleBronnen;
  var zicht = gbZichtbaar_(alleBronnen);
  var vak = gbVak.bord;
  if (zicht.length === 0) {
    var kanBewerken = gbMagBewerken_();
    vak.replaceChildren(el('section', { class: 'kaart leeg' },
      maakIcoon('geldbronnen', 'pictogram groot'),
      el('h2', null, 'Nog geen geldbronnen'),
      el('p', null, kanBewerken
        ? 'Hier houden we bij waar het geld vandaan kan komen: subsidies, fondsen en sponsors. Voeg de bekende bronnen in één keer toe, of begin met je eigen.'
        : 'Er zijn nog geen geldbronnen toegevoegd.'),
      kanBewerken ? el('div', { class: 'knoppen' },
        el('button', { type: 'button', class: 'knop knop-hoofd', onclick: gbVoorbeeldToevoegen_ }, 'Voorbeeldbronnen toevoegen'),
        el('button', { type: 'button', class: 'knop', onclick: function () { gbOpenFormulier_(null); } }, '+ Bron toevoegen')) : null));
    return;
  }
  var onderdelen = [];
  var kolommen = GB_STATUSSEN.filter(function (s) { return s[0] !== 'afgewezen'; });
  var toon = gbStaat.filter;
  var kolommenAlle = toon === 'alle' || toon === GB_MIJN;
  if (!kolommenAlle && toon !== 'afgewezen') kolommen = kolommen.filter(function (s) { return s[0] === toon; });
  if (toon !== 'afgewezen') onderdelen.push(el('div', { class: 'gb-bord' + (kolommenAlle ? '' : ' gb-bord-een') }, kolommen.map(function (s) { return gbKolom_(s[0], s[1], bronnen); })));
  var afgewezen = bronnen.filter(function (b) { return b.status === 'afgewezen'; });
  if ((kolommenAlle || toon === 'afgewezen') && afgewezen.length > 0) {
    var details = el('details', { class: 'gb-afgewezen' },
      el('summary', null, 'Afgewezen (' + afgewezen.filter(function (b) { return !b.weg; }).length + ')'),
      el('ul', { class: 'gb-lijst gb-lijst-breed' }, afgewezen.map(gbKaart_)));
    details.open = gbStaat.afgewezenOpen || toon === 'afgewezen';
    details.addEventListener('toggle', function () { if (toon !== 'afgewezen') gbStaat.afgewezenOpen = details.open; });
    onderdelen.push(details);
  }
  onderdelen.push(el('p', { class: 'kas-noot' }, 'Per bron houden we bij: contactpersoon, bedrag, termijn, status en wat we achteraf moeten laten zien (verslag, foto\'s, vermelding op de flyer). Toegezegd en ontvangen geld telt vanzelf mee in de begroting.'));
  vak.replaceChildren.apply(vak, onderdelen);
}

// Meldingen: een wijziging die niet gelukt is (hooguit één, van de laatste 24 uur).
function gbTekenMelding_(m) {
  var nu = Date.now();
  var fout = ((m && m.mijnOpdrachten) || []).filter(function (o) {
    var t = Date.parse(o.ontvangenOp || '');
    return GB_TYPEN[o.type] === true && o.status === 'fout' && !gbStaat.verborgen[o.id] && (isNaN(t) || nu - t < GB_FOUT_VERSE_MS);
  })[0];
  var delen = [];
  if (fout) {
    delen.push(el('section', { class: 'strook strook-fout', role: 'alert' },
      el('span', { class: 'strook-tekst' }, 'Een wijziging in de geldbronnen is niet gelukt' + (fout.melding ? ': ' + fout.melding : '.')),
      el('button', { type: 'button', class: 'knop', onclick: function () { gbStaat.verborgen[fout.id] = true; gbTekenMelding_(gbApp.momentopname); } }, 'Sluiten')));
  }
  gbVak.melding.replaceChildren.apply(gbVak.melding, delen);
}

function gbTekenKop_() {
  var knoppen = [];
  if (gbMagBewerken_()) knoppen.push(el('button', { type: 'button', class: 'knop knop-hoofd', onclick: function () { gbOpenFormulier_(null); } }, '+ Bron toevoegen'));
  var m = gbApp.momentopname || {};
  var jaar = m.editie && m.editie.datum && /^\d{4}/.test(String(m.editie.datum)) ? String(m.editie.datum).slice(0, 4) : '';
  gbVak.kop.replaceChildren(
    el('div', null, el('h1', null, 'Geldbronnen'),
      el('p', null, 'Subsidies, fondsen en sponsors' + (jaar ? ' voor ' + jaar : '') + '. Wat toegezegd is, telt vanzelf mee in de begroting.')),
    el('div', { class: 'knoppen' }, knoppen));
}

// ---- voorbeeldbronnen ----

// De bronnen die we kennen, als opdrachtgegevens. De termijn en verantwoording van het Buurtbudget volgen de datum van het feest.
function gbVoorbeelden_(m) {
  var datum = m && m.editie && m.editie.datum ? String(m.editie.datum) : '';
  var heeftDatum = gbIsDatum_(datum);
  function bron(naam, soort, bedrag, toelichting, extra) {
    var g = { id: gbNieuwId_(), naam: naam, soort: soort, bedrag: bedrag, termijn: '', status: 'verkennen', contact: '', toelichting: toelichting, verantwoording: '' };
    Object.keys(extra || {}).forEach(function (k) { g[k] = extra[k]; });
    return g;
  }
  return [
    bron('Gemeente Alphen: Buurtbudget', 'subsidie', '500', 'Maximaal € 500 voor een buurtfeest. Minstens 3 weken vooraf aanvragen en vóór de eerste aanbetaling. Eten en drinken telt voor de helft mee. Verslag binnen 4 weken na het feest.',
      heeftDatum ? { termijn: gbPlusDagen_(datum, -21), verantwoording: gbPlusDagen_(datum, 28) } : {}),
    bron('Oranje Fonds', 'subsidie', '350', 'Maximaal € 350 als Burendag-bijdrage. De aanvraagronde opent in april.'),
    bron('Synchroon', 'sponsoring', '0', 'Bijdrage of sponsoring? Nog uitzoeken.'),
    bron('WIJwonen', 'sponsoring', '0', 'Leefbaarheid in de wijk.'),
    bron('Bolton Bouw', 'sponsoring', '0', 'Aannemer nieuwe woningen.'),
    bron('Knaap', 'sponsoring', '0', 'Aannemer huidige woningen.'),
    bron('Lokale ondernemers', 'sponsoring', '0', 'Sponsoring in geld of natura.')
  ];
}

function gbVoorbeeldToevoegen_() {
  if (!gbMagBewerken_() || gbZichtbaar_(gbBronnen_(gbApp.momentopname)).length > 0) return;
  gbVoorbeelden_(gbApp.momentopname).forEach(function (g) { gbApp.stuurOpdracht('geldbronOpslaan', g); });
}

// ---- formulier ----

function gbOpenFormulier_(b) {
  gbStaat.formulier = b
    ? { id: b.id, nieuw: false, naam: b.naam, soort: b.soort, status: b.status, bedrag: gbInvulBedrag_(b.bedragCenten), termijn: b.termijn || '', verantwoording: b.verantwoording || '',
      contact: b.contact || '', toelichting: b.toelichting || '', opgepaktDoor: b.opgepaktDoor || '', opgepaktDoorNaam: b.opgepaktDoorNaam || '', fouten: [] }
    : { id: gbNieuwId_(), nieuw: true, naam: '', soort: 'sponsoring', status: 'verkennen', bedrag: '', termijn: '', verantwoording: '', contact: '', toelichting: '',
      opgepaktDoor: '', opgepaktDoorNaam: '', fouten: [] };
  gbStaat.focus = true;
  gbTekenFormulier_();
}

function gbSluitFormulier_() {
  gbStaat.formulier = null;
  gbStaat.focus = false;
  gbTekenFormulier_();
}

function gbControleer_(f) {
  var fouten = [];
  var naam = f.naam.trim();
  if (naam === '') fouten.push('Vul de naam van de geldbron in.');
  else if (naam.length > GB_MAX_NAAM) fouten.push('De naam is te lang (maximaal ' + GB_MAX_NAAM + ' tekens).');
  if (!GB_SOORTEN.some(function (s) { return s[0] === f.soort; })) fouten.push('Kies de soort.');
  if (!GB_STATUSSEN.some(function (s) { return s[0] === f.status; })) fouten.push('Kies een status.');
  var centen = gbCenten_(f.bedrag.trim());
  if (centen === null) fouten.push('Vul een bedrag in, bijvoorbeeld 350 (of 0 als het nog onbekend is).');
  else if (centen > GB_MAX_CENTEN) fouten.push('Het bedrag is te hoog (maximaal € 100.000).');
  if (f.termijn !== '' && !gbIsDatum_(f.termijn)) fouten.push('Vul de termijn in als datum, of laat hem leeg.');
  if (f.verantwoording !== '' && !gbIsDatum_(f.verantwoording)) fouten.push('Vul de verantwoordingsdatum in als datum, of laat hem leeg.');
  if (f.contact.trim().length > GB_MAX_CONTACT) fouten.push('Het contact is te lang (maximaal ' + GB_MAX_CONTACT + ' tekens).');
  if (f.toelichting.trim().length > GB_MAX_TOELICHTING) fouten.push('De toelichting is te lang (maximaal ' + GB_MAX_TOELICHTING + ' tekens).');
  return fouten;
}

function gbOpslaan_() {
  var f = gbStaat.formulier;
  if (!f) return;
  f.fouten = gbControleer_(f);
  if (f.fouten.length > 0) { gbStaat.focus = false; gbTekenFormulier_(); gbVak.formulier.querySelector('.gb-fouten').focus(); return; }
  var gegevens = { id: f.id, naam: f.naam.trim(), soort: f.soort, bedrag: f.bedrag.trim(), termijn: f.termijn, status: f.status, contact: f.contact.trim(),
    toelichting: f.toelichting.trim(), verantwoording: f.verantwoording, opgepaktDoor: f.opgepaktDoor };
  gbStaat.formulier = null;
  gbApp.stuurOpdracht('geldbronOpslaan', gegevens);
  gbTekenFormulier_();
  gbTekenData_(); // staat de opdracht al in de wachtrij dan is dit hetzelfde als wat bijwerken tekende
}

function gbVerwijder_() {
  var f = gbStaat.formulier;
  if (!f || f.nieuw) return;
  if (!window.confirm('Geldbron "' + f.naam.trim() + '" verwijderen?')) return;
  var id = f.id;
  gbStaat.formulier = null;
  gbApp.stuurOpdracht('geldbronVerwijderen', { id: id });
  gbTekenFormulier_();
  gbTekenData_();
}

function gbVeld_(id, label, kind, hulp) {
  return el('div', { class: 'veld' }, el('label', { for: id }, label), kind, hulp ? el('span', { class: 'begr-hulp', id: id + '-hulp' }, hulp) : null);
}

function gbKeuze_(id, lijst, waarde, bijWijziging) {
  var keuze = el('select', { id: id, onchange: function (e) { bijWijziging(e.target.value); } },
    lijst.map(function (o) { return el('option', { value: o[0] }, o[1]); }));
  keuze.value = waarde;
  return keuze;
}

// Keuzes voor 'Opgepakt door': Nog niemand, de actieve leden en (als hij er niet bij staat) de huidige keuze als 'niet meer actief'.
function gbOpgepaktOpties_(f) {
  var kandidaten = (gbApp.momentopname && gbApp.momentopname.geldbronnen && gbApp.momentopname.geldbronnen.kandidaten) || [];
  var opties = [['', 'Nog niemand']].concat(kandidaten.map(function (k) { return [gbTekst_(k.email).toLowerCase(), gbTekst_(k.naam) || gbTekst_(k.email)]; }));
  if (f.opgepaktDoor !== '' && !opties.some(function (o) { return o[0] === f.opgepaktDoor; })) {
    opties.push([f.opgepaktDoor, (f.opgepaktDoorNaam || f.opgepaktDoor) + ' (niet meer actief)']);
  }
  return opties;
}

function gbTekenFormulier_() {
  var f = gbStaat.formulier;
  var vak = gbVak.formulier;
  if (!f || !gbMagBewerken_()) { gbStaat.formulier = null; vak.hidden = true; vak.replaceChildren(); return; }
  vak.hidden = false;
  var naam = el('input', { type: 'text', id: 'gb-naam', maxlength: String(GB_MAX_NAAM), autocomplete: 'off', oninput: function (e) { f.naam = e.target.value; } });
  naam.value = f.naam;
  var bedrag = el('input', { type: 'text', id: 'gb-bedrag', inputmode: 'decimal', autocomplete: 'off', placeholder: '0', maxlength: '14', 'aria-describedby': 'gb-bedrag-hulp',
    oninput: function (e) { f.bedrag = e.target.value; } });
  bedrag.value = f.bedrag;
  var termijn = el('input', { type: 'date', id: 'gb-termijn', 'aria-describedby': 'gb-termijn-hulp', oninput: function (e) { f.termijn = e.target.value; } });
  termijn.value = f.termijn;
  var verantwoording = el('input', { type: 'date', id: 'gb-verantwoording', oninput: function (e) { f.verantwoording = e.target.value; } });
  verantwoording.value = f.verantwoording;
  var contact = el('input', { type: 'text', id: 'gb-contact', maxlength: String(GB_MAX_CONTACT), autocomplete: 'off', oninput: function (e) { f.contact = e.target.value; } });
  contact.value = f.contact;
  var toelichting = el('textarea', { id: 'gb-toelichting', rows: '3', maxlength: String(GB_MAX_TOELICHTING), oninput: function (e) { f.toelichting = e.target.value; } });
  toelichting.value = f.toelichting;
  var fouten = el('div', { class: 'begr-fouten gb-fouten' + (f.fouten.length ? '' : ' begr-fouten-leeg'), role: 'alert', tabindex: '-1' },
    f.fouten.length ? el('ul', null, f.fouten.map(function (t) { return el('li', null, t); })) : null);
  vak.replaceChildren(
    el('h2', null, f.nieuw ? 'Geldbron toevoegen' : 'Geldbron bewerken'),
    el('form', { class: 'begr-formulier', novalidate: 'novalidate', onsubmit: function (e) { e.preventDefault(); gbOpslaan_(); } },
      fouten,
      el('div', { class: 'begr-velden' },
        gbVeld_('gb-naam', 'Naam', naam, 'Bijvoorbeeld: Oranje Fonds of Bakkerij Voorbeeld.'),
        gbVeld_('gb-soort', 'Soort', gbKeuze_('gb-soort', GB_SOORTEN, f.soort, function (w) { f.soort = w; })),
        gbVeld_('gb-status', 'Status', gbKeuze_('gb-status', GB_STATUSSEN, f.status, function (w) { f.status = w; })),
        gbVeld_('gb-bedrag', 'Bedrag', el('span', { class: 'kas-bedragveld' }, el('span', { class: 'kas-euro', 'aria-hidden': 'true' }, '€'), bedrag), 'Het maximum of het toegezegde bedrag. Vul 0 in als het nog onbekend is.'),
        gbVeld_('gb-termijn', 'Termijn (mag leeg)', termijn, 'De laatste dag om aan te vragen.'),
        gbVeld_('gb-verantwoording', 'Verantwoorden vóór (mag leeg)', verantwoording),
        gbVeld_('gb-contact', 'Contact (mag leeg)', contact, 'Naam of e-mailadres van een contactpersoon bij de organisatie, geen buren.'),
        gbVeld_('gb-opgepakt', 'Opgepakt door', gbKeuze_('gb-opgepakt', gbOpgepaktOpties_(f), f.opgepaktDoor, function (w) { f.opgepaktDoor = w; }), 'Het commissielid dat deze bron oppakt. Alleen die persoon krijgt de herinneringen.')),
      gbVeld_('gb-toelichting', 'Toelichting (mag leeg)', toelichting, 'Voorwaarden, wat we achteraf moeten laten zien, enzovoort.'),
      el('div', { class: 'knoppen' },
        el('button', { type: 'submit', class: 'knop knop-hoofd' }, 'Opslaan'),
        el('button', { type: 'button', class: 'knop', onclick: gbSluitFormulier_ }, 'Annuleren'),
        f.nieuw ? null : el('button', { type: 'button', class: 'knop knop-gevaar gb-verwijder', onclick: gbVerwijder_ }, 'Verwijderen'))));
  if (gbStaat.focus) { gbStaat.focus = false; naam.focus(); vak.scrollIntoView({ block: 'nearest' }); }
}

// ---- scherm ----

function gbTekenData_() {
  var m = gbApp.momentopname || {};
  var bronnen = gbBronnen_(m);
  var zicht = gbZichtbaar_(bronnen);
  gbTekenKop_();
  gbTekenMelding_(m);
  gbTekenBalk_(zicht);
  gbTekenTegels_(zicht);
  gbVak.filter.hidden = zicht.length === 0;
  if (zicht.length > 0) gbTekenFilter_(bronnen); else gbVak.filter.replaceChildren();
  gbTekenBord_(bronnen);
}

function gbTeken_(container, staat) {
  gbApp = staat;
  gbVergeetBijAnder_(staat.email);
  gbVak = {
    wortel: container,
    kop: el('header', { class: 'paginakop' }),
    melding: el('div', { class: 'stroken begr-meldingen' }),
    formulier: el('section', { class: 'kaart begr-paneel', 'aria-label': 'Geldbron toevoegen of bewerken', hidden: true }),
    balk: el('section', { class: 'kaart gb-balk', 'aria-label': 'Eerstvolgende termijn', hidden: true }),
    tegels: el('section', { class: 'tegels', 'aria-label': 'Stand' }),
    filter: el('div', { class: 'gb-filterkader', hidden: true }),
    bord: el('div', { class: 'gb-bordkader' })
  };
  container.replaceChildren(gbVak.kop, gbVak.melding, gbVak.formulier, gbVak.balk, gbVak.tegels, gbVak.filter, gbVak.bord);
  gbTekenData_();
  gbTekenFormulier_();
}

// Nieuwe gegevens: alles behalve het formulier opnieuw (er wordt misschien getypt).
function gbBijwerken_(container, staat) {
  if (!gbVak || gbVak.wortel !== container || !container.contains(gbVak.tegels)) { gbTeken_(container, staat); return; }
  gbApp = staat;
  gbVergeetBijAnder_(staat.email);
  gbTekenData_();
  if (gbStaat.formulier && !gbMagBewerken_()) gbTekenFormulier_(); // recht kwijt: formulier weg
}

registreerScherm({
  naam: 'geldbronnen',
  titel: 'Geldbronnen',
  recht: 'geldbronnen_zien',
  icoon: 'geldbronnen',
  teken: gbTeken_,
  bijwerken: gbBijwerken_
});
