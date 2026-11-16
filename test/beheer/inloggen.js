// Inloggen met Google Identity Services (GIS): de knop, het wachten op het script van Google en het bewijs naar het achterwerk.
// OAUTH_CLIENT_ID komt uit config.js (bij het uitrollen ingesteld; nooit in de code). Na een geslaagde login roept dit
// inloggenGelukt(antwoord) aan (app.js). Vereist: config.js, api.js (beheerVerzoek) en app.js (el, inloggenGelukt); alles wordt pas
// bij gebruik opgezocht, dus de laadvolgorde van de scripts maakt niet uit.

var GIS_WACHT_MS = 10000;          // zo lang wachten op het script van Google voordat we "geen verbinding" melden
var GIS_ADRES = 'https://accounts.google.com/gsi/client';
var TEKST_GIS_FOUT = 'Kan Google niet bereiken. Controleer je verbinding.';
var TEKST_INLOGGEN_FOUT = 'Inloggen lukt nu niet. Probeer het zo nog eens.';
var TEKST_NIET_INGESTELD = 'Inloggen is nog niet ingesteld op deze pagina. Vraag de beheerder om dit klaar te zetten.';

// vak = de inhoud van het inlogscherm van nu; gis = 'wacht' | 'fout' (het script is er als window.google.accounts.id bestaat)
var inloggenStaat = { vak: null, gis: 'wacht', bezig: false, melding: '', timer: null, geinitialiseerd: false };

function inloggenIsLokaal_() { return typeof LOKAAL !== 'undefined' && LOKAAL === true; }
function inloggenClientId_() { return typeof OAUTH_CLIENT_ID === 'string' ? OAUTH_CLIENT_ID : ''; }
function inloggenGisBeschikbaar_() {
  return !!(window.google && window.google.accounts && window.google.accounts.id);
}

// Het script van Google is binnen (aangeroepen door onload in index.html).
function inloggenGisKlaar() {
  clearTimeout(inloggenStaat.timer);
  inloggenStaat.gis = 'wacht';
  inloggenTekenKnop_();
}

// Het script van Google kon niet worden geladen (aangeroepen door onerror in index.html).
function inloggenGisFout() {
  clearTimeout(inloggenStaat.timer);
  inloggenStaat.gis = 'fout';
  inloggenTekenKnop_();
}

// Nog eens proberen: het script opnieuw laden.
function inloggenGisOpnieuw_() {
  var oud = document.querySelectorAll('script[src^="' + GIS_ADRES + '"]');
  for (var i = 0; i < oud.length; i++) oud[i].parentNode.removeChild(oud[i]);
  inloggenStaat.gis = 'wacht';
  inloggenTekenKnop_();
  var s = document.createElement('script');
  s.src = GIS_ADRES; s.async = true; s.defer = true;
  s.onload = inloggenGisKlaar; s.onerror = inloggenGisFout;
  document.head.appendChild(s);
}

function inloggenZetMelding_(tekst) {
  inloggenStaat.melding = tekst || '';
  var vak = inloggenStaat.vak;
  if (!vak) return;
  var m = vak.querySelector('.inlog-melding');
  if (m) { m.textContent = inloggenStaat.melding; m.hidden = !inloggenStaat.melding; }
}

function inloggenZetBezig_(bezig) {
  inloggenStaat.bezig = bezig;
  var vak = inloggenStaat.vak;
  if (!vak) return;
  var status = vak.querySelector('.inlog-status'), knoppen = vak.querySelector('.inlog-knoppen');
  if (status) status.hidden = !bezig;
  if (knoppen) knoppen.hidden = bezig;
}

// Het bewijs van Google is binnen: naar het achterwerk, dat de commissielijst controleert.
function inloggenBewijs_(antwoord) {
  if (inloggenStaat.bezig) return; // GIS kan de callback twee keer geven: één inlogpoging tegelijk
  if (!antwoord || !antwoord.credential) { inloggenZetMelding_(TEKST_INLOGGEN_FOUT); return; }
  inloggenZetMelding_('');
  inloggenZetBezig_(true);
  beheerVerzoek('beheerInloggen', { idToken: antwoord.credential }).then(function (a) {
    if (a && a.ok === true) { inloggenStaat.bezig = false; inloggenGelukt(a); return; }
    inloggenZetBezig_(false);
    inloggenZetMelding_(a && a.code === 'SESSIE' && a.melding ? a.melding : TEKST_INLOGGEN_FOUT);
  }, function () {
    inloggenZetBezig_(false);
    inloggenZetMelding_('Geen verbinding met de beheerpagina. Controleer je verbinding en probeer het nog eens.');
  });
}

// Zet de knop van Google (of de melding en de herhaalknop) in het vak .inlog-google.
function inloggenTekenKnop_() {
  var vak = inloggenStaat.vak;
  var plek = vak && vak.isConnected ? vak.querySelector('.inlog-google') : null;
  if (!plek) return;
  clearTimeout(inloggenStaat.timer);
  plek.replaceChildren();
  if (inloggenClientId_() === '') {
    plek.appendChild(el('p', { class: 'inlog-uitleg-klein', role: 'status' }, TEKST_NIET_INGESTELD));
    return;
  }
  if (inloggenGisBeschikbaar_()) {
    try {
      if (!inloggenStaat.geinitialiseerd) {
        google.accounts.id.initialize({ client_id: inloggenClientId_(), callback: inloggenBewijs_, auto_select: false, use_fedcm_for_prompt: true });
        inloggenStaat.geinitialiseerd = true;
      }
      var breedte = Math.max(200, Math.min(400, Math.floor(plek.clientWidth || 300)));
      google.accounts.id.renderButton(plek, { type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'nl', width: breedte });
      return;
    } catch (fout) {
      inloggenStaat.gis = 'fout';
    }
  }
  if (inloggenStaat.gis === 'fout') {
    plek.appendChild(el('div', { class: 'inlog-gis-fout', role: 'status' },
      el('p', null, TEKST_GIS_FOUT),
      el('button', { type: 'button', class: 'knop', onclick: inloggenGisOpnieuw_ }, 'Opnieuw proberen')));
    return;
  }
  // het script is nog onderweg: even wachten, en komt het niet, dan de melding met herhaalknop (komt het later alsnog, dan verschijnt de knop)
  plek.appendChild(el('p', { class: 'inlog-wacht', role: 'status' }, el('span', { class: 'laadpunt' }), 'Google wordt geladen…'));
  inloggenStaat.timer = setTimeout(function () {
    if (!inloggenGisBeschikbaar_()) { inloggenStaat.gis = 'fout'; inloggenTekenKnop_(); }
  }, GIS_WACHT_MS);
}

// Vult de kaart van het inlogscherm. melding = een tekst van het achterwerk of van de schil (bijvoorbeeld "Je bent uitgelogd").
function tekenInlogInhoud(vak, melding) {
  inloggenStaat.vak = vak;
  inloggenStaat.melding = melding || inloggenStaat.melding;
  var lokaal = inloggenIsLokaal_();
  var knoppen = el('div', { class: 'inlog-knoppen' });
  // lokaal (testserver zonder Google): alleen de knop die iedereen binnenlaat
  if (!lokaal) knoppen.appendChild(el('div', { class: 'inlog-google' }));
  if (lokaal) {
    var knop = el('button', { type: 'button', class: 'knop knop-hoofd knop-breed' }, 'Lokaal inloggen');
    knop.addEventListener('click', function () {
      knop.disabled = true; inloggenZetMelding_('');
      beheerVerzoek('beheerInloggen', {}).then(function (a) {
        if (a && a.ok === true) { inloggenGelukt(a); return; }
        inloggenZetMelding_((a && a.melding) || TEKST_INLOGGEN_FOUT); knop.disabled = false;
      }, function () { inloggenZetMelding_('Geen verbinding met de lokale server.'); knop.disabled = false; });
    });
    knoppen.appendChild(knop);
  }
  vak.appendChild(el('p', { class: 'inlog-uitleg' }, 'Log in met het Google-account dat bij de commissie bekend is.'));
  vak.appendChild(knoppen);
  vak.appendChild(el('p', { class: 'inlog-status', role: 'status', hidden: !inloggenStaat.bezig }, el('span', { class: 'laadpunt' }), 'Bezig met inloggen…'));
  vak.appendChild(el('p', { class: 'inlog-melding', role: 'alert', hidden: !inloggenStaat.melding }, inloggenStaat.melding));
  knoppen.hidden = inloggenStaat.bezig;
  if (!lokaal) inloggenTekenKnop_();
}

// Bij uitloggen: Google mag je niet meer stilletjes opnieuw inloggen.
function inloggenUitgelogd() {
  inloggenStaat.melding = '';
  inloggenStaat.bezig = false;
  try { if (inloggenGisBeschikbaar_() && typeof google.accounts.id.disableAutoSelect === 'function') google.accounts.id.disableAutoSelect(); } catch (e) { /* niet erg */ }
}
