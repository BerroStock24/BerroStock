// Extrae reponerStock REAL de src/App.jsx y lo ejercita.
const fs = require("fs");
const SRC = fs.readFileSync(require("path").join(__dirname,"..","src","App.jsx"),"utf8");
const i = SRC.indexOf("const reponerStock = (lista, venta) => {");
const j = SRC.indexOf("\n  };", i) + 4;
const reponerStock = eval("(" + SRC.slice(i + "const reponerStock =".length, j).trim().replace(/;$/,"") + ")");

let fallas = 0;
const chk = (etq, real, esp) => {
  const pasa = JSON.stringify(real)===JSON.stringify(esp);
  if (!pasa) fallas++;
  console.log(`${pasa?"OK  ":"FALLA"} | ${etq}: ${JSON.stringify(real)}${pasa?"":"  (esperado "+JSON.stringify(esp)+")"}`);
};
const stockDe = (p,talla) => (p.tallas.find(t=>t.talla===talla)||{}).stock;

console.log("═══ 1) Caso normal: nada cambio ═══");
{
  const prods=[{id:7, sku:"CAS-01", sede:"T1", tallas:[{talla:"M",stock:5}]}];
  const venta={prodId:7, sku:"CAS-01", sede:"T1", talla:"M", cantidad:2};
  const r=reponerStock(prods,venta);
  chk("stock repuesto 5+2", stockDe(r.prods[0],"M"), 7);
  chk("producto encontrado", r.encontrado, true);
  chk("no hizo falta recrear talla", r.tallaRecreada, false);
}

console.log("\n═══ 2) El SKU, nombre y sede cambiaron despues de la venta ═══");
{
  const prods=[{id:7, sku:"CAS-999", sede:"DEPOSITO", nombre:"Otro nombre", tallas:[{talla:"M",stock:5}]}];
  const venta={prodId:7, sku:"CAS-01", sede:"T1", talla:"M", cantidad:2};
  const r=reponerStock(prods,venta);
  chk("prodId lo encuentra igual", r.encontrado, true);
  chk("stock repuesto pese a SKU y sede distintos", stockDe(r.prods[0],"M"), 7);
}

console.log("\n═══ 3) La talla fue renombrada -> se recrea, no se pierde stock ═══");
{
  const prods=[{id:7, sku:"CAS-01", sede:"T1", tallas:[{talla:"TALLA M",stock:5}]}];
  const venta={prodId:7, sku:"CAS-01", sede:"T1", talla:"M", cantidad:2};
  const r=reponerStock(prods,venta);
  chk("aviso de talla recreada", r.tallaRecreada, true);
  chk("la talla vieja no se toco", stockDe(r.prods[0],"TALLA M"), 5);
  chk("la talla M vuelve con sus 2u", stockDe(r.prods[0],"M"), 2);
  chk("stock total del producto = 7 (nada perdido)", r.prods[0].tallas.reduce((a,t)=>a+t.stock,0), 7);
}

console.log("\n═══ 4) Venta VIEJA sin prodId -> respaldo por SKU+sede ═══");
{
  const prods=[{id:7, sku:"CAS-01", sede:"T1", tallas:[{talla:"M",stock:5}]}];
  const venta={sku:"CAS-01", sede:"T1", talla:"M", cantidad:3};   // sin prodId
  const r=reponerStock(prods,venta);
  chk("encontrado por SKU+sede", r.encontrado, true);
  chk("stock repuesto 5+3", stockDe(r.prods[0],"M"), 8);
}

console.log("\n═══ 5) El producto fue eliminado -> avisa, no rompe ═══");
{
  const prods=[{id:99, sku:"OTRO", sede:"T1", tallas:[{talla:"M",stock:5}]}];
  const venta={prodId:7, sku:"CAS-01", sede:"T1", talla:"M", cantidad:2};
  const r=reponerStock(prods,venta);
  chk("no encontrado", r.encontrado, false);
  chk("no toca otros productos", stockDe(r.prods[0],"M"), 5);
}

console.log("\n═══ 6) Dos productos con el MISMO SKU en sedes distintas ═══");
{
  const prods=[
    {id:7, sku:"CAS-01", sede:"T1", tallas:[{talla:"M",stock:5}]},
    {id:8, sku:"CAS-01", sede:"T2", tallas:[{talla:"M",stock:9}]},
  ];
  const venta={prodId:8, sku:"CAS-01", sede:"T2", talla:"M", cantidad:2};
  const r=reponerStock(prods,venta);
  chk("repone solo en la sede correcta (T2)", stockDe(r.prods[1],"M"), 11);
  chk("la otra sede queda intacta", stockDe(r.prods[0],"M"), 5);
}

console.log(fallas===0 ? "\n>>> TODAS LAS COMPROBACIONES PASARON" : `\n>>> ${fallas} FALLAS`);
process.exit(fallas===0?0:1);
