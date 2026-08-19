// Extrae las funciones REALES de src/App.jsx y las ejecuta.
const fs = require("fs");
const SRC = fs.readFileSync(require("path").join(__dirname,"..","src","App.jsx"), "utf8");

const extraer = (nombre, multi) => {
  const decl = "const " + nombre + " =";
  const i = SRC.indexOf(decl);
  if (i < 0) throw new Error("no encontre " + nombre);
  const desde = i + decl.length;
  const fin = multi ? SRC.indexOf("\n};", desde) + 2 : SRC.indexOf(";\n", desde);
  return SRC.slice(desde, fin).trim();
};

const totalStock        = eval("(" + extraer("totalStock", false) + ")");
const ultCosto          = eval("(" + extraer("ultCosto", false) + ")");
const tallaLbl          = eval("(" + extraer("tallaLbl", false) + ")");
const costoPromedio     = eval("(" + extraer("costoPromedio", true) + ")");
const consolidarImport  = eval("(" + extraer("consolidarImport", true) + ")");
globalThis.tallaLbl = tallaLbl;   // consolidarImport lo usa al armar el contexto

let fallas = 0;
const chk = (etiqueta, real, esp) => {
  const pasa = JSON.stringify(real) === JSON.stringify(esp);
  if (!pasa) fallas++;
  console.log(`${pasa ? "OK  " : "FALLA"} | ${etiqueta}: ${JSON.stringify(real)}${pasa ? "" : "  (esperado " + JSON.stringify(esp) + ")"}`);
};

const colMap = {sku:"sku", nombre:"nombre", talla:"talla", stock:"stock", compra:"compra", venta:"venta", sede:"sede"};

// ── replica de la logica de aplicacion de doImport (ramas A y B) ──
const aplicar = (prods, items, conflictos, modo) => {
  const reemplazar = modo === "reemplazar";
  const precioResuelto = (it, campo) => {
    const c = (conflictos||[]).find(x => x.key===it.key && x.campo===campo);
    if (!c) return it[campo];
    return c.elegido==="otro" ? (parseFloat(c.otro)||0) : (c.elegido||0);
  };
  let u = [...prods]; const nuevos = [];
  items.forEach((it,i) => {
    const compraReal = precioResuelto(it,"compra");
    const ventaReal  = precioResuelto(it,"venta");
    const unidades   = it.tallas.reduce((a,t)=>a+t.stock,0);
    const idx = u.findIndex(x => x.sku===it.sku && x.sede===it.sede);
    if (idx < 0) {
      nuevos.push({id:1000+i, sku:it.sku, nombre:it.nombre, sede:it.sede, compra:compraReal,
        ultimoCosto:compraReal, venta:ventaReal, archivado:false, tallas:it.tallas});
      return;
    }
    const ex = u[idx];
    if (reemplazar) {
      u[idx] = {...ex, nombre:it.nombre||ex.nombre, tallas:it.tallas,
        compra: compraReal>0?compraReal:ex.compra,
        ultimoCosto: compraReal>0?compraReal:ultCosto(ex),
        venta: ventaReal>0?ventaReal:ex.venta};
    } else {
      const stockPrevio = totalStock(ex);
      const newTallas = [...ex.tallas];
      it.tallas.forEach(nt => {
        const ti = newTallas.findIndex(t => t.talla===nt.talla);
        if (ti>=0) newTallas[ti] = {...newTallas[ti], stock:newTallas[ti].stock+nt.stock};
        else newTallas.push({...nt});
      });
      u[idx] = {...ex, tallas:newTallas,
        compra: costoPromedio(stockPrevio, ex.compra, unidades, compraReal),
        ultimoCosto: compraReal>0?compraReal:ultCosto(ex),
        venta: ventaReal>0?ventaReal:ex.venta};
    }
  });
  return [...u, ...nuevos];
};

// ═══════════════════════════════════════════════
console.log("═══ 1) CASO LIMPIO — 10 productos nuevos, sin duplicados ═══");
const filasLimpias = Array.from({length:10}, (_,i) => ({
  sku:"NEW-"+i, nombre:"Producto "+i, talla:"M", stock:3, compra:100+i, venta:200+i, sede:"Centro"
}));
const limpio = consolidarImport(filasLimpias, colMap);
chk("productos consolidados", limpio.items.length, 10);
chk("conflictos detectados", limpio.conflictos.length, 0);
console.log("      -> sin conflictos: la ventana se saltea, importa directo\n");

// ═══════════════════════════════════════════════
console.log("═══ 2) CONFLICTO EN RAMA B (sumar) ═══");
const appPrevia = [{id:1, sku:"CAS-01", sede:"Centro", nombre:"Casaca TNF",
  compra:500, ultimoCosto:500, venta:800, archivado:false, tallas:[{talla:"M",stock:2}]}];
const filasConf = [
  {sku:"CAS-01", nombre:"Casaca TNF", talla:"M", stock:1, compra:600, venta:875, sede:"Centro"},
  {sku:"CAS-01", nombre:"Casaca TNF", talla:"M", stock:5, compra:650, venta:875, sede:"Centro"},
];
const conf = consolidarImport(filasConf, colMap);
chk("una sola entrada por talla (no duplicada)", conf.items[0].tallas, [{talla:"M", stock:6}]);
chk("stock del archivo sumado entre filas", conf.items[0].tallas[0].stock, 6);
chk("conflicto de compra detectado", conf.conflictos.filter(c=>c.campo==="compra").length, 1);
chk("opciones ofrecidas", conf.conflictos.find(c=>c.campo==="compra").opciones, [600,650]);
chk("venta identica -> sin conflicto", conf.conflictos.filter(c=>c.campo==="venta").length, 0);

const elige650 = conf.conflictos.map(c => c.campo==="compra" ? {...c, elegido:650} : c);
const resB = aplicar(appPrevia, conf.items, elige650, "sumar");
chk("stock final (2 + 6)", totalStock(resB[0]), 8);
chk("compra = AVCO (2x500 + 6x650)/8", resB[0].compra, 612.5);
chk("ultimoCosto = el precio ELEGIDO", resB[0].ultimoCosto, 650);
chk("id preservado", resB[0].id, 1);
chk("archivado preservado", resB[0].archivado, false);
console.log();

// ═══════════════════════════════════════════════
console.log("═══ 3) MISMO CASO, RAMA A (reemplazar) ═══");
const resA = aplicar(appPrevia, conf.items, elige650, "reemplazar");
chk("stock final = el del Excel (6, no 8)", totalStock(resA[0]), 6);
chk("compra = reset al elegido, sin promediar", resA[0].compra, 650);
chk("ultimoCosto = el precio ELEGIDO", resA[0].ultimoCosto, 650);
chk("id preservado", resA[0].id, 1);
console.log();

// ═══════════════════════════════════════════════
console.log("═══ CONTROL: ultimoCosto nunca es un calculo ═══");
const todos = [...resB, ...resA];
const sospechosos = todos.filter(p => {
  const uc = p.ultimoCosto;
  return uc !== 650 && uc !== 500 && !Number.isInteger(uc);
});
chk("ningun ultimoCosto con valor promediado", sospechosos.length, 0);
console.log(`      rama B -> compra:${resB[0].compra} (promedio)  ultimoCosto:${resB[0].ultimoCosto} (real)`);
console.log(`      rama A -> compra:${resA[0].compra} (real)      ultimoCosto:${resA[0].ultimoCosto} (real)`);

// ═══════════════════════════════════════════════
console.log("\n═══ CONTROL: productos ausentes del Excel ═══");
const conExtra = [...appPrevia, {id:2, sku:"POL-09", sede:"Centro", nombre:"Polo", compra:25,
  ultimoCosto:25, venta:49, archivado:true, tallas:[{talla:"L",stock:12}]}];
const resAus = aplicar(conExtra, conf.items, elige650, "reemplazar");
const polo = resAus.find(p=>p.sku==="POL-09");
chk("producto ausente queda intacto", polo, conExtra[1]);
chk("archivado NO se desarchiva solo", polo.archivado, true);

console.log(fallas===0 ? "\n>>> TODAS LAS COMPROBACIONES PASARON" : `\n>>> ${fallas} FALLAS`);
process.exit(fallas===0?0:1);
