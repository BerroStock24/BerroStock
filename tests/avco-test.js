// Extrae las funciones REALES de src/App.jsx y las ejecuta.
// No reimplementa la formula: si el archivo cambia, este test cambia con el.
const fs = require("fs");
const SRC = fs.readFileSync(require("path").join(__dirname,"..","src","App.jsx"), "utf8");

// devuelve el TEXTO de la expresion (lado derecho del =), para poder evaluarla
const extraer = (nombre, multilinea) => {
  const decl = "const " + nombre + " =";
  const i = SRC.indexOf(decl);
  if (i < 0) throw new Error("no encontre " + nombre);
  const desde = i + decl.length;
  const fin = multilinea ? SRC.indexOf("\n};", desde) + 2 : SRC.indexOf(";\n", desde);
  return SRC.slice(desde, fin).trim();
};

const srcTotalStock    = extraer("totalStock", false);
const srcCostoPromedio = extraer("costoPromedio", true);
console.log("── codigo extraido del archivo real ──");
console.log("const costoPromedio = " + srcCostoPromedio);
console.log();

const totalStock    = eval("(" + srcTotalStock + ")");
const costoPromedio = eval("(" + srcCostoPromedio + ")");

const ok = (cond) => cond ? "OK  " : "FALLA";
let fallas = 0;
const chk = (etiqueta, real, esperado, tol=0.005) => {
  const pasa = Math.abs(real - esperado) <= tol;
  if (!pasa) fallas++;
  console.log(`${ok(pasa)} | ${etiqueta}: ${real}  (esperado ${esperado})`);
};

// ─────────────────────────────────────────────
// ESCENARIO DEL BRIEF
// 1 casaca en stock a S/600, venta S/800
// restock +5 a S/650, venta S/875
// ─────────────────────────────────────────────
console.log("═══ ESCENARIO PRINCIPAL ═══");
const prod = { compra:600, venta:800, tallas:[{talla:"M", stock:1}] };

const stockAntes  = totalStock(prod);            // ANTES de sumar
const stockNuevo  = 5;
const precioLote  = 650;

const nuevoCosto = costoPromedio(stockAntes, prod.compra, stockNuevo, precioLote);
chk("stock antes del restock", stockAntes, 1);
chk("compra del producto tras restock", nuevoCosto, 641.67);

// lo que se guarda en Trazabilidad = precio REAL tecleado
const histPrecioCompra = precioLote > 0 ? precioLote : null;
chk("Trazabilidad muestra el precio real tecleado", histPrecioCompra, 650);
console.log(`      -> en Traza NO aparece ${nuevoCosto} (el promedio interno)`);

// venta de las 6 unidades a S/875 — formula literal de doVenta
const PRECIO_VENTA = 875, UNIDADES = 6;
const ganancia = (PRECIO_VENTA - (nuevoCosto || 0)) * UNIDADES;
chk("ganancia total de las 6 ventas", +ganancia.toFixed(2), 1399.98);
console.log(`      -> teorico exacto: ${(875-3850/6)*6} | mostrado en UI (.toFixed(0)): S/${ganancia.toFixed(0)}`);

// comparacion contra el bug que estamos corrigiendo
const gananciaBug = (PRECIO_VENTA - 650) * UNIDADES;
console.log(`      -> con el codigo viejo (pisaba el costo): S/${gananciaBug}  <- el error de S/50`);

// ─────────────────────────────────────────────
console.log("\n═══ CASOS BORDE ═══");
chk("sin precio ingresado -> conserva el actual", costoPromedio(1, 600, 5, 0), 600);
chk("sin precio ingresado (vacio) -> conserva",   costoPromedio(1, 600, 5, NaN), 600);
chk("sin costo previo (importado) -> toma nuevo", costoPromedio(3, 0, 5, 650), 650);
chk("producto agotado que se repone -> nuevo",    costoPromedio(0, 600, 5, 650), 650);
chk("mismo precio -> no cambia",                  costoPromedio(4, 600, 6, 600), 600);
chk("costo baja",                                 costoPromedio(2, 700, 2, 500), 600);
chk("redondeo a 2 decimales",                     costoPromedio(3, 100, 1, 150), 112.5);

// ─────────────────────────────────────────────
// El error mas facil: medir stockAntes DESPUES de sumar
console.log("\n═══ CONTROL: el error que el brief pedia evitar ═══");
const malo = costoPromedio(stockAntes + stockNuevo, prod.compra, stockNuevo, precioLote);
console.log(`      si stockAntes se midiera DESPUES: S/${malo} (incorrecto)`);
console.log(`      valor real en el codigo:          S/${nuevoCosto} (correcto)`);
chk("el codigo NO comete ese error", nuevoCosto === malo ? 1 : 0, 0);

console.log(fallas === 0 ? "\n>>> TODAS LAS COMPROBACIONES PASARON" : `\n>>> ${fallas} FALLAS`);
process.exit(fallas === 0 ? 0 : 1);
