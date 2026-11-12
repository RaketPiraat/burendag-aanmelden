// Adrescode: straatafkorting + huisnummer + toevoeging, bijvoorbeeld PAL-27A.
// Een tweede huishouden op hetzelfde adres krijgt een achtervoegsel: PAL-27/2, PAL-27/3, ...

function normaliseerHuisnummer(invoer) {
  var tekst = String(invoer === null || invoer === undefined ? '' : invoer).trim();
  var m = /^(\d{1,5})\s*([A-Za-z]{0,2})$/.exec(tekst);
  var nummer = m ? parseInt(m[1], 10) : 0;
  if (!m || !(nummer > 0)) {
    throw new Error('Ongeldig huisnummer: "' + tekst + '"');
  }
  return { huisnummer: nummer, toevoeging: m[2].toUpperCase() };
}

// Valideert huisnummer en toevoeging elk apart (geen samenvoegen: 27 + '2' mag nooit 272 worden).
function controleerHuisnummerEnToevoeging(huisnummer, toevoeging) {
  var nr = String(huisnummer === null || huisnummer === undefined ? '' : huisnummer).trim();
  var toev = String(toevoeging === null || toevoeging === undefined ? '' : toevoeging).trim();
  if (!/^\d{1,5}$/.test(nr) || parseInt(nr, 10) < 1) {
    throw new Error('Ongeldig huisnummer: "' + nr + '"');
  }
  if (!/^[A-Za-z]{0,2}$/.test(toev)) {
    throw new Error('Ongeldige toevoeging bij huisnummer: "' + toev + '"');
  }
  return { huisnummer: parseInt(nr, 10), toevoeging: toev.toUpperCase() };
}

function sleutelStraat(naam) {
  return String(naam === null || naam === undefined ? '' : naam).replace(/\s+/g, '').toLowerCase();
}

function maakAdrescode(straat, huisnummer, toevoeging, straten) {
  var gezocht = sleutelStraat(straat);
  var gevonden = null;
  for (var i = 0; i < straten.length; i++) {
    if (gezocht !== '' && sleutelStraat(straten[i].naam) === gezocht) { gevonden = straten[i]; break; }
  }
  if (!gevonden) {
    throw new Error('Onbekende straat: "' + String(straat).trim() + '"');
  }
  var nr = controleerHuisnummerEnToevoeging(huisnummer, toevoeging);
  return gevonden.afkorting + '-' + nr.huisnummer + nr.toevoeging;
}

function volgendeAdrescode(basis, bestaande) {
  if (bestaande.indexOf(basis) === -1) return basis;
  var n = 2;
  while (bestaande.indexOf(basis + '/' + n) !== -1) n++;
  return basis + '/' + n;
}
