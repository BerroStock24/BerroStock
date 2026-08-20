// Extrae las funciones REALES de normalizacion del escaner desde src/App.jsx.
// El bug que motivo esto: el mismo codigo de barras fisico se registraba como
// dos SKU distintos, porque se guardaba el texto crudo que devolvia el lector.
const fs = require("fs");
const SRC = fs.readFileSync(require("path").join(__dirname,"..","src","App.jsx"),"utf8");

const sacar = (firma, fin) => {
  const i = SRC.indexOf(firma);
  if (i < 0) throw new Error("No se encontro en App.jsx: " + firma);
  const j = SRC.indexOf(fin, i) + fin.length;
  return SRC.slice(i + firma.indexOf("=") + 1, j).trim().replace(/;$/,"");
};

const expandirUpcE     = eval("(" + sacar("const expandirUpcE = (c) => {",              "\n};") + ")");
const normalizarCodigo = eval("(" + sacar("const normalizarCodigo = (valor, formato) => {", "\n};") + ")");
const codigoAceptable  = eval("(" + sacar("const codigoAceptable = (cod, formato) => {",  "\n};") + ")");

let fallas = 0;
const chk = (etq, real, esp) => {
  const pasa = JSON.stringify(real) === JSON.stringify(esp);
  if (!pasa) fallas++;
  console.log(`${pasa?"OK  ":"FALLA"} | ${etq}: ${JSON.stringify(real)}${pasa?"":"  (esperado "+JSON.stringify(esp)+")"}`);
};

console.log("═══ 1) UPC-E se expande al UPC-A que le corresponde ═══");
// Caso canonico de la especificacion GS1.
chk("01234565 -> 012345000065", expandirUpcE("01234565"), "012345000065");
// Una por cada regla, segun el sexto digito central.
chk("regla D6=0", expandirUpcE("04210000"), "042000001000");
chk("regla D6=3", expandirUpcE("04252637"), "042500000267");
chk("regla D6=4", expandirUpcE("04252647"), "042520000067");
chk("no es UPC-E (7 digitos)", expandirUpcE("0123456"), null);
chk("no es UPC-E (con letras)", expandirUpcE("ABC12345"), null);

console.log("\n═══ 2) EL BUG: el mismo producto leido de dos formas ═══");
{
  // Un UPC-A de 12 digitos y ese mismo codigo leido como EAN-13 (con el 0
  // delante) son el MISMO producto. Antes generaban dos SKU distintos.
  const comoUpcA  = normalizarCodigo("036000291452", "upc_a");
  const comoEan13 = normalizarCodigo("0036000291452", "ean_13");
  chk("UPC-A normalizado a GTIN-13", comoUpcA, "0036000291452");
  chk("EAN-13 queda igual",          comoEan13, "0036000291452");
  chk("AMBOS DAN EL MISMO SKU",      comoUpcA === comoEan13, true);
}

console.log("\n═══ 3) UPC-E y su UPC-A tambien convergen ═══");
{
  const comoUpcE = normalizarCodigo("01234565", "upc_e");
  const comoUpcA = normalizarCodigo("012345000065", "upc_a");
  chk("UPC-E expandido y normalizado", comoUpcE, "0012345000065");
  chk("AMBOS DAN EL MISMO SKU",        comoUpcE === comoUpcA, true);
}

console.log("\n═══ 4) Lo que NO se debe tocar ═══");
chk("EAN-13 peruano intacto",   normalizarCodigo("7750182001234","ean_13"), "7750182001234");
chk("EAN-8 intacto",            normalizarCodigo("96385074","ean_8"),       "96385074");
chk("Code128 alfanumerico",     normalizarCodigo("nik-air-042","code_128"), "NIK-AIR-042");
chk("QR con texto libre",       normalizarCodigo("https://a.pe/x","qr_code"), "HTTPS://A.PE/X");
chk("espacios sobrantes",       normalizarCodigo("  7750182001234  ","ean_13"), "7750182001234");
chk("vacio no revienta",        normalizarCodigo(null,"ean_13"), "");

console.log("\n═══ 5) ITF: lecturas parciales rechazadas ═══");
// ITF no tiene digito verificador obligatorio: una vista parcial decodifica
// igual y devuelve un numero mas corto que parece valido.
chk("ITF-14 completo se acepta",  codigoAceptable("10036000291455","itf"), true);
chk("ITF parcial de 8 rechazado", codigoAceptable("10036000","itf"),       false);
chk("ITF parcial de 6 rechazado", codigoAceptable("100360","itf"),         false);
chk("EAN-13 no le aplica la regla ITF", codigoAceptable("7750182001234","ean_13"), true);
chk("formato desconocido: solo largo minimo", codigoAceptable("12345678"), true);
chk("codigo demasiado corto",     codigoAceptable("12"),                    false);

console.log("\n═══ 6) La doble confirmacion descarta lecturas sueltas ═══");
{
  // Reproduce la logica de `proponer`: dos lecturas identicas seguidas.
  const correr = (lecturas) => {
    let candidato = null, repes = 0, aceptado = null;
    for (const [valor, formato] of lecturas) {
      if (aceptado) break;
      const cod = normalizarCodigo(valor, formato);
      if (!cod || !codigoAceptable(cod, formato)) { candidato = null; repes = 0; continue; }
      if (cod === candidato) repes++; else { candidato = cod; repes = 1; }
      if (repes >= 2) aceptado = cod;
    }
    return aceptado;
  };
  chk("una sola lectura no alcanza",
      correr([["7750182001234","ean_13"]]), null);
  chk("dos identicas seguidas aceptan",
      correr([["7750182001234","ean_13"],["7750182001234","ean_13"]]), "7750182001234");
  chk("lectura suelta distinta no contamina",
      correr([["7750182009999","ean_13"],["7750182001234","ean_13"],["7750182001234","ean_13"]]), "7750182001234");
  chk("alternar sin repetir nunca acepta",
      correr([["7750182001234","ean_13"],["7750182009999","ean_13"],["7750182001234","ean_13"]]), null);
  chk("UPC-A y EAN-13 del mismo codigo SI confirman entre si",
      correr([["036000291452","upc_a"],["0036000291452","ean_13"]]), "0036000291452");
}

console.log(fallas === 0 ? "\nTodo OK." : "\n" + fallas + " fallas.");
process.exit(fallas === 0 ? 0 : 1);
