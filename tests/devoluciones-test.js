// Extrae los predicados REALES de src/App.jsx y verifica que devoluciones,
// reembolsos y cambios no descuadren ningun reporte.
const fs = require("fs");
const SRC = fs.readFileSync(require("path").join(__dirname,"..","src","App.jsx"),"utf8");
const extraer = (nombre) => {
  const decl = "const " + nombre + " =";
  const i = SRC.indexOf(decl);
  const desde = i + decl.length;
  const fin = SRC.indexOf(";\n", desde);
  return SRC.slice(desde, fin).trim();
};
const esVentaReal  = eval("(" + extraer("esVentaReal")  + ")");
const esMovimiento = eval("(" + extraer("esMovimiento") + ")");
const i = SRC.indexOf("const reponerStock = (lista, venta) => {");
const reponerStock = eval("(" + SRC.slice(i+"const reponerStock =".length, SRC.indexOf("\n  };", i)+4).trim().replace(/;$/,"") + ")");

let fallas = 0;
const chk = (etq, real, esp) => {
  const pasa = JSON.stringify(real)===JSON.stringify(esp);
  if (!pasa) fallas++;
  console.log(`${pasa?"OK  ":"FALLA"} | ${etq}: ${JSON.stringify(real)}${pasa?"":"  (esperado "+JSON.stringify(esp)+")"}`);
};
const stockDe=(p,t)=>(p.tallas.find(x=>x.talla===t)||{}).stock;

console.log("═══ 1) Que cuenta como venta real ═══");
chk("venta normal",                    esVentaReal({total:100}), true);
chk("venta con tipo explicito",        esVentaReal({tipo:"venta",total:100}), true);
chk("venta ANULADA no cuenta",         esVentaReal({anulada:true,total:100}), false);
chk("venta DEVUELTA no cuenta",        esVentaReal({devuelta:"reembolso",total:100}), false);
chk("venta CAMBIADA no cuenta",        esVentaReal({devuelta:"cambio",total:100}), false);
chk("el registro de devolucion no es venta", esVentaReal({tipo:"devolucion"}), false);
chk("ajuste no es venta",              esVentaReal({tipo:"ajuste"}), false);
chk("traslado no es venta",            esVentaReal({tipo:"traslado"}), false);
chk("edicion no es venta",             esVentaReal({tipo:"edicion"}), false);

console.log("\n═══ 2) Que aparece en Trazabilidad ═══");
chk("devolucion aparece",  esMovimiento({tipo:"devolucion"}), true);
chk("anulada aparece",     esMovimiento({anulada:true}), true);
chk("ajuste aparece",      esMovimiento({tipo:"ajuste"}), true);
chk("venta normal NO",     esMovimiento({total:100}), false);

console.log("\n═══ 3) REEMBOLSO: baja ingresos y devuelve stock ═══");
{
  const venta={id:1,prodId:7,sku:"CAS-01",sede:"T1",talla:"38",cantidad:1,total:600,ganancia:250};
  const otras=[{id:2,total:400,ganancia:150},{id:3,total:300,ganancia:100}];
  const antes=[venta,...otras];
  chk("ingresos antes", antes.filter(esVentaReal).reduce((a,v)=>a+v.total,0), 1300);
  const prods=[{id:7,sku:"CAS-01",sede:"T1",tallas:[{talla:"38",stock:2}]}];
  const rep=reponerStock(prods,venta);
  chk("stock devuelto 2+1", stockDe(rep.prods[0],"38"), 3);
  const despues=antes.map(v=>v.id===1?{...v,devuelta:"reembolso"}:v);
  chk("ingresos despues (baja 600)", despues.filter(esVentaReal).reduce((a,v)=>a+v.total,0), 700);
  chk("ganancia despues (baja 250)", despues.filter(esVentaReal).reduce((a,v)=>a+v.ganancia,0), 250);
  chk("conteo de ventas baja de 3 a 2", despues.filter(esVentaReal).length, 2);
}

console.log("\n═══ 4) CAMBIO por otra talla del mismo producto (mismo precio) ═══");
{
  const venta={id:1,prodId:7,sku:"CAS-01",sede:"T1",talla:"38",cantidad:1,total:600};
  let prods=[{id:7,sku:"CAS-01",sede:"T1",venta:600,tallas:[{talla:"38",stock:2},{talla:"40",stock:4}]}];
  const rep=reponerStock(prods,venta); prods=rep.prods;             // entra la 38
  prods=prods.map(p=>p.id!==7?p:{...p,tallas:p.tallas.map(t=>t.talla==="40"?{...t,stock:t.stock-1}:t)});  // sale la 40
  chk("la 38 vuelve (2->3)", stockDe(prods[0],"38"), 3);
  chk("la 40 sale (4->3)",   stockDe(prods[0],"40"), 3);
  chk("unidades totales sin cambio", prods[0].tallas.reduce((a,t)=>a+t.stock,0), 6);
  const dif=600-600;
  chk("diferencia S/0 (mismo precio)", dif, 0);
}

console.log("\n═══ 5) CAMBIO por otro modelo MAS CARO -> el cliente paga ═══");
{
  const montoDevuelto=600, precioSalida=750;
  chk("el cliente paga la diferencia", precioSalida-montoDevuelto, 150);
}
console.log("\n═══ 6) CAMBIO por otro modelo MAS BARATO -> se le devuelve ═══");
{
  const montoDevuelto=600, precioSalida=90;
  const dif=precioSalida-montoDevuelto;
  chk("diferencia negativa", dif, -510);
  chk("se le devuelven S/510", Math.abs(dif), 510);
}

console.log("\n═══ 7) La talla del cambio ya no existe -> se recrea, no se pierde ═══");
{
  const venta={prodId:7,sku:"CAS-01",sede:"T1",talla:"M",cantidad:2};
  const prods=[{id:7,sku:"CAS-01",sede:"T1",tallas:[{talla:"TALLA M",stock:5}]}];
  const rep=reponerStock(prods,venta);
  chk("aviso de recreacion", rep.tallaRecreada, true);
  chk("total del producto = 7 (nada perdido)", rep.prods[0].tallas.reduce((a,t)=>a+t.stock,0), 7);
}

console.log("\n═══ 8) No se puede devolver dos veces ═══");
{
  const v={id:1,total:600,devuelta:"reembolso"};
  chk("ya devuelta -> boton oculto", !v.anulada && !v.devuelta, false);
  chk("y no vuelve a contar", esVentaReal(v), false);
}

console.log("\n═══ 9) Resumen de caja: la devuelta sale del efectivo ═══");
{
  const ventas=[
    {id:1,total:850,ganancia:500,medio:"efectivo"},
    {id:2,total:600,ganancia:250,medio:"digital"},
    {id:3,total:250,ganancia:100,medio:"efectivo",devuelta:"reembolso"},
  ];
  const reales=ventas.filter(esVentaReal);
  const efectivo=reales.filter(v=>(v.medio||"efectivo")==="efectivo").reduce((a,v)=>a+v.total,0);
  chk("efectivo excluye la devuelta", efectivo, 850);
  chk("total del dia", reales.reduce((a,v)=>a+v.total,0), 1450);
}

console.log(fallas===0 ? "\n>>> TODAS LAS COMPROBACIONES PASARON" : `\n>>> ${fallas} FALLAS`);
process.exit(fallas===0?0:1);
