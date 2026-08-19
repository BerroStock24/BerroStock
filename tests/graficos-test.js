// Prueba la logica de acumulado y top-por-SKU replicando el codigo de DashboardView.
let fallas = 0;
const chk = (etq, real, esp) => {
  const pasa = JSON.stringify(real) === JSON.stringify(esp);
  if (!pasa) fallas++;
  console.log(`${pasa?"OK  ":"FALLA"} | ${etq}: ${JSON.stringify(real)}${pasa?"":"  (esperado "+JSON.stringify(esp)+")"}`);
};

// ── replica exacta del bloque `acum` ──
const calcAcum = (hist, HOY, metrica) => {
  const MES = HOY.getMonth(), ANIO = HOY.getFullYear();
  const diaHoy = HOY.getDate();
  const mesPrev = MES===0 ? 11 : MES-1;
  const anioPrev = MES===0 ? ANIO-1 : ANIO;
  const diasMesPrev = new Date(anioPrev, mesPrev+1, 0).getDate();
  const porDia = (mes, anio, tope) => {
    const d = Array(tope+1).fill(0);
    hist.forEach(v => {
      if (v.anulada || (v.tipo && v.tipo!=="venta")) return;
      const f = new Date(v.fecha);
      if (f.getMonth()!==mes || f.getFullYear()!==anio) return;
      const dia = f.getDate();
      if (dia<=tope) d[dia] += (v[metrica]||0);
    });
    let corr = 0;
    return d.map(x => (corr += x));
  };
  const actual = porDia(MES, ANIO, diaHoy);
  const prev = porDia(mesPrev, anioPrev, Math.min(diaHoy, diasMesPrev));
  const puntos = Array.from({length:diaHoy}, (_,i) => ({
    dia:i+1, actual:actual[i+1]||0, prev: prev[i+1]!=null ? prev[i+1] : null }));
  const totalActual = actual[diaHoy]||0;
  const totalPrev = prev[Math.min(diaHoy,diasMesPrev)]||0;
  const dif = totalPrev>0 ? ((totalActual-totalPrev)/totalPrev)*100 : null;
  return {puntos, totalActual, totalPrev, dif, diaHoy, hayPrev: totalPrev>0};
};

const v = (fecha, total, ganancia, extra={}) => ({fecha, total, ganancia, cantidad:1, ...extra});

console.log("═══ 1) ACUMULADO: suma corrida correcta ═══");
// hoy = 10 de agosto 2026
const HOY = new Date(2026, 7, 10, 12, 0);
const hist1 = [
  v("2026-08-01T10:00:00", 100, 40),
  v("2026-08-01T15:00:00", 50,  20),   // mismo dia -> se suman
  v("2026-08-03T10:00:00", 200, 80),
  v("2026-08-10T10:00:00", 300, 120),
];
const a1 = calcAcum(hist1, HOY, "total");
chk("puntos = un dia por cada dia transcurrido", a1.puntos.length, 10);
chk("dia 1 acumula las dos ventas", a1.puntos[0].actual, 150);
chk("dia 2 mantiene el acumulado (sin ventas)", a1.puntos[1].actual, 150);
chk("dia 3 suma", a1.puntos[2].actual, 350);
chk("dia 9 sigue plano", a1.puntos[8].actual, 350);
chk("dia 10 (hoy) total", a1.puntos[9].actual, 650);
chk("total del mes", a1.totalActual, 650);
chk("es monotono creciente", a1.puntos.every((p,i)=>i===0||p.actual>=a1.puntos[i-1].actual), true);

console.log("\n═══ 2) La metrica cambia con el toggle ═══");
const a1g = calcAcum(hist1, HOY, "ganancia");
chk("ganancia acumulada", a1g.totalActual, 260);
chk("ingresos != ganancia", a1.totalActual!==a1g.totalActual, true);

console.log("\n═══ 3) Comparacion vs mes anterior (mismo tramo) ═══");
const hist3 = [
  ...hist1,
  v("2026-07-05T10:00:00", 400, 100),   // julio, dentro del tramo (dia<=10)
  v("2026-07-25T10:00:00", 9999, 9999), // julio, FUERA del tramo -> no debe contar
];
const a3 = calcAcum(hist3, HOY, "total");
chk("mes previo solo cuenta hasta el dia 10", a3.totalPrev, 400);
chk("ignora el dia 25 de julio", a3.totalPrev!==10399, true);
chk("diferencia %", Math.round(a3.dif), 63);   // (650-400)/400 = 62.5%

console.log("\n═══ 4) Excluye anuladas, ajustes, traslados, ediciones ═══");
const hist4 = [
  v("2026-08-05T10:00:00", 100, 50),
  v("2026-08-05T11:00:00", 500, 200, {anulada:true}),
  v("2026-08-05T12:00:00", 700, 300, {tipo:"ajuste"}),
  v("2026-08-05T13:00:00", 800, 400, {tipo:"traslado"}),
  v("2026-08-05T14:00:00", 900, 500, {tipo:"edicion"}),
  v("2026-08-06T10:00:00", 100, 50,  {tipo:"venta"}),   // tipo explicito si cuenta
];
const a4 = calcAcum(hist4, HOY, "total");
chk("solo suma ventas reales", a4.totalActual, 200);

console.log("\n═══ 5) Borde: enero compara contra diciembre del año anterior ═══");
const ENE = new Date(2026, 0, 5, 12, 0);
const hist5 = [ v("2026-01-02T10:00:00",100,50), v("2025-12-03T10:00:00",80,40) ];
const a5 = calcAcum(hist5, ENE, "total");
chk("mes actual (enero)", a5.totalActual, 100);
chk("cruza el año hacia diciembre 2025", a5.totalPrev, 80);

console.log("\n═══ 6) Borde: mes previo mas corto (marzo vs febrero) ═══");
const MAR31 = new Date(2026, 2, 31, 12, 0);   // 31 mar; feb 2026 tiene 28
const hist6 = [ v("2026-03-15T10:00:00",100,50), v("2026-02-28T10:00:00",70,30) ];
const a6 = calcAcum(hist6, MAR31, "total");
chk("no inventa dias 29/30/31 de febrero", a6.totalPrev, 70);
chk("puntos del mes actual", a6.puntos.length, 31);

console.log("\n═══ 7) Sin historial previo -> sin comparacion ═══");
const a7 = calcAcum([v("2026-08-02T10:00:00",100,50)], HOY, "total");
chk("hayPrev falso", a7.hayPrev, false);
chk("dif es null (no divide por cero)", a7.dif, null);

console.log("\n═══ 8) TOP por SKU (no por talla), ordenado por ingresos ═══");
const ventasMes = [
  {sku:"CAS-01", producto:"Casaca TNF", talla:"38", total:300, ganancia:100, cantidad:1},
  {sku:"CAS-01", producto:"Casaca TNF", talla:"40", total:300, ganancia:100, cantidad:1},
  {sku:"CAS-01", producto:"Casaca TNF", talla:"42", total:300, ganancia:100, cantidad:1},
  {sku:"POL-09", producto:"Polo Basic", talla:"M",  total:500, ganancia:250, cantidad:10},
  {sku:"ZAP-77", producto:"Zapato",     talla:"40", total:100, ganancia:20,  cantidad:1},
];
const ag = {};
ventasMes.filter(x=>!x.tipo||x.tipo==="venta").forEach(x => {
  const k = x.sku || x.producto;
  if (!ag[k]) ag[k] = {sku:x.sku, nombre:x.producto, total:0, ganancia:0, unidades:0};
  ag[k].total+=(x.total||0); ag[k].ganancia+=(x.ganancia||0); ag[k].unidades+=(x.cantidad||0);
});
const top = Object.values(ag).sort((a,b)=>b.total-a.total).slice(0,5);
chk("las 3 tallas de CAS-01 se fusionan en 1 fila", top.length, 3);
chk("CAS-01 suma sus tallas", top.find(t=>t.sku==="CAS-01").total, 900);
chk("gana el de mas INGRESOS, no el de mas unidades", top[0].sku, "CAS-01");
chk("(POL-09 tiene 10u pero menos ingresos)", top.find(t=>t.sku==="POL-09").unidades, 10);
chk("orden descendente por ingresos", top.map(t=>t.total), [900,500,100]);

console.log(fallas===0 ? "\n>>> TODAS LAS COMPROBACIONES PASARON" : `\n>>> ${fallas} FALLAS`);
process.exit(fallas===0?0:1);
