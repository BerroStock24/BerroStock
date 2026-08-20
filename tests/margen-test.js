// Extrae mg() REAL de src/App.jsx. El margen se calcula sobre el PRECIO DE
// VENTA, no sobre el costo: de cada sol que entra a la caja, cuanto es ganancia.
// Es el inverso de como el dueno fija precios: venta = compra / (1 - margen).
const fs = require("fs");
const SRC = fs.readFileSync(require("path").join(__dirname,"..","src","App.jsx"),"utf8");
const i = SRC.indexOf("const mg ");
if (i < 0) throw new Error("No se encontro mg() en App.jsx");
const linea = SRC.slice(i, SRC.indexOf("\n", i));
const mg = eval("(" + linea.slice(linea.indexOf("=") + 1).trim().replace(/;$/,"") + ")");

let fallas = 0;
const chk = (etq, real, esp) => {
  const pasa = JSON.stringify(real) === JSON.stringify(esp);
  if (!pasa) fallas++;
  console.log(`${pasa?"OK  ":"FALLA"} | ${etq}: ${JSON.stringify(real)}${pasa?"":"  (esperado "+JSON.stringify(esp)+")"}`);
};

console.log("═══ 1) Margen sobre venta, no sobre costo ═══");
// Con la formula vieja (sobre costo) estos daban 67, 100, 25 y 200.
chk("compra 120 venta 200", mg(120,200), "40");
chk("compra 50 venta 100",  mg(50,100),  "50");
chk("compra 80 venta 100",  mg(80,100),  "20");
chk("compra 30 venta 90",   mg(30,90),   "67");

console.log("\n═══ 2) Ida y vuelta con la formula de fijar precios ═══");
// El dueno fija el precio como compra/(1-margen). mg() tiene que devolver
// exactamente ese margen: si no, la pantalla contradice como se puso el precio.
{
  const precioPara = (compra, margen) => compra / (1 - margen/100);
  [[120,30],[120,40],[50,50],[85,25],[200,60],[35,20]].forEach(([compra,m]) => {
    const venta = precioPara(compra, m);
    chk(`compra ${compra} al ${m}% -> venta ${venta.toFixed(2)}`, mg(compra, venta), String(m));
  });
}

console.log("\n═══ 3) El caso que motivo el cambio: descuentos ═══");
{
  // Comprado a 120, vendido a 200: margen real 40%.
  chk("precio de lista", mg(120,200), "40");
  // Con 30% de descuento vende a 140 y le quedan 20 soles de 80.
  chk("con 30% de descuento el margen se desploma", mg(120,140), "14");
  // La formula vieja mostraba 67% de lista, que hacia parecer que un descuento
  // del 30% dejaba un 37% comodo. En realidad quedan 14 puntos, no 37.
}

console.log("\n═══ 4) Guardas numericas ═══");
chk("sin costo (importado sin precio)", mg(0,100),        "—");
chk("costo undefined",                  mg(undefined,100), "—");
chk("venta en cero",                    mg(120,0),         "—");
chk("costo negativo",                   mg(-5,100),        "—");
chk("texto basura",                     mg("abc","xyz"),   "—");
chk("compra igual a venta",             mg(120,120),       "0");
chk("vendido a perdida",                mg(120,100),       "-20");

console.log("\n═══ 5) Redondeo ═══");
chk("2/3 redondea a 67", mg(30,90),      "67");
chk("1/3 redondea a 33", mg(100,150),    "33");
chk("centavos",          mg(99.9,199.8), "50");

console.log(fallas === 0 ? "\nTodo OK." : "\n" + fallas + " fallas.");
process.exit(fallas === 0 ? 0 : 1);
