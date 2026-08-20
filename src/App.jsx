import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const HOY   = new Date();
const MES   = HOY.getMonth();
const ANIO  = HOY.getFullYear();
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const STOCK_BAJO = 3;
const PLAN_MAX   = 5;

const totalStock = (p) => p.tallas.reduce((a,t) => a+t.stock, 0);
// El costo que SE LE MUESTRA a la usuaria: siempre un precio real que ella tecleo
// o eligio, nunca un calculo. `compra` guarda el promedio ponderado y es interno.
// Fallback a compra para productos guardados antes de que existiera este campo.
const ultCosto = (p) => (p.ultimoCosto!=null && p.ultimoCosto!=="") ? p.ultimoCosto : p.compra;
// Etiqueta de talla: se muestra tal cual la escribio la usuaria, sin prefijo.
// El prefijo "T" daba dos problemas: "TM" se confunde con el simbolo de marca
// registrada, y las tallas con punto o espacio (40.5, 8 1/2 — reales en calzado)
// quedaban sin prefijo mientras 38 y 40 si lo tenian. Inconsistente a la vista.
// Se mantiene la funcion como unico punto de control del formato.
const tallaLbl = (t) => String(t);
// ── COSTEO AVCO (promedio ponderado) ──
// Metodo por defecto de Odoo para PYMEs. Al reponer, el costo del producto pasa a
// ser el promedio ponderado entre lo que ya habia y lo que entra, para que la
// ganancia de las ventas futuras no ignore lo que costaron las unidades viejas.
// OJO: stockAntes debe medirse ANTES de sumar las unidades nuevas.
// Es un valor de calculo interno del campo `compra`. En Trazabilidad se guarda
// siempre el precio REAL que tecleo la usuaria, nunca este promedio.
const costoPromedio = (stockAntes, costoAnt, stockNuevo, costoNuevo) => {
  const ca = parseFloat(costoAnt)   || 0;
  const cn = parseFloat(costoNuevo) || 0;
  if (cn <= 0)         return ca;   // no ingreso precio -> conservar el actual
  if (ca <= 0)         return cn;   // sin costo previo (ej. producto importado)
  if (stockAntes <= 0) return cn;   // agotado que se repone -> arranca de cero
  return Math.round(((stockAntes*ca + stockNuevo*cn) / (stockAntes+stockNuevo)) * 100) / 100;
};
// Margen sobre el PRECIO DE VENTA: de cada sol que entra a la caja, cuanto es
// ganancia. Es el inverso de como se fija el precio (venta = compra/(1-margen)):
// compra 120 con 30% de margen -> 120/0.7 = 171.43 -> mg(120,171.43) = 30%.
// Antes se dividia entre el costo, que da un numero mas alto (67% donde el
// margen real es 40%) y hace parecer que hay espacio para descuentos que no hay.
const mg         = (c,v) => { c=parseFloat(c)||0; v=parseFloat(v)||0; if(c<=0||v<=0) return "—"; return (((v-c)/v)*100).toFixed(0); };
const esHoy      = (f)   => { const d=new Date(f); return d.getDate()===HOY.getDate()&&d.getMonth()===MES&&d.getFullYear()===ANIO; };
const parseTallas= (s)   => { if(!s.trim()) return [{talla:"ÚNICA",stock:0}]; return s.split(",").map(x=>{const p=x.trim().split(":");return{talla:p[0].trim().toUpperCase(),stock:parseInt(p[1])||0};}).filter(t=>t.talla); };
const fmtFecha   = (iso) => { try { return new Date(iso).toLocaleDateString("es-PE",{day:"numeric",month:"short",year:"numeric"}); } catch { return "—"; } };
const fmtHora    = (iso) => { try { return new Date(iso).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}); } catch { return ""; } };
const LS = {
  get: (k,d) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):d; } catch { return d; } },
  // Devuelve true/false. NUNCA fallar en silencio: si el navegador se queda sin
  // espacio, la venta se ve en pantalla pero no se persiste, y al recargar
  // desaparece. La app depende de este booleano para avisar a la usuaria.
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); return true; } catch { return false; } },
};

const C = {
  bg:"#FAFAF7", card:"#FFFFFF", muted2:"#F4F3EE", border:"#E8E6DF",
  txt:"#1A1A18", muted:"#8A8880",
  // pr = primario de marca: botones primarios, navegacion activa, links, foco.
  pr:"#145FDF", prBg:"#EEF4FF", prLt:"#C7DBFF",
  // gr = SOLO señal semantica: ganancias, stock positivo, confirmaciones.
  // Es el verde de marca oscurecido; #4AB048 da 2.77:1 sobre blanco y no pasa AA.
  gr:"#2E7D2C", grBg:"#EDF7EC", grLt:"#C6E5C4",
  or:"#EA580C", orBg:"#FFF7ED", orLt:"#FED7AA",
  re:"#DC2626", reBg:"#FEF2F2",
  ye:"#D97706", yeBg:"#FFFBEB",
  pu:"#7C3AED", puBg:"#F5F3FF",
};
// ── MARCA ──
// verde: solo señal semántica (ganancias, stock ok, confirmaciones), nunca decorativo.
// verdeDk es la variante para fondos claros — el verde de marca da 2.77:1 sobre blanco.
const BRAND = {
  azul:"#145FDF", azulLt:"#387EF9", azulDk:"#013697",
  verde:"#4AB048", verdeLt:"#70D350", verdeDk:"#2E7D2C",
  marino:"#011230", tinta:"#1A1A24",
};

// ── ICONOS ──
// Trazo, nunca relleno. Grosor uniforme sobre lienzo 24x24 y color heredado del
// contexto via currentColor, para que cada icono siga al token de su seccion.
const ICOS = {
  caja:  ["M12 2.6 20.5 7.3v9.4L12 21.4 3.5 16.7V7.3z","M3.5 7.3 12 12l8.5-4.7","M12 12v9.4"],
  pin:   ["M12 21.4c4.3-4.3 6.4-7.7 6.4-10.2a6.4 6.4 0 1 0-12.8 0c0 2.5 2.1 5.9 6.4 10.2z","M14.4 11a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0z"],
  grafico:["M3.5 3.5v17h17","M8 16.5v-5","M12.8 16.5v-8.6","M17.6 16.5v-3"],
  alerta:["M10.3 4.2 2.6 17.8a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z","M12 9.4v4.2","M12 17.3h.01"],
  circAlerta:["M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z","M12 7.6v4.8","M12 16.2h.01"],
  calendario:["M5.5 4.8h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z","M3.5 9.4h17","M8.3 2.6v4","M15.7 2.6v4"],
  lapiz:["M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"],
  portapapeles:["M6.5 5.5h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z","M9.5 3.5h5a1 1 0 0 1 1 1v2h-7v-2a1 1 0 0 1 1-1z","M9 13.5l2 2 4-4.5"],
  traslado:["M3.5 8h14","M13.5 4l4 4-4 4","M20.5 16h-14","M10.5 20l-4-4 4-4"],
  archivo:["M3.5 7.5h17v3.2h-17z","M4.7 10.7v9.3a1 1 0 0 0 1 1h12.6a1 1 0 0 0 1-1v-9.3","M10 14.3h4"],
  candado:["M7 10.5V7.8a5 5 0 0 1 10 0v2.7","M5.5 10.5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z","M12 15v2.2"],
  engranaje:["M4 7h16","M13.2 7a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z","M4 12h16","M9.2 12a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z","M4 17h16","M16.2 17a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0z"],
  papelera:["M4.5 7.5h15","M9.5 7.5V5.3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2.2","M6.5 7.5l1 12.2a1 1 0 0 0 1 .9h7l1-13.1","M10 11v6M14 11v6"],
  codigo:["M3.5 6.5v11","M6.5 6.5v11","M9.5 6.5v11","M13 6.5v11","M17 6.5v11","M20.5 6.5v11"],
  billete:["M2.5 6.5h19a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-19a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z","M14.4 12a2.4 2.4 0 1 1-4.8 0 2.4 2.4 0 0 1 4.8 0z","M5.5 9.5h.01","M18.5 14.5h.01"],
  flechaAbajo:["M12 4v14","M6 12.5 12 19l6-6.5"],
};

// Categorias de gasto OPERATIVO. La compra de mercaderia NO va aca: ese costo ya
// se descuenta de la ganancia al vender (via el costo promedio del producto).
// Registrarla como egreso la restaria dos veces y la utilidad daria falsa.
const CAT_EGRESO = [
  {id:"alquiler",     label:"Alquiler",              ej:"local, puesto, depósito"},
  {id:"servicios",    label:"Servicios",             ej:"luz, agua, internet, teléfono"},
  {id:"sueldos",      label:"Sueldos y comisiones",  ej:"pago a vendedoras"},
  {id:"transporte",   label:"Transporte y delivery", ej:"flete, movilidad, motorizado"},
  {id:"empaques",     label:"Bolsas y empaques",     ej:"bolsas, cajas, etiquetas"},
  {id:"publicidad",   label:"Publicidad",            ej:"volantes, redes sociales"},
  {id:"mantenimiento",label:"Mantenimiento y limpieza", ej:"arreglos, útiles de limpieza"},
  {id:"impuestos",    label:"Impuestos y trámites",  ej:"SUNAT, licencias, contador"},
  {id:"otros",        label:"Otros",                 ej:"escribe el detalle"},
];
const catEgreso = (id) => CAT_EGRESO.find(c => c.id===id) || CAT_EGRESO[CAT_EGRESO.length-1];

// Medios de pago. Sin esto el resumen de caja no sirve: si vendio S/1000 pero
// S/600 fueron por Yape, en el cajon hay S/400. En Peru el pago digital es masivo.
const MEDIOS_PAGO = [
  {id:"efectivo", label:"Efectivo",   corto:"Efectivo"},
  {id:"digital",  label:"Yape / Plin", corto:"Yape/Plin"},
  {id:"tarjeta",  label:"Tarjeta",    corto:"Tarjeta"},
];
// Las ventas viejas no tienen medio: se asumen efectivo, que es lo que eran
// antes de que existiera el campo.
const medioPago = (id) => MEDIOS_PAGO.find(m => m.id===id) || MEDIOS_PAGO[0];

// UNICO criterio de "esto cuenta como venta". Todo calculo de ingresos, ganancia
// y ranking pasa por aca: si se repitiera a mano en cada reporte, alcanzaria con
// olvidarlo en uno para que los numeros dejen de cuadrar entre pantallas.
// Quedan fuera: los movimientos de inventario (ajuste, traslado, edicion,
// devolucion), las ventas anuladas y las devueltas.
const esVentaReal = (v) => (!v.tipo || v.tipo==="venta") && !v.anulada && !v.devuelta;

// Contraparte: todo lo que debe aparecer en Trazabilidad. Mismo motivo que arriba
// — un solo lugar, para que agregar un tipo de movimiento no obligue a recordar
// tres filtros distintos.
const esMovimiento = (v) => !!(v.tipo==="ajuste" || v.tipo==="traslado" || v.tipo==="edicion"
                         || v.tipo==="devolucion" || v.anulada);

const Ico = ({n, s=20, w=1.6, style}) => {
  const d = ICOS[n];
  if (!d) return null;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{display:"block",flexShrink:0,...(style||{})}}>
      {d.map((p,i) => <path key={i} d={p}/>)}
    </svg>
  );
};

// ── IMPORTACION: consolidar las filas del Excel ──
// Una entrada por SKU+sede, y dentro UNA sola entrada por talla con el stock
// SUMADO (antes quedaban tallas duplicadas en el array). Si el mismo producto
// trae precios distintos en filas distintas no inventamos nada: ni promedio ni
// "la primera" — se marca como conflicto para que la usuaria elija, porque
// ultimoCosto tiene que ser siempre un precio real, nunca un calculo.
const consolidarImport = (rows, colMap) => {
  const mapa = {};
  rows.forEach((r,i) => {
    const sku   = (r[colMap.sku]||"").toString().trim().toUpperCase() || ("IMP-"+i);
    const sede  = (colMap.sede && r[colMap.sede]) ? r[colMap.sede].toString().trim() : "Principal";
    const talla = (r[colMap.talla]||"UNICA").toString().trim().toUpperCase();
    const key   = sku+"||"+sede;
    if (!mapa[key]) mapa[key] = {key, sku, sede, nombre:"", tallasMap:{}, compras:[], ventas:[]};
    const e = mapa[key];
    const nom = String(r[colMap.nombre]||"").trim();
    if (!e.nombre && nom) e.nombre = nom;
    e.tallasMap[talla] = (e.tallasMap[talla]||0) + (parseInt(r[colMap.stock])||0);
    const c = parseFloat(r[colMap.compra])||0; if (c>0) e.compras.push(c);
    const v = parseFloat(r[colMap.venta]) ||0; if (v>0) e.ventas.push(v);
  });

  const items = Object.values(mapa).filter(e => e.nombre).map(e => {
    const cU = [...new Set(e.compras)].sort((a,b)=>a-b);
    const vU = [...new Set(e.ventas)].sort((a,b)=>a-b);
    return {
      key:e.key, sku:e.sku, sede:e.sede, nombre:e.nombre,
      tallas: Object.entries(e.tallasMap).map(([talla,stock]) => ({talla, stock})),
      compra: cU.length===1 ? cU[0] : 0,
      venta:  vU.length===1 ? vU[0] : 0,
      opcCompra: cU.length>1 ? cU : null,
      opcVenta:  vU.length>1 ? vU : null,
    };
  });

  const conflictos = [];
  items.forEach(it => {
    const unidades = it.tallas.reduce((a,t)=>a+t.stock,0);
    const ctx = it.tallas.map(t=>tallaLbl(t.talla)).join(", ")+" · "+unidades+"u";
    if (it.opcCompra) conflictos.push({key:it.key, campo:"compra", label:"Precio de compra", nombre:it.nombre, ctx, opciones:it.opcCompra, elegido:null, otro:""});
    if (it.opcVenta)  conflictos.push({key:it.key, campo:"venta",  label:"Precio de venta",  nombre:it.nombre, ctx, opciones:it.opcVenta,  elegido:null, otro:""});
  });
  return {items, conflictos};
};

const sh   = "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)";
const shMd = "0 4px 12px rgba(0,0,0,0.08),0 12px 32px rgba(0,0,0,0.06)";
const IS   = {width:"100%",background:C.muted2,border:"1.5px solid "+C.border,borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};

// ── LOGIN ──
const LoginScreen = ({onLogin, pines}) => {
  const [rol, setRol] = useState(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  const tap = (k) => {
    if (k === "del") { setPin(p => p.slice(0,-1)); setErr(false); return; }
    if (pin.length >= 4) return;
    const nx = pin + k;
    setPin(nx);
    if (nx.length === 4) {
      if (nx === pines[rol]) onLogin(rol);
      else { setErr(true); setTimeout(() => { setPin(""); setErr(false); }, 700); }
    }
  };

  const dsk = typeof window!=="undefined" && window.innerWidth>=768;
  const BG = {minHeight:"100vh",width:"100%",fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:dsk?"center":"flex-start",padding:dsk?"40px 20px":0,boxSizing:"border-box",background:BRAND.marino,position:"relative",overflow:"hidden"};
  const INNER = dsk
    ? {width:"100%",maxWidth:460,margin:"auto",display:"flex",flexDirection:"column",border:"1px solid rgba(56,126,249,0.16)",borderRadius:28,background:"rgba(1,26,66,0.55)",boxShadow:"0 24px 80px rgba(0,0,0,0.5),0 0 0 1px rgba(255,255,255,0.02) inset",overflow:"hidden"}
    : {width:"100%",maxWidth:440,display:"flex",flexDirection:"column",flex:1};

  if (!rol) return (
    <div style={BG}>
      <style>{"@keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} .a1{animation:fadeUp .5s ease .05s both} .a2{animation:fadeUp .5s ease .2s both} .a3{animation:fadeUp .5s ease .35s both} .a4{animation:fadeUp .5s ease .5s both} .roleBtn:active{transform:scale(0.98)}"}</style>
      <div style={INNER}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 28px 24px"}}>
        <div className="a1" style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28}}>
          <img src="/logo-512.png" alt="BerroStock" width="140" height="140" style={{display:"block",width:140,height:140,objectFit:"contain"}}/>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:700,letterSpacing:-1,color:"#FFFFFF",marginTop:14,lineHeight:1}}>Berro<span style={{color:BRAND.verde}}>Stock</span></div>
          <div style={{fontSize:13,color:"#D9E0EC",marginTop:10,letterSpacing:2.6,textTransform:"uppercase",fontWeight:500}}>Control inteligente de inventario</div>
        </div>
        <div className="a2" style={{display:"flex",gap:24,marginBottom:32}}>
          {[["caja","Stock"],["pin","Multi-sede"],["grafico","Reportes"]].map(([icon,label]) => (
            <div key={label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7}}>
              <div style={{color:BRAND.azulLt}}><Ico n={icon} s={20}/></div>
              <div style={{fontSize:10,color:"#8FA3BF",fontWeight:500,letterSpacing:0.5,textTransform:"uppercase"}}>{label}</div>
            </div>
          ))}
        </div>
        <div className="a3" style={{width:"100%",marginBottom:12}}>
          <div style={{fontSize:11,color:"#8FA3BF",textAlign:"center",marginBottom:14,fontWeight:600,letterSpacing:1.5,textTransform:"uppercase"}}>¿Quién eres?</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {r:"admin",    title:"Dueña / Admin",  sub:"Ganancias, reportes y configuración", acc:"rgba(1,54,151,0.30)",   brd:"rgba(56,126,249,0.42)"},
              {r:"vendedora",title:"Vendedora",       sub:"Stock, ventas y reposición",          acc:"rgba(20,95,223,0.14)",  brd:"rgba(56,126,249,0.26)"},
            ].map(x => (
              <button key={x.r} className="roleBtn" onClick={() => setRol(x.r)}
                style={{background:x.acc,border:"1px solid "+x.brd,borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14,transition:"all 0.15s"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#FFFFFF"}}>{x.title}</div>
                  <div style={{fontSize:12,color:"#8FA3BF",marginTop:2}}>{x.sub}</div>
                </div>
                <span style={{color:BRAND.azulLt,fontSize:18}}>›</span>
              </button>
            ))}
          </div>
        </div>
        <div className="a4" style={{fontSize:11,color:"#7C8FAB",marginTop:8}}>BerroStock v1.0 · Hecho en Perú</div>
      </div>
      </div>
    </div>
  );

  const acc = rol === "admin" ? BRAND.azulLt : BRAND.azul;
  return (
    <div style={BG}>
      <div style={INNER}>
      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"28px"}}>
        <button onClick={() => { setRol(null); setPin(""); setErr(false); }}
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#8FA3BF",fontSize:13,cursor:"pointer",fontFamily:"inherit",borderRadius:10,padding:"8px 16px",alignSelf:"flex-start"}}>
          ← Volver
        </button>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:"#FFFFFF",marginBottom:4}}>{rol==="admin"?"Dueña / Admin":"Vendedora"}</div>
          <div style={{fontSize:13,color:err?"#f87171":"#8FA3BF",marginBottom:28,transition:"color 0.2s"}}>{err?"PIN incorrecto. Intenta de nuevo.":"Ingresa tu PIN"}</div>
          <div style={{display:"flex",gap:16,marginBottom:36}}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{width:13,height:13,borderRadius:"50%",background:pin.length>i?(err?"#ef4444":acc):"rgba(255,255,255,0.12)",transition:"all 0.15s",transform:pin.length>i?"scale(1.2)":"scale(1)",boxShadow:pin.length>i?"0 0 10px "+acc+"80":"none"}}/>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,width:240}}>
            {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i) => (
              <button key={i} onClick={() => k && tap(k)}
                style={{background:k?"rgba(255,255,255,0.06)":"transparent",border:k?"1px solid rgba(255,255,255,0.08)":"none",borderRadius:14,padding:"16px 0",fontSize:k==="del"?18:20,fontWeight:k==="del"?400:600,cursor:k?"pointer":"default",fontFamily:"inherit",color:"#FFFFFF"}}>
                {k==="del"?"⌫":k}
              </button>
            ))}
          </div>
          <div style={{marginTop:20,fontSize:11,color:"#7C8FAB"}}>{rol==="admin"?"PIN por defecto: 1234":"PIN por defecto: 0000"}</div>
        </div>
      </div>
      </div>
    </div>
  );
};

// ── ATOMS ──
const Pill = ({children,color}) => {
  const m = {gr:{bg:C.grBg,c:C.gr},or:{bg:C.orBg,c:C.or},re:{bg:C.reBg,c:C.re},ye:{bg:C.yeBg,c:C.ye},pu:{bg:C.puBg,c:C.pu}};
  const s = m[color]||m.gr;
  return <span style={{background:s.bg,color:s.c,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>{children}</span>;
};
const Card = ({label,value,color,icon}) => (
  <div style={{background:C.card,borderRadius:16,padding:"16px 14px",boxShadow:sh,border:"1px solid "+C.border}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
      <div style={{fontSize:11,color:C.muted,fontWeight:500}}>{label}</div>
      {icon && <span style={{fontSize:18}}>{icon}</span>}
    </div>
    <div style={{fontSize:22,fontWeight:700,color:color||C.txt,letterSpacing:-0.5}}>{value}</div>
  </div>
);
const Btn = ({onClick,children,v,full,sm,disabled}) => {
  const s = {primary:{background:C.pr,color:"#fff",border:"none"},secondary:{background:C.muted2,color:C.txt,border:"1px solid "+C.border},danger:{background:C.reBg,color:C.re,border:"1px solid #FCA5A5"}};
  return <button onClick={onClick} disabled={disabled} style={{...(s[v||"primary"]),borderRadius:12,padding:sm?"8px 16px":"13px 20px",fontWeight:600,fontSize:sm?12:14,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",width:full?"100%":"auto",opacity:disabled?0.5:1}}>{children}</button>;
};
// ── ESCANER DE CODIGO DE BARRAS ──
// Dos caminos: BarcodeDetector nativo (instantaneo, usa el decodificador del
// sistema — clave en Android de gama baja) y ZXing como respaldo para los
// navegadores que no lo tienen (Safari/iOS). ZXing se carga bajo demanda para
// que no pese en el arranque de la app.
// La camara SOLO funciona en HTTPS o localhost: fuera de eso avisamos y listo.
const FORMATOS = ["ean_13","ean_8","upc_a","upc_e","code_128","code_39","itf","codabar","qr_code"];

// Un UPC-E de 8 digitos es una forma comprimida de un UPC-A de 12: el mismo
// producto. La expansion depende del ultimo de los seis digitos centrales.
const expandirUpcE = (c) => {
  if (!/^\d{8}$/.test(c)) return null;
  const n = c[0], d = c.slice(1,7), chk = c[7], u = d[5];
  const cuerpo =
    u==="0"||u==="1"||u==="2" ? d.slice(0,2) + u + "0000" + d.slice(2,5) :
    u==="3"                   ? d.slice(0,3) + "00000" + d.slice(3,5)    :
    u==="4"                   ? d.slice(0,4) + "00000" + d[4]            :
                                d.slice(0,5) + "0000"  + u;
  return n + cuerpo + chk;
};

// El MISMO codigo de barras fisico puede leerse en representaciones distintas:
// un UPC-A de 12 digitos y ese codigo con un 0 delante leido como EAN-13 son el
// mismo producto. Si guardamos el texto crudo, escanear dos veces la misma caja
// crea dos SKU. Llevamos todo a GTIN-13, la forma canonica del retail.
const normalizarCodigo = (valor, formato) => {
  const t = String(valor||"").trim().toUpperCase();
  const f = String(formato||"").toLowerCase().replace(/[-_]/g,"");
  if (!/^\d+$/.test(t)) return t;                 // Code128/QR: texto libre, se deja igual
  if (t.length === 12) return "0" + t;            // UPC-A -> GTIN-13
  if (t.length === 8 && f === "upce") { const a = expandirUpcE(t); return a ? "0"+a : t; }
  return t;                                       // EAN-13 y EAN-8 ya son canonicos
};

// ITF no lleva digito verificador obligatorio ni patrones de guarda fuertes: una
// vista PARCIAL del codigo decodifica igual y devuelve un numero mas corto que
// parece valido. Por eso solo se acepta ITF-14, el largo estandar de cajas.
// Cuando no sabemos el formato (ZXing devuelve un enum numerico, no lo mapeamos)
// no restringimos: la doble confirmacion es la que cuida ese caso.
const codigoAceptable = (cod, formato) => {
  const f = String(formato||"").toLowerCase().replace(/[-_]/g,"");
  if (f === "itf") return /^\d{14}$/.test(cod);
  return cod.length >= 4;
};

const ScannerModal = ({onDetect, onClose}) => {
  const videoRef = useRef(null);
  const [estado, setEstado] = useState("iniciando");   // iniciando | escaneando | error
  const [error,  setError]  = useState("");
  // el callback vive en un ref: si fuera dependencia del efecto, cualquier render
  // del padre reiniciaria la camara a mitad del escaneo.
  const cbRef = useRef(onDetect);
  cbRef.current = onDetect;

  useEffect(() => {
    let stream = null, controls = null, cancelado = false, rafId = null;
    // red de seguridad: si por lo que sea nunca llegamos a escanear, no dejamos
    // a la usuaria mirando "Abriendo la camara..." para siempre.
    let arranco = false;
    const watchdog = setTimeout(() => {
      if (!cancelado && !arranco) {
        setEstado("error");
        setError("La cámara está tardando demasiado. Escribe el código a mano.");
      }
    }, 10000);

    const acabar = (valor) => {
      if (cancelado) return;
      cancelado = true;
      try { navigator.vibrate && navigator.vibrate(60); } catch {}
      cbRef.current(String(valor).trim());
    };

    // Antes se aceptaba el PRIMER cuadro que decodificara. Un cuadro borroso o
    // una vista parcial del codigo se colaba y creaba un SKU equivocado, asi que
    // el mismo producto podia quedar registrado dos veces con codigos distintos.
    // Ahora exigimos dos lecturas identicas seguidas: cuesta ~100ms y descarta
    // las lecturas sueltas. Si cambia el valor, el contador vuelve a empezar.
    let candidato = null, repes = 0;
    const proponer = (valor, formato) => {
      if (cancelado) return;
      const cod = normalizarCodigo(valor, formato);
      if (!cod || !codigoAceptable(cod, formato)) { candidato = null; repes = 0; return; }
      if (cod === candidato) repes++; else { candidato = cod; repes = 1; }
      if (repes >= 2) acabar(cod);
    };

    const arrancar = async () => {
      if (typeof window !== "undefined" && window.isSecureContext === false) {
        setEstado("error");
        setError("La cámara necesita una conexión segura (HTTPS). Abre la app desde su dirección web, no por IP.");
        return;
      }
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setEstado("error");
        setError("Este navegador no permite usar la cámara. Escribe el código a mano.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {facingMode:{ideal:"environment"}, width:{ideal:1280}, height:{ideal:720}},
          audio: false,
        });
      } catch (e) {
        setEstado("error");
        setError(
          e && e.name==="NotAllowedError"  ? "No diste permiso para usar la cámara. Revisa los permisos del navegador." :
          e && e.name==="NotFoundError"    ? "No encontramos ninguna cámara en este dispositivo." :
          e && e.name==="NotReadableError" ? "Otra aplicación está usando la cámara. Ciérrala e intenta de nuevo." :
          "No pudimos abrir la cámara. Escribe el código a mano."
        );
        return;
      }
      if (cancelado) { stream.getTracks().forEach(t => t.stop()); return; }

      const video = videoRef.current;
      if (!video) return;
      try {
        video.srcObject = stream;
        video.setAttribute("playsinline", "true"); // iOS: sin esto abre en pantalla completa
        try { await video.play(); } catch {}
      } catch {
        setEstado("error");
        setError("No pudimos mostrar la imagen de la cámara. Escribe el código a mano.");
        return;
      }
      if (cancelado) return;
      arranco = true; clearTimeout(watchdog);
      setEstado("escaneando");

      // camino rapido: decodificador del sistema
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const soportados = await window.BarcodeDetector.getSupportedFormats();
          const usar = FORMATOS.filter(f => soportados.includes(f));
          if (usar.length) {
            const det = new window.BarcodeDetector({formats:usar});
            const loop = async () => {
              if (cancelado) return;
              try {
                const cods = await det.detect(video);
                if (cods && cods.length && cods[0].rawValue) {
                  proponer(cods[0].rawValue, cods[0].format);
                  if (cancelado) return;
                }
              } catch {}
              rafId = requestAnimationFrame(loop);
            };
            loop();
            return;
          }
        } catch {}
      }

      // respaldo: ZXing, cargado solo ahora
      try {
        const {BrowserMultiFormatReader} = await import("@zxing/browser");
        if (cancelado) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoElement(video, (res) => {
          if (res && !cancelado) proponer(res.getText());
        });
      } catch {
        setEstado("error");
        setError("No pudimos iniciar el lector de códigos. Escribe el código a mano.");
      }
    };

    // si arrancar() falla de forma imprevista, mostramos error en vez de colgarnos
    arrancar().catch(() => {
      if (cancelado) return;
      setEstado("error");
      setError("No pudimos iniciar la cámara. Escribe el código a mano.");
    });
    // liberar la camara SIEMPRE: si no, la luz del celular queda prendida
    return () => {
      cancelado = true;
      clearTimeout(watchdog);
      if (rafId) cancelAnimationFrame(rafId);
      try { controls && controls.stop(); } catch {}
      try { stream && stream.getTracks().forEach(t => t.stop()); } catch {}
    };
  }, []);

  return (
    <div style={{position:"fixed",inset:0,background:BRAND.marino,zIndex:200,display:"flex",flexDirection:"column"}}>
      <div style={{padding:"18px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{color:"#fff",fontSize:15,fontWeight:700}}>Escanear código</div>
        <button onClick={onClose} aria-label="Cerrar"
          style={{background:"rgba(255,255,255,0.14)",border:"none",borderRadius:10,width:34,height:34,color:"#fff",fontSize:17,cursor:"pointer",fontFamily:"inherit",lineHeight:1}}>✕</button>
      </div>

      <div style={{flex:1,position:"relative",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
        <video ref={videoRef} muted playsInline autoPlay
          style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",opacity:estado==="error"?0:1}}/>
        {estado!=="error" && (
          <div style={{position:"relative",width:"78%",maxWidth:320,aspectRatio:"1.6",border:"2px solid rgba(255,255,255,0.9)",borderRadius:14,boxShadow:"0 0 0 9999px rgba(1,18,48,0.45)"}}/>
        )}
        {estado==="error" && (
          <div style={{position:"relative",padding:"0 32px",textAlign:"center",maxWidth:400}}>
            <div style={{color:"#fff",opacity:0.85,marginBottom:12,display:"flex",justifyContent:"center"}}><Ico n="circAlerta" s={34}/></div>
            <div style={{color:"#fff",fontSize:14,lineHeight:1.6}}>{error}</div>
          </div>
        )}
      </div>

      <div style={{padding:"18px 24px 30px",flexShrink:0,textAlign:"center"}}>
        <div style={{color:"rgba(255,255,255,0.75)",fontSize:13,marginBottom:16,minHeight:19}}>
          {estado==="iniciando" ? "Abriendo la cámara…" : estado==="escaneando" ? "Apunta al código de barras del producto" : ""}
        </div>
        <button onClick={onClose}
          style={{background:"rgba(255,255,255,0.14)",border:"none",borderRadius:12,padding:"13px 26px",color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
          {estado==="error" ? "Escribir a mano" : "Cancelar"}
        </button>
      </div>
    </div>
  );
};

const Sheet = ({children}) => {
  const dsk = typeof window!=="undefined" && window.innerWidth >= 768;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(26,26,24,0.55)",backdropFilter:"blur(4px)",display:"flex",alignItems:dsk?"center":"flex-end",justifyContent:"center",zIndex:100}}>
      <div style={{background:C.card,borderRadius:dsk?20:"24px 24px 0 0",padding:dsk?32:24,width:"100%",maxWidth:dsk?520:420,boxShadow:dsk?shMd:"0 -8px 32px rgba(0,0,0,0.12)",maxHeight:"90vh",overflowY:"auto"}}>
        {!dsk && <div style={{width:40,height:4,background:C.border,borderRadius:4,margin:"0 auto 20px"}}/>}
        {children}
      </div>
    </div>
  );
};

// ── TIPOS EDITOR ──
const TiposEditor = ({tipos, setTipos}) => {
  const [newTipo, setNewTipo] = useState("");
  const add = () => {
    const t = newTipo.trim().toUpperCase();
    if (!t || tipos.find(x => x.talla === t)) return;
    setTipos([...tipos, {talla:t, stock:0}]);
    setNewTipo("");
  };
  const upd = (idx, delta) => setTipos(tipos.map((t,i) => i===idx ? {...t, stock:Math.max(0,t.stock+delta)} : t));
  const rem = (idx) => setTipos(tipos.filter((_,i) => i!==idx));
  return (
    <div>
      {tipos.length===0 && <div style={{background:C.muted2,borderRadius:12,padding:"14px 16px",marginBottom:12,textAlign:"center",color:C.muted,fontSize:13}}>Sin tipos aún. Agrega uno abajo.</div>}
      {tipos.map((t,i) => (
        <div key={t.talla} style={{display:"flex",alignItems:"center",gap:10,background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"10px 14px",marginBottom:8}}>
          <div style={{flex:1,fontSize:14,fontWeight:700}}>{t.talla}</div>
          <button onClick={() => upd(i,-1)} style={{width:32,height:32,borderRadius:8,background:C.muted2,border:"1px solid "+C.border,fontSize:18,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
          <div style={{width:36,textAlign:"center",fontSize:18,fontWeight:700,color:t.stock>0?C.gr:C.muted}}>{t.stock}</div>
          <button onClick={() => upd(i,+1)} style={{width:32,height:32,borderRadius:8,background:C.pr,border:"none",fontSize:18,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
          <button onClick={() => rem(i)} style={{width:32,height:32,borderRadius:8,background:C.reBg,border:"1px solid #FCA5A5",fontSize:14,cursor:"pointer",fontFamily:"inherit",color:C.re}}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:4}}>
        <input value={newTipo} onChange={e => setNewTipo(e.target.value.toUpperCase())}
          onKeyDown={e => (e.key==="Enter"||e.key===",") && (e.preventDefault(), add())}
          placeholder="Ej: 38, 39, S, M, Rojo..."
          style={{flex:1,background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"11px 14px",color:C.txt,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
        <button onClick={add} style={{background:C.pr,color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar</button>
      </div>
      <div style={{fontSize:11,color:C.muted,marginTop:6}}>Escribe el tipo y toca "+ Agregar". Enter o coma también funcionan.</div>
    </div>
  );
};

// ── MODALS ──
const VentaModal = ({vm, cant, setCant, isAdmin, onConfirm, onClose}) => {
  const talla = vm.prod.tallas[vm.ti];
  const precio = parseFloat(vm.precioFinal) || vm.prod.venta;
  return (
    <Sheet>
      <div style={{background:C.muted2,borderRadius:12,padding:"10px 14px",marginBottom:18}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{vm.prod.sku} · {tallaLbl(talla.talla)} · {vm.prod.sede}</div>
        <div style={{fontSize:15,fontWeight:700}}>{vm.prod.nombre}</div>
      </div>
      <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>Cantidad</div>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18,background:C.muted2,borderRadius:16,padding:"8px 12px"}}>
        <button onClick={() => setCant(Math.max(1,cant-1))} style={{width:40,height:40,borderRadius:12,background:C.card,border:"1px solid "+C.border,fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
        <div style={{fontSize:28,fontWeight:700,flex:1,textAlign:"center"}}>{cant}</div>
        <button onClick={() => setCant(Math.min(talla.stock,cant+1))} style={{width:40,height:40,borderRadius:12,background:C.pr,border:"none",fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
      </div>
      <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:6}}>Precio de venta S/ <span style={{color:C.gr,fontSize:11}}>(ajustable)</span></div>
      <input type="number" min="0" step="0.01" value={vm.precioFinal}
        onChange={e => { const v=e.target.value; if(v==="" || parseFloat(v)>=0) vm.onChange(v); }}
        style={{...IS,fontSize:24,fontWeight:700,marginBottom:6}}/>
      {precio !== vm.prod.venta && <div style={{fontSize:12,color:precio>vm.prod.venta?C.gr:C.or,marginBottom:4}}>{precio>vm.prod.venta?"↑ Por encima":"↓ Por debajo"} del ref. S/{vm.prod.venta}</div>}
      {isAdmin && precio < vm.prod.compra && <div style={{fontSize:12,color:C.re,marginBottom:4,display:"flex",alignItems:"center",gap:5}}><Ico n="alerta" s={13}/>Debajo del costo</div>}
      <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:6,marginTop:4}}>¿Cómo paga?</div>
      <div style={{display:"flex",gap:7,marginBottom:14}}>
        {MEDIOS_PAGO.map(m => (
          <button key={m.id} onClick={() => vm.onMedio(m.id)}
            style={{flex:1, background:vm.medio===m.id?C.prBg:C.muted2, border:"1.5px solid "+(vm.medio===m.id?C.pr:"transparent"),
              borderRadius:10, padding:"11px 6px", cursor:"pointer", fontFamily:"inherit",
              fontSize:12, fontWeight:vm.medio===m.id?700:500, color:vm.medio===m.id?C.pr:C.txt}}>
            {m.corto}
          </button>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",background:C.muted2,borderRadius:12,padding:"10px 14px",marginBottom:18}}>
        <span style={{fontSize:13,color:C.muted}}>Stock: <b style={{color:C.txt}}>{talla.stock}u</b></span>
        <span style={{fontSize:13,color:C.muted}}>Total: <b style={{color:C.gr}}>S/{(cant*precio).toFixed(2)}</b></span>
      </div>
      <div style={{display:"flex",gap:10}}><Btn onClick={onClose} v="secondary">Cancelar</Btn><Btn onClick={onConfirm} full>Confirmar venta</Btn></div>
    </Sheet>
  );
};

const EditModal = ({editM, editF, setEditF, confDel, setConfDel, onSave, onDelete, onClose}) => (
  <Sheet>
    {!confDel ? (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700}}>Editar producto</div>
          <button onClick={() => setConfDel(true)} style={{background:C.reBg,border:"1px solid #FCA5A5",color:C.re,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><Ico n="papelera" s={13}/>Eliminar</button>
        </div>
        {[{l:"Código / SKU",k:"sku"},{l:"Nombre",k:"nombre"}].map(f => (
          <div key={f.k} style={{marginBottom:12}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:500}}>{f.l}</div>
            <input value={editF[f.k]} onChange={e => setEditF(ef => ({...ef,[f.k]:f.k==="sku"?e.target.value.toUpperCase():e.target.value}))} style={IS}/>
          </div>
        ))}
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          {[{l:"Compra (S/)",k:"compra"},{l:"Venta ref. (S/)",k:"venta"}].map(f => (
            <div key={f.k} style={{flex:1}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:500}}>{f.l}</div>
              <input type="number" value={editF[f.k]} onChange={e => setEditF(ef => ({...ef,[f.k]:e.target.value}))} style={IS}/>
            </div>
          ))}
        </div>
        {editF.compra && editF.venta && parseFloat(editF.venta)>parseFloat(editF.compra) && (
          <div style={{background:C.grBg,border:"1px solid "+C.grLt,borderRadius:10,padding:"8px 14px",marginBottom:12,fontSize:13,color:C.gr,fontWeight:600}}>Margen: {mg(parseFloat(editF.compra),parseFloat(editF.venta))}%</div>
        )}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:500}}>Tipos registrados</div>
          <div style={{fontSize:11,color:C.or,marginBottom:8,background:C.orBg,borderRadius:8,padding:"6px 10px",display:"flex",alignItems:"center",gap:6}}><Ico n="alerta" s={13}/><span>El stock solo se modifica desde Reponer o Ajuste para mantener trazabilidad.</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
            {editF.tallas.map(t => (
              <div key={t.talla} style={{background:C.grBg,border:"1px solid "+C.grLt,borderRadius:10,padding:"8px 14px",textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.gr}}>{tallaLbl(t.talla)}</div>
                <div style={{fontSize:11,color:C.muted}}>{t.stock}u</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <input placeholder="Nuevo tipo (Ej: XL, 42...)" value={editF.newTipo||""}
              onChange={e => setEditF(ef => ({...ef, newTipo:e.target.value.toUpperCase()}))}
              onKeyDown={e => { if(e.key==="Enter"&&editF.newTipo?.trim()&&!editF.tallas.find(t=>t.talla===editF.newTipo.trim())){e.preventDefault();setEditF(ef=>({...ef,tallas:[...ef.tallas,{talla:ef.newTipo.trim(),stock:0}],newTipo:""}));}}}
              style={{flex:1,background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"9px 12px",color:C.txt,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
            <button onClick={() => { if(editF.newTipo?.trim()&&!editF.tallas.find(t=>t.talla===editF.newTipo.trim()))setEditF(ef=>({...ef,tallas:[...ef.tallas,{talla:ef.newTipo.trim(),stock:0}],newTipo:""}));}}
              style={{background:C.pr,color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar</button>
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>Solo puedes agregar tipos nuevos (arrancan en 0 unidades).</div>
        </div>
        <div style={{display:"flex",gap:10}}><Btn onClick={onClose} v="secondary">Cancelar</Btn><Btn onClick={onSave} full>Guardar cambios</Btn></div>
      </div>
    ) : (
      <div style={{textAlign:"center",padding:"8px 0"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:12,color:C.re}}><Ico n="alerta" s={36} w={1.4}/></div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>¿Eliminar este producto?</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:8}}>{editM.nombre}</div>
        <div style={{fontSize:12,color:C.re,background:C.reBg,borderRadius:10,padding:"10px 14px",marginBottom:20}}>Esta acción no se puede deshacer.</div>
        <div style={{display:"flex",gap:10}}><Btn onClick={() => setConfDel(false)} v="secondary" full>Cancelar</Btn><Btn onClick={() => onDelete(editM.id)} v="danger" full>Sí, eliminar</Btn></div>
      </div>
    )}
  </Sheet>
);

const TransferModal = ({transferM, setTransferM, prods, onTransfer}) => {
  const src = transferM.srcProd; // product we're sending FROM
  // All existing sedes except source
  const otherSedes = [...new Set(prods.filter(p => p.id!==src.id && !p.archivado).map(p => p.sede).filter(Boolean))];
  const [destSede, setDestSede] = useState("");
  const [nuevaSede, setNuevaSede] = useState("");
  const [items, setItems]         = useState({});

  const sedeDestino = destSede === "__nueva__" ? nuevaSede.trim() : destSede;
  const destProd    = prods.find(p => p.sku===src.sku && p.sede===sedeDestino && p.id!==src.id);
  const tot         = Object.values(items).reduce((a,v) => a+(parseInt(v)||0), 0);

  const setItem = (talla, val) => {
    const disponible = (src.tallas.find(t=>t.talla===talla)||{}).stock||0;
    const c = Math.min(parseInt(val)||0, disponible);
    setItems(p => ({...p, [talla]: c>0?String(c):""}));
  };

  const canConfirm = sedeDestino && tot > 0;

  return (
    <Sheet>
      <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>↔ Trasladar stock</div>

      {/* SOURCE */}
      <div style={{background:C.grBg,border:"1px solid "+C.grLt,borderRadius:12,padding:"12px 14px",marginBottom:16}}>
        <div style={{fontSize:10,color:C.gr,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Origen (sale de aquí)</div>
        <div style={{fontSize:14,fontWeight:700}}>{src.nombre}</div>
        <div style={{fontSize:12,color:C.muted,marginTop:2,display:"flex",alignItems:"center",gap:4}}><Ico n="pin" s={12}/>{src.sede} · {src.tallas.map(t=>tallaLbl(t.talla)+" "+t.stock+"u").join(" · ")}</div>
      </div>

      {/* DESTINATION SELECTOR */}
      <div style={{marginBottom:16}}>
        <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:10}}>¿A dónde trasladas?</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
          {otherSedes.map(s => (
            <button key={s} onClick={() => setDestSede(s)}
              style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(destSede===s?C.gr:C.border),background:destSede===s?C.gr:C.card,color:destSede===s?"#fff":C.txt,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>
              {s}{destProd && destSede===s && <span style={{fontSize:10,opacity:0.8}}> · {totalStock(destProd)}u</span>}
            </button>
          ))}
          <button onClick={() => setDestSede("__nueva__")}
            style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(destSede==="__nueva__"?C.gr:C.border),background:destSede==="__nueva__"?C.gr:C.card,color:destSede==="__nueva__"?"#fff":C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>
            + Nueva sede
          </button>
        </div>
        {destSede==="__nueva__" && (
          <input value={nuevaSede} onChange={e=>setNuevaSede(e.target.value)}
            placeholder="Ej: Tienda Centro, Depósito B..."
            style={{width:"100%",background:C.card,border:"1.5px solid "+C.pr,borderRadius:10,padding:"11px 14px",color:C.txt,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
        )}
        {sedeDestino && !destProd && (
          <div style={{fontSize:11,color:C.gr,marginTop:8,background:C.grBg,borderRadius:8,padding:"6px 10px"}}>
            ✓ Se creará el producto en "{sedeDestino}" automáticamente.
          </div>
        )}
      </div>

      {/* QUANTITIES */}
      {sedeDestino && (
        <div>
          <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:10}}>¿Cuántas unidades trasladas?</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {src.tallas.map(t => (
              <div key={t.talla} style={{display:"flex",alignItems:"center",gap:12,background:C.muted2,borderRadius:10,padding:"10px 14px"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700}}>{tallaLbl(t.talla)}</div>
                  <div style={{fontSize:11,color:C.muted}}>Disponible: <b style={{color:t.stock===0?C.re:C.txt}}>{t.stock}u</b></div>
                </div>
                <button onClick={() => setItem(t.talla,String(Math.max(0,(parseInt(items[t.talla])||0)-1)))}
                  style={{width:32,height:32,borderRadius:8,background:C.card,border:"1px solid "+C.border,fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
                <div style={{width:32,textAlign:"center",fontSize:18,fontWeight:700,color:(parseInt(items[t.talla])||0)>0?C.gr:C.muted}}>{items[t.talla]||0}</div>
                <button onClick={() => setItem(t.talla,String((parseInt(items[t.talla])||0)+1))} disabled={t.stock===0||(parseInt(items[t.talla])||0)>=t.stock}
                  style={{width:32,height:32,borderRadius:8,background:t.stock===0?C.muted2:C.gr,border:"none",fontSize:16,cursor:t.stock===0?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff",opacity:t.stock===0?0.4:1}}>+</button>
              </div>
            ))}
          </div>

          {/* Preview */}
          {tot > 0 && (
            <div style={{background:C.grBg,border:"1px solid "+C.grLt,borderRadius:12,padding:"12px 14px",marginBottom:16}}>
              <div style={{fontSize:11,color:C.gr,fontWeight:600,marginBottom:6}}>Resumen del traslado</div>
              {Object.entries(items).filter(([,v])=>parseInt(v)>0).map(([talla,cant]) => (
                <div key={talla} style={{fontSize:12,color:C.txt,marginBottom:3,display:"flex",justifyContent:"space-between"}}>
                  <span>{tallaLbl(talla)}</span>
                  <span>
                    <span style={{color:C.re}}>{src.sede}: {(src.tallas.find(t=>t.talla===talla)||{}).stock||0}→{Math.max(0,((src.tallas.find(t=>t.talla===talla)||{}).stock||0)-parseInt(cant))}u</span>
                    {" · "}
                    <span style={{color:C.gr}}>{sedeDestino}: {((destProd?.tallas.find(t=>t.talla===talla)||{}).stock||0)}→{((destProd?.tallas.find(t=>t.talla===talla)||{}).stock||0)+parseInt(cant)}u</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{display:"flex",gap:10}}>
        <Btn onClick={() => setTransferM(null)} v="secondary">Cancelar</Btn>
        <Btn onClick={() => canConfirm && onTransfer(sedeDestino, items, src)} full disabled={!canConfirm}>
          {canConfirm ? "Confirmar traslado" : "Selecciona destino y cantidades"}
        </Btn>
      </div>
    </Sheet>
  );
};

// ── VIEW COMPONENTS ──
function BarChart({porDia}) {
  const mx = Math.max(...porDia.map(x => x.total), 1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:3,height:72}}>
      {porDia.map((d,i) => {
        const h = Math.max((d.total/mx)*60, d.total>0?4:0);
        const iT = d.dia === HOY.getDate();
        return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{width:"100%",height:h,borderRadius:3,background:iT?C.gr:d.total>0?C.grLt:C.muted2}}/>
            {(d.dia===1||d.dia%5===0||iT) && <div style={{fontSize:7,color:iT?C.gr:C.muted,fontWeight:iT?700:400}}>{d.dia}</div>}
          </div>
        );
      })}
    </div>
  );
}

function TopList({data}) {
  if (!data.length) return <div style={{background:C.card,borderRadius:16,padding:"20px 16px",color:C.muted,fontSize:13,textAlign:"center",border:"1px solid "+C.border}}>Sin ventas registradas.</div>;
  return (
    <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,overflow:"hidden"}}>
      {data.map(([k,d],i) => (
        <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:i<data.length-1?"1px solid "+C.border:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:28,height:28,borderRadius:8,background:i===0?C.grBg:C.muted2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:i===0?C.gr:C.muted}}>{i+1}</div>
            <div><div style={{fontSize:13,fontWeight:600}}>{d.nombre}</div><div style={{fontSize:11,color:C.muted}}>{tallaLbl(d.talla)} · {d.unidades}u</div></div>
          </div>
          <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.muted,marginBottom:2}}>Ganancia</div><div style={{fontSize:14,color:C.gr,fontWeight:700}}>S/{(d.ganancia||0).toFixed(0)}</div></div>
        </div>
      ))}
    </div>
  );
}

// ── DEVOLUCION ──
// Distinta de anular: anular corrige un error de registro (7 dias); devolver es
// un hecho del negocio (el cliente trajo el producto) y no caduca.
// Dos caminos: reembolso (vuelve la plata) o cambio (sale otro producto).
const DevolucionModal = ({dev, prods, onSet, onConfirm, onClose, isDesktop}) => {
  const {venta, modo, salida, q} = dev;
  const prodOrigen = prods.find(p => p.prodId===venta.prodId || p.id===venta.prodId)
                  || prods.find(p => p.sku===venta.sku && p.sede===venta.sede);
  const montoDevuelto = venta.total || 0;

  // El caso mas comun en calzado y ropa: misma prenda, otra talla. Va primero
  // para que no haya que buscar nada.
  const otrasTallas = prodOrigen
    ? prodOrigen.tallas.filter(t => !(t.talla===venta.talla) && t.stock>0)
    : [];

  const busq = (q||"").trim().toLowerCase();
  const candidatos = busq
    ? prods.filter(p => !p.archivado && (p.nombre.toLowerCase().includes(busq) || p.sku.toLowerCase().includes(busq))).slice(0,6)
    : [];

  const precioSalida = salida ? (salida.prod.venta||0) : 0;
  const diferencia   = salida ? precioSalida - montoDevuelto : 0;

  const elegir = (prod, talla) => onSet(d => ({...d, salida:{prod, talla}}));

  return (
    <Sheet>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:19,fontWeight:800,marginBottom:4,letterSpacing:-0.4}}>Devolución</div>
      <div style={{background:C.muted2,borderRadius:12,padding:"10px 14px",marginBottom:16}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{venta.sku} · {tallaLbl(venta.talla)} · {venta.sede}</div>
        <div style={{fontSize:15,fontWeight:700}}>{venta.producto}</div>
        <div style={{fontSize:12,color:C.muted,marginTop:3}}>{venta.cantidad}u · S/{montoDevuelto.toFixed(0)} · {fmtFecha(venta.fecha)}</div>
      </div>

      {/* QUE TIPO */}
      <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:7}}>¿Qué pasó?</div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        {[["reembolso","↩ Reembolso","Le devuelves la plata"],
          ["cambio","⇄ Cambio","Se lleva otro producto"]].map(([id,lbl,sub]) => (
          <button key={id} onClick={() => onSet(d => ({...d, modo:id, salida:null, q:""}))}
            style={{flex:1, background:modo===id?C.puBg:C.muted2, border:"1.5px solid "+(modo===id?C.pu:"transparent"),
              borderRadius:12, padding:"12px 10px", cursor:"pointer", fontFamily:"inherit", textAlign:"left"}}>
            <div style={{fontSize:13,fontWeight:700,color:modo===id?C.pu:C.txt}}>{lbl}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>{sub}</div>
          </button>
        ))}
      </div>

      {modo==="cambio" && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:7}}>¿Qué se lleva el cliente?</div>

          {otrasTallas.length>0 && (
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:6}}>Otras tallas de este mismo producto</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:7}}>
                {otrasTallas.map(t => {
                  const sel = salida && salida.prod.id===prodOrigen.id && salida.talla===t.talla;
                  return (
                    <button key={t.talla} onClick={() => elegir(prodOrigen, t.talla)}
                      style={{background:sel?C.pu:C.grBg, border:"1.5px solid "+(sel?C.pu:C.grLt), borderRadius:10,
                        padding:"8px 14px", cursor:"pointer", fontFamily:"inherit", minWidth:56, textAlign:"center"}}>
                      <div style={{fontSize:13,fontWeight:700,color:sel?"#fff":C.gr}}>{tallaLbl(t.talla)}</div>
                      <div style={{fontSize:10,color:sel?"rgba(255,255,255,0.85)":C.muted,marginTop:1}}>{t.stock}u</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{fontSize:11,color:C.muted,marginBottom:6}}>{otrasTallas.length>0 ? "O busca otro producto" : "Busca el producto"}</div>
          <input type="text" placeholder="Nombre o código..." value={q||""}
            onChange={e => onSet(d => ({...d, q:e.target.value}))} style={{...IS, marginBottom:8}}/>

          {candidatos.map(p => (
            <div key={p.id} style={{background:C.muted2,borderRadius:10,padding:"10px 12px",marginBottom:7}}>
              <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:6}}>
                <span style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.nombre}</span>
                <span style={{fontSize:12,fontWeight:700,flexShrink:0}}>S/{p.venta}</span>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {p.tallas.filter(t=>t.stock>0).map(t => {
                  const sel = salida && salida.prod.id===p.id && salida.talla===t.talla;
                  return (
                    <button key={t.talla} onClick={() => elegir(p, t.talla)}
                      style={{background:sel?C.pu:C.card, border:"1px solid "+(sel?C.pu:C.border), borderRadius:8,
                        padding:"5px 11px", cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:600,
                        color:sel?"#fff":C.txt}}>
                      {tallaLbl(t.talla)} <span style={{opacity:0.7,fontWeight:400}}>{t.stock}u</span>
                    </button>
                  );
                })}
                {p.tallas.filter(t=>t.stock>0).length===0 && <span style={{fontSize:11,color:C.muted}}>Sin stock disponible</span>}
              </div>
            </div>
          ))}
          {busq && candidatos.length===0 && <div style={{fontSize:12,color:C.muted,padding:"6px 0"}}>No se encontró ningún producto.</div>}
        </div>
      )}

      {/* CUENTAS — la app calcula, la vendedora no */}
      <div style={{background:C.muted2,borderRadius:12,padding:"12px 14px",marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
          <span style={{fontSize:12,color:C.muted}}>Devuelve</span>
          <span style={{fontSize:13,fontWeight:600}}>{venta.producto} · {tallaLbl(venta.talla)} · S/{montoDevuelto.toFixed(0)}</span>
        </div>
        {modo==="cambio" && (
          <div style={{display:"flex",justifyContent:"space-between",padding:"3px 0"}}>
            <span style={{fontSize:12,color:C.muted}}>Se lleva</span>
            <span style={{fontSize:13,fontWeight:600,textAlign:"right"}}>
              {salida ? <>{salida.prod.nombre} · {tallaLbl(salida.talla)} · S/{precioSalida.toFixed(0)}</> : <span style={{color:C.muted,fontWeight:400}}>— elige un producto —</span>}
            </span>
          </div>
        )}
        <div style={{borderTop:"1px solid "+C.border,marginTop:8,paddingTop:9,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          {modo==="reembolso" ? (
            <>
              <span style={{fontSize:13,fontWeight:700}}>Devolver al cliente</span>
              <span style={{fontSize:17,fontWeight:700,color:C.re}}>S/{montoDevuelto.toFixed(0)}</span>
            </>
          ) : !salida ? (
            <span style={{fontSize:12,color:C.muted}}>Elige qué se lleva para ver la diferencia.</span>
          ) : diferencia===0 ? (
            <>
              <span style={{fontSize:13,fontWeight:700}}>Diferencia</span>
              <span style={{fontSize:15,fontWeight:700,color:C.muted}}>Sin pago · S/0</span>
            </>
          ) : diferencia>0 ? (
            <>
              <span style={{fontSize:13,fontWeight:700}}>El cliente paga</span>
              <span style={{fontSize:17,fontWeight:700,color:C.gr}}>S/{diferencia.toFixed(0)}</span>
            </>
          ) : (
            <>
              <span style={{fontSize:13,fontWeight:700}}>Devolver al cliente</span>
              <span style={{fontSize:17,fontWeight:700,color:C.re}}>S/{Math.abs(diferencia).toFixed(0)}</span>
            </>
          )}
        </div>
      </div>

      <div style={{fontSize:11,color:C.muted,marginBottom:14,lineHeight:1.5}}>
        El producto devuelto vuelve al stock. Si viene fallado, descuéntalo después con un ajuste — queda en Trazabilidad.
      </div>

      <div style={{display:"flex",gap:10}}>
        <Btn onClick={onClose} v="secondary">Cancelar</Btn>
        <Btn onClick={onConfirm} full v={modo==="cambio" && !salida ? "secondary" : "primary"}>
          {modo==="cambio" ? "Confirmar cambio" : "Confirmar reembolso"}
        </Btn>
      </div>
    </Sheet>
  );
};

function HoyView({ventasHoy, hist, egresos, isAdmin, planActivo, expExcel, doAnular, onDevolver}) {
  // For vendedora: show last 7 days with day selector
  const [diaOffset, setDiaOffset] = useState(0); // 0=hoy, 1=ayer, etc.

  const getFecha = (offset) => {
    const d = new Date(HOY);
    d.setDate(d.getDate() - offset);
    return d;
  };
  const fechaSel = getFecha(diaOffset);
  const ventasDia = (isAdmin && diaOffset===0
    ? ventasHoy
    : hist.filter(v => {
        const d = new Date(v.fecha);
        return d.getDate()===fechaSel.getDate() && d.getMonth()===fechaSel.getMonth() && d.getFullYear()===fechaSel.getFullYear() && v.tipo!=="ajuste";
      }));

  const activas  = ventasDia.filter(v => !v.anulada);
  const anuladas = ventasDia.filter(v => v.anulada);

  // ── RESUMEN DE CAJA DEL DIA ──
  // Solo ventas reales: los ajustes y traslados traen montos que no son ingresos.
  const ventasReales = activas.filter(esVentaReal);
  // Las ventas anteriores al campo `medio` se cuentan como efectivo, que es lo
  // que eran antes de que existiera la opcion.
  const porMedio = ventasReales.reduce((acc,v) => {
    const m = medioPago(v.medio).id;
    acc[m] = (acc[m]||0) + (v.total||0);
    return acc;
  }, {});
  const totalDia = ventasReales.reduce((a,v)=>a+(v.total||0),0);
  const ganDia   = ventasReales.reduce((a,v)=>a+(v.ganancia||0),0);

  const egresosDia = (egresos||[]).filter(e => {
    const d = new Date(e.fecha);
    return d.getDate()===fechaSel.getDate() && d.getMonth()===fechaSel.getMonth() && d.getFullYear()===fechaSel.getFullYear();
  });
  const egresosEfectivoDia = egresosDia.filter(e => medioPago(e.medio).id==="efectivo").reduce((a,e)=>a+(e.monto||0),0);
  const egresosTotalDia    = egresosDia.reduce((a,e)=>a+(e.monto||0),0);
  // Solo el efectivo llega al cajon: Yape y tarjeta van a la cuenta.
  const enCaja       = (porMedio.efectivo||0) - egresosEfectivoDia;
  const utilidadDia  = ganDia - egresosTotalDia;

  const VentaCard = ({v}) => {
    const ajustado = isAdmin && !v.anulada && v.precioVenta!==v.precioOriginal;
    return (
    <div key={v.id} style={{background:C.card,border:"1px solid "+(v.anulada?"#FCA5A5":v.devuelta?C.pu:C.border),borderLeft:"4px solid "+(v.anulada?C.re:v.devuelta?C.pu:C.gr),borderRadius:14,padding:"16px",marginBottom:10,boxShadow:sh,opacity:v.anulada||v.devuelta?0.78:1}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
        <div style={{flex:1,minWidth:0}}>
          {v.anulada && <span style={{fontSize:10,fontWeight:700,color:C.re,background:C.reBg,borderRadius:6,padding:"2px 8px",display:"inline-block",marginBottom:6}}>ANULADA</span>}
          {v.devuelta && !v.anulada && <span style={{fontSize:10,fontWeight:700,color:C.pu,background:C.puBg,borderRadius:6,padding:"2px 8px",display:"inline-block",marginBottom:6}}>{v.devuelta==="cambio"?"CAMBIADA":"DEVUELTA"}</span>}
          <div style={{fontSize:15,fontWeight:700,textDecoration:v.anulada?"line-through":"none",color:v.anulada?C.muted:C.txt}}>{v.producto}</div>
          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{v.sku} · {tallaLbl(v.talla)} · {v.sede}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0,marginLeft:12}}>
          <div style={{fontSize:18,color:v.anulada?C.muted:C.gr,fontWeight:700,textDecoration:v.anulada?"line-through":"none"}}>S/{(v.total||0).toFixed(0)}</div>
        </div>
      </div>

      {/* Detail block */}
      <div style={{background:C.muted2,borderRadius:10,padding:"10px 14px",fontSize:13}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:isAdmin||ajustado?6:0}}>
          <span style={{color:C.muted}}>Cantidad</span>
          <span style={{color:C.txt,fontWeight:600}}>{v.cantidad}u × S/{v.precioVenta}</span>
        </div>
        {ajustado && (
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:isAdmin?6:0}}>
            <span style={{color:C.muted}}>Precio</span>
            <span style={{color:v.precioVenta>v.precioOriginal?C.gr:C.or,fontWeight:600}}>{v.precioVenta>v.precioOriginal?"↑":"↓"} ref. S/{v.precioOriginal}</span>
          </div>
        )}
        {isAdmin && !v.anulada && (
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span style={{color:C.muted}}>Ganancia</span>
            <span style={{color:(v.ganancia||0)<0?C.re:C.gr,fontWeight:700}}>{(v.ganancia||0)<0?"−":""}S/{Math.abs(v.ganancia||0).toFixed(0)}</span>
          </div>
        )}
      </div>

      {/* Footer: times + responsable + action */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,fontSize:11,color:C.muted}}>
        <div style={{display:"flex",flexDirection:"column",gap:2}}>
          <span>Vendido {fmtHora(v.fecha)}{v.responsable ? " · "+(v.responsable==="admin"?"Dueña":"Vendedora") : ""}</span>
          {v.anulada && v.fechaAnulacion && <span style={{color:C.re}}>Anulado {fmtHora(v.fechaAnulacion)}{v.anuladaPor ? " · "+(v.anuladaPor==="admin"?"Dueña":"Vendedora") : ""}</span>}
        </div>
        <div style={{display:"flex",gap:6,flexShrink:0}}>
          {/* Devolucion: el cliente trajo el producto de vuelta. A diferencia de
              anular (que corrige un error de registro), es un hecho del negocio
              y no caduca a los 7 dias. */}
          {!v.anulada && !v.devuelta && (!v.tipo || v.tipo==="venta") && (
            <button onClick={() => onDevolver(v)}
              style={{background:C.puBg,border:"1px solid "+C.pu,color:C.pu,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              ⇄ Devolución
            </button>
          )}
          {!v.anulada && !v.devuelta && diaOffset<=6 && (
            <button onClick={() => doAnular(v.id)}
              style={{background:C.reBg,border:"1px solid #FCA5A5",color:C.re,borderRadius:8,padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
              ↩ Anular
            </button>
          )}
        </div>
      </div>
    </div>
  );
  };

  return (
    <div>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <div style={{fontSize:13,color:C.muted,fontWeight:500,marginBottom:2}}>{isAdmin?"Ventas del día":"Mis ventas"}</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,letterSpacing:-0.5}}>
            {diaOffset===0?"Hoy":diaOffset===1?"Ayer":fechaSel.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"short"})}
          </div>
        </div>
        {isAdmin && diaOffset===0 && <button onClick={() => expExcel("dia")} style={{background:planActivo?C.grBg:C.muted2,border:"1.5px solid "+(planActivo?C.gr:C.border),color:planActivo?C.gr:C.muted,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",gap:6}}>{planActivo?"↓":<Ico n="candado" s={12}/>}Excel</button>}
      </div>

      {/* Day selector — last 7 days */}
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:8,marginBottom:16}}>
        {[0,1,2,3,4,5,6].map(offset => {
          const d = getFecha(offset);
          const label = offset===0?"Hoy":offset===1?"Ayer":d.toLocaleDateString("es-PE",{weekday:"short",day:"numeric"});
          const count = hist.filter(v => {
            const dv=new Date(v.fecha);
            return !v.anulada && v.tipo!=="ajuste" && dv.getDate()===d.getDate() && dv.getMonth()===d.getMonth() && dv.getFullYear()===d.getFullYear();
          }).length;
          return (
            <button key={offset} onClick={() => setDiaOffset(offset)}
              style={{flexShrink:0,padding:"8px 14px",borderRadius:20,border:"1.5px solid "+(diaOffset===offset?C.gr:C.border),background:diaOffset===offset?C.gr:C.card,cursor:"pointer",fontFamily:"inherit",textAlign:"center",minWidth:60}}>
              <div style={{fontSize:11,fontWeight:600,color:diaOffset===offset?"#fff":C.muted}}>{label}</div>
              {count>0 && <div style={{fontSize:10,color:diaOffset===offset?"rgba(255,255,255,0.8)":C.gr,marginTop:1}}>{count}v</div>}
            </button>
          );
        })}
      </div>

      {/* Summary cards */}
      <div style={{display:"grid",gridTemplateColumns:isAdmin?"1fr 1fr 1fr":"1fr 1fr",gap:10,marginBottom:20}}>
        <Card label="Ventas" value={ventasReales.length}/>
        <Card label="Ingresos" value={"S/"+totalDia.toFixed(0)}/>
        {isAdmin && <Card label="Ganancia" value={"S/"+ganDia.toFixed(0)} color={C.gr}/>}
      </div>

      {/* RESUMEN DE CAJA — sin arqueo: nadie escribe nada, solo se informa.
          La vendedora ve el efectivo porque es la plata que tiene en la mano;
          la ganancia sigue siendo solo de la dueña, como en el resto de la app. */}
      {(activas.length>0 || egresosDia.length>0) && (
        <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,padding:16,marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Resumen del día</div>
          <div style={{fontSize:11,color:C.muted,marginBottom:14,textTransform:"capitalize"}}>
            {fechaSel.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long"})}
          </div>

          {MEDIOS_PAGO.map(m => (
            <div key={m.id} style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}>
              <span style={{fontSize:13,color:C.muted}}>{m.label}</span>
              <span style={{fontSize:14,fontWeight:600}}>S/{(porMedio[m.id]||0).toFixed(0)}</span>
            </div>
          ))}

          <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0 0",borderTop:"1px solid "+C.border,marginTop:6}}>
            <span style={{fontSize:13,fontWeight:600}}>Total vendido</span>
            <span style={{fontSize:15,fontWeight:700}}>S/{totalDia.toFixed(0)}</span>
          </div>

          {egresosEfectivoDia>0 && (
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 0"}}>
              <span style={{fontSize:13,color:C.muted}}>Egresos en efectivo</span>
              <span style={{fontSize:14,fontWeight:600,color:C.re}}>−S/{egresosEfectivoDia.toFixed(0)}</span>
            </div>
          )}

          <div style={{background:C.grBg,border:"1px solid "+C.grLt,borderRadius:12,padding:"12px 14px",marginTop:12,
            display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
            <span style={{fontSize:12,fontWeight:700,color:C.gr,textTransform:"uppercase",letterSpacing:0.3}}>En caja debería haber</span>
            <span style={{fontSize:19,fontWeight:700,color:C.gr,letterSpacing:-0.5}}>S/{enCaja.toFixed(0)}</span>
          </div>

          {isAdmin && (
            <div style={{marginTop:14,paddingTop:12,borderTop:"1px dashed "+C.border}}>
              <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
                <span style={{fontSize:13,color:C.muted}}>Ganancia del día</span>
                <span style={{fontSize:14,fontWeight:600,color:C.gr}}>S/{ganDia.toFixed(0)}</span>
              </div>
              {egresosTotalDia>0 && (
                <div style={{display:"flex",justifyContent:"space-between",padding:"5px 0"}}>
                  <span style={{fontSize:13,color:C.muted}}>Egresos del día</span>
                  <span style={{fontSize:14,fontWeight:600,color:C.re}}>−S/{egresosTotalDia.toFixed(0)}</span>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0 0",borderTop:"1px solid "+C.border,marginTop:5}}>
                <span style={{fontSize:13,fontWeight:700}}>Utilidad del día</span>
                <span style={{fontSize:16,fontWeight:700,color:utilidadDia>=0?C.gr:C.re,letterSpacing:-0.3}}>
                  {utilidadDia<0?"−":""}S/{Math.abs(utilidadDia).toFixed(0)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sales list */}
      {ventasDia.length===0
        ? <div style={{background:C.card,borderRadius:16,padding:"40px 20px",textAlign:"center",border:"1px solid "+C.border}}><div style={{fontSize:14,color:C.muted}}>Sin ventas {diaOffset===0?"hoy":"este día"}.</div></div>
        : [...ventasDia].reverse().map(v => <VentaCard key={v.id} v={v}/>)
      }

      {anuladas.length>0 && (
        <div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:8}}>{anuladas.length} venta{anuladas.length!==1?"s":""} anulada{anuladas.length!==1?"s":""} este día</div>
      )}
    </div>
  );
}

function HistorialView({hist, isAdmin, planActivo, expExcel, onVerTraza}) {
  const [hMes,  setHMes]  = useState(MES);
  const [hAnio, setHAnio] = useState(ANIO);
  const [hDia,  setHDia]  = useState(null);
  const esCur = hMes===MES && hAnio===ANIO;
  const pM = () => { setHDia(null); if(hMes===0){setHMes(11);setHAnio(a=>a-1);}else setHMes(m=>m-1); };
  const nM = () => { if(esCur)return; setHDia(null); if(hMes===11){setHMes(0);setHAnio(a=>a+1);}else setHMes(m=>m+1); };
  const vM       = hist.filter(v => { const d=new Date(v.fecha); return d.getMonth()===hMes&&d.getFullYear()===hAnio; });
  const vMActivas = vM.filter(v => !v.anulada);
  const diasEn = new Date(hAnio,hMes+1,0).getDate();
  const pD = Array.from({length:diasEn}, (_,i) => { const dia=i+1; const vs=vM.filter(v=>new Date(v.fecha).getDate()===dia); const vsA=vs.filter(v=>!v.anulada&&v.tipo!=="ajuste"); return {dia, total:vsA.reduce((a,v)=>a+(v.total||0),0), ganancia:vsA.reduce((a,v)=>a+(v.ganancia||0),0), count:vsA.length}; });
  const top = (() => { const ag={}; vMActivas.filter(esVentaReal).forEach(v => { const k=v.sku+"-T"+v.talla; if(!ag[k])ag[k]={nombre:v.producto,talla:v.talla,ganancia:0,unidades:0}; ag[k].ganancia+=(v.ganancia||0); ag[k].unidades+=(v.cantidad||0); }); return Object.entries(ag).sort((a,b)=>b[1].unidades-a[1].unidades).slice(0,5); })();
  const vD        = hDia ? vM.filter(v => new Date(v.fecha).getDate()===hDia) : [];
  const vDVentas  = vD.filter(esVentaReal);
  const vDMovs    = vD.filter(esMovimiento);

  if (hDia) return (
    <div>
      <button onClick={() => setHDia(null)} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:20,fontWeight:500}}>← {MESES[hMes]} {hAnio}</button>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:20,letterSpacing:-0.5}}>{hDia} de {MESES[hMes]}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        <Card label="Ventas" value={vDVentas.length}/>
        <Card label="Ingresos" value={"S/"+vDVentas.reduce((a,v)=>a+(v.total||0),0).toFixed(0)}/>
        {isAdmin && <Card label="Ganancia" value={"S/"+vDVentas.reduce((a,v)=>a+(v.ganancia||0),0).toFixed(0)} color={C.gr}/>}
      </div>
      {vDVentas.length===0
        ? <div style={{background:C.card,borderRadius:16,padding:"30px 20px",textAlign:"center",border:"1px solid "+C.border,color:C.muted,fontSize:14}}>Sin ventas este día.</div>
        : vDVentas.map(v => {
          const ajustado = isAdmin && v.precioVenta!==v.precioOriginal;
          return (
          <div key={v.id} style={{background:C.card,border:"1px solid "+C.border,borderLeft:"4px solid "+C.gr,borderRadius:14,padding:"16px",marginBottom:10,boxShadow:sh}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:15,fontWeight:700}}>{v.producto}</div>
                <div style={{fontSize:11,color:C.muted,marginTop:2}}>{v.sku} · {tallaLbl(v.talla)} · {v.sede}</div>
              </div>
              <div style={{fontSize:18,color:C.gr,fontWeight:700,flexShrink:0,marginLeft:12}}>S/{(v.total||0).toFixed(0)}</div>
            </div>
            <div style={{background:C.muted2,borderRadius:10,padding:"10px 14px",fontSize:13}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:ajustado||isAdmin?6:0}}>
                <span style={{color:C.muted}}>Cantidad</span>
                <span style={{color:C.txt,fontWeight:600}}>{v.cantidad}u × S/{v.precioVenta}</span>
              </div>
              {ajustado && (
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:isAdmin?6:0}}>
                  <span style={{color:C.muted}}>Precio</span>
                  <span style={{color:v.precioVenta>v.precioOriginal?C.gr:C.or,fontWeight:600}}>{v.precioVenta>v.precioOriginal?"↑":"↓"} ref. S/{v.precioOriginal}</span>
                </div>
              )}
              {isAdmin && (
                <div style={{display:"flex",justifyContent:"space-between"}}>
                  <span style={{color:C.muted}}>Ganancia</span>
                  <span style={{color:(v.ganancia||0)<0?C.re:C.gr,fontWeight:700}}>{(v.ganancia||0)<0?"−":""}S/{Math.abs(v.ganancia||0).toFixed(0)}</span>
                </div>
              )}
            </div>
            <div style={{fontSize:11,color:C.muted,marginTop:10}}>Vendido {fmtHora(v.fecha)}{v.responsable ? " · "+(v.responsable==="admin"?"Dueña":"Vendedora") : ""}</div>
          </div>
          );
        })
      }
      {vDMovs.length>0 && (
        <div style={{marginTop:8}}>
          <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:8,marginTop:12}}>Otros movimientos del día</div>
          {vDMovs.map(v => {
            const c = v.anulada?C.re:v.tipo==="traslado"?C.gr:v.tipo==="edicion"?"#0891b2":C.pu;
            const t = v.anulada?"ANULADA":v.tipo==="traslado"?"TRASLADO":v.tipo==="edicion"?"EDICIÓN":"AJUSTE";
            return (
              <div key={v.id} style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"10px 14px",marginBottom:8,opacity:0.85}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontSize:10,fontWeight:700,color:c}}>{t} · {v.producto}</span>
                  <span style={{fontSize:11,color:C.muted}}>{fmtHora(v.fecha)}</span>
                </div>
                <div style={{fontSize:12,color:C.muted}}>
                  {v.anulada ? (v.detalle||tallaLbl(v.talla))+" · S/"+(v.total||0).toFixed(0) : (v.detalle||"")}{v.motivo&&!v.anulada?" · "+v.motivo:""}
                  {(v.responsable||v.anuladaPor) ? " · "+((v.anuladaPor||v.responsable)==="admin"?"Dueña":"Vendedora") : ""}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={pM} style={{background:C.card,border:"1px solid "+C.border,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:16}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,letterSpacing:-0.5}}>{MESES[hMes]}</div>
          <div style={{fontSize:12,color:C.muted}}>{hAnio} {esCur && <span style={{color:C.gr,fontWeight:600}}>· Actual</span>}</div>
        </div>
        <button onClick={nM} style={{background:esCur?C.muted2:C.card,border:"1px solid "+C.border,borderRadius:10,padding:"8px 14px",cursor:esCur?"default":"pointer",fontFamily:"inherit",fontSize:16,opacity:esCur?0.3:1}}>›</button>
      </div>
      {isAdmin && <button onClick={() => expExcel("mes",hMes,hAnio)} style={{background:planActivo?C.grBg:C.muted2,border:"1.5px solid "+(planActivo?C.gr:C.border),color:planActivo?C.gr:C.muted,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:20,display:"inline-flex",alignItems:"center",gap:6}}>{planActivo?"↓":<Ico n="candado" s={12}/>}Excel {MESES[hMes]}</button>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <Card label="Transacciones" value={vMActivas.length}/>
        <Card label="Unidades" value={vMActivas.reduce((a,v)=>a+(v.cantidad||0),0)}/>
        <Card label="Ingresos" value={"S/"+vMActivas.reduce((a,v)=>a+(v.total||0),0).toFixed(0)}/>
        {isAdmin && <Card label="Ganancia" value={"S/"+vMActivas.reduce((a,v)=>a+(v.ganancia||0),0).toFixed(0)} color={C.gr}/>}
      </div>
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Ingresos por día</div>
      <div style={{background:C.card,borderRadius:16,padding:"16px 14px",marginBottom:20,border:"1px solid "+C.border}}><BarChart porDia={pD}/></div>
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Días con ventas</div>
      {pD.filter(d=>d.count>0).length===0
        ? <div style={{background:C.card,borderRadius:12,padding:"20px 16px",textAlign:"center",border:"1px solid "+C.border,color:C.muted,fontSize:13,marginBottom:20}}>Sin ventas en {MESES[hMes]}.</div>
        : <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,overflow:"hidden",marginBottom:20}}>
            {pD.filter(d=>d.count>0).reverse().map((d,i,arr) => (
              <button key={d.dia} onClick={() => setHDia(d.dia)}
                style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:i<arr.length-1?"1px solid "+C.border:"none",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                <div><div style={{fontSize:14,fontWeight:600,color:C.txt}}>{d.dia} de {MESES[hMes]}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{d.count} venta{d.count!==1?"s":""}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontSize:14,color:C.gr,fontWeight:700}}>S/{d.total.toFixed(0)}</div>{isAdmin && <div style={{fontSize:11,color:C.muted}}>gan. S/{d.ganancia.toFixed(0)}</div>}</div>
              </button>
            ))}
          </div>
      }
      {/* Movimientos / audit trail — opens full view */}
      {(() => {
        const movs = hist.filter(v => {
          const d=new Date(v.fecha);
          return d.getMonth()===hMes && d.getFullYear()===hAnio && esMovimiento(v);
        });
        if(!movs.length) return null;
        return (
          <button onClick={onVerTraza}
            style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"16px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>Movimientos especiales</div>
              <div style={{fontSize:12,color:C.muted}}>{movs.length} movimiento{movs.length!==1?"s":""} este mes · ajustes, traslados, ediciones y anulaciones</div>
            </div>
            <span style={{color:C.pr,fontSize:18,fontWeight:600}}>→</span>
          </button>
        );
      })()}
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Top del mes</div>
      <TopList data={top}/>
    </div>
  );
}

// ── EGRESOS (gastos operativos del negocio) ──
// La utilidad real = ganancia bruta de las ventas − estos egresos. Sin esto la
// dueña solo ve margen sobre mercaderia y cree que gana mas de lo que gana.
function EgresosView({egresos, onAdd, onDel, ganMes, onBack, isDesktop}) {
  const [form, setForm] = useState({monto:"", categoria:"", detalle:"", medio:"efectivo"});
  const [confDel, setConfDel] = useState(null);
  const [mesOff, setMesOff] = useState(0);

  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth()-mesOff);
  const MESV = base.getMonth(), ANIOV = base.getFullYear();
  const delMes = egresos.filter(e => { const d=new Date(e.fecha); return d.getMonth()===MESV && d.getFullYear()===ANIOV; })
                        .sort((a,b) => new Date(b.fecha)-new Date(a.fecha));
  const totalMes = delMes.reduce((a,e)=>a+(e.monto||0),0);
  const utilidad = (ganMes||0) - totalMes;

  const porCat = CAT_EGRESO.map(c => ({...c, total: delMes.filter(e=>e.categoria===c.id).reduce((a,e)=>a+(e.monto||0),0)}))
                           .filter(c => c.total>0).sort((a,b)=>b.total-a.total);
  const maxCat = Math.max(...porCat.map(c=>c.total), 1);

  const guardar = () => {
    const monto = parseFloat(form.monto);
    if (!(monto>0) || !isFinite(monto)) return;
    if (!form.categoria) return;
    onAdd({monto, categoria:form.categoria, detalle:form.detalle.trim(), medio:form.medio});
    setForm({monto:"", categoria:"", detalle:"", medio:"efectivo"});
  };
  const listo = parseFloat(form.monto)>0 && !!form.categoria;

  return (
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.pr,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:14}}>← Volver</button>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:4,letterSpacing:-0.5}}>Egresos</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:18}}>Gastos operativos del negocio</div>

      {/* RESUMEN: lo que de verdad le quedo */}
      <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,padding:16,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:13,fontWeight:700,textTransform:"capitalize"}}>{base.toLocaleDateString("es-PE",{month:"long",year:"numeric"})}</div>
          <div style={{display:"flex",gap:6}}>
            <button onClick={()=>setMesOff(m=>m+1)} style={{background:C.muted2,border:"none",borderRadius:8,padding:"5px 11px",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:C.txt}}>‹ Anterior</button>
            {mesOff>0 && <button onClick={()=>setMesOff(m=>m-1)} style={{background:C.muted2,border:"none",borderRadius:8,padding:"5px 11px",fontSize:12,cursor:"pointer",fontFamily:"inherit",color:C.txt}}>Siguiente ›</button>}
          </div>
        </div>
        {[["Ganancia de ventas", ganMes||0, C.gr, false],
          ["Egresos del mes",   -totalMes,  C.re, false],
          ["Utilidad real",      utilidad,  utilidad>=0?C.gr:C.re, true]].map(([lbl,val,col,fuerte],i) => (
          <div key={lbl} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
            padding:fuerte?"12px 0 0":"7px 0", borderTop:fuerte?"1px solid "+C.border:"none", marginTop:fuerte?6:0}}>
            <span style={{fontSize:fuerte?14:13,color:fuerte?C.txt:C.muted,fontWeight:fuerte?700:500}}>{lbl}</span>
            <span style={{fontSize:fuerte?20:14,fontWeight:700,color:col,letterSpacing:fuerte?-0.5:0}}>
              {val<0?"−":""}S/{Math.abs(val).toFixed(0)}
            </span>
          </div>
        ))}
        {mesOff===0 && (ganMes||0)===0 && totalMes===0 && (
          <div style={{fontSize:11,color:C.muted,marginTop:10,textAlign:"center"}}>Aún no hay movimiento este mes.</div>
        )}
      </div>

      {/* REGISTRAR */}
      <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,padding:16,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Registrar un gasto</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14,lineHeight:1.5}}>
          La compra de mercadería <b>no va aquí</b> — ese costo ya se descuenta al vender.
        </div>

        <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:6}}>Monto S/</div>
        <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" value={form.monto}
          onChange={e => { const v=e.target.value; if(v==="" || parseFloat(v)>=0) setForm(f=>({...f,monto:v})); }}
          style={{...IS, fontSize:22, fontWeight:700, marginBottom:14}}/>

        <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:6}}>¿En qué se gastó?</div>
        <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr":"1fr",gap:7,marginBottom:14}}>
          {CAT_EGRESO.map(c => (
            <button key={c.id} onClick={() => setForm(f=>({...f,categoria:c.id}))}
              style={{background:form.categoria===c.id?C.prBg:C.muted2, border:"1.5px solid "+(form.categoria===c.id?C.pr:"transparent"),
                borderRadius:10, padding:"9px 12px", cursor:"pointer", fontFamily:"inherit", textAlign:"left"}}>
              <div style={{fontSize:13,fontWeight:600,color:form.categoria===c.id?C.pr:C.txt}}>{c.label}</div>
              <div style={{fontSize:10,color:C.muted,marginTop:1}}>{c.ej}</div>
            </button>
          ))}
        </div>

        <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:6}}>
          Detalle {form.categoria==="otros" ? <span style={{color:C.re}}>*</span> : <span style={{fontSize:11}}>(opcional)</span>}
        </div>
        <input type="text" placeholder={form.categoria==="otros" ? "¿En qué se gastó?" : "Ej: recibo de agosto"} value={form.detalle}
          onChange={e => setForm(f=>({...f,detalle:e.target.value}))} style={{...IS, marginBottom:14}}/>

        <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:6}}>¿Cómo se pagó?</div>
        <div style={{display:"flex",gap:7,marginBottom:16,flexWrap:"wrap"}}>
          {MEDIOS_PAGO.map(m => (
            <button key={m.id} onClick={() => setForm(f=>({...f,medio:m.id}))}
              style={{flex:"1 1 30%", background:form.medio===m.id?C.prBg:C.muted2, border:"1.5px solid "+(form.medio===m.id?C.pr:"transparent"),
                borderRadius:10, padding:"10px 8px", cursor:"pointer", fontFamily:"inherit",
                fontSize:12, fontWeight:form.medio===m.id?700:500, color:form.medio===m.id?C.pr:C.txt}}>
              {m.label}
            </button>
          ))}
        </div>

        <Btn onClick={guardar} full v={listo?"primary":"secondary"}>Registrar gasto</Btn>
        {!listo && <div style={{fontSize:11,color:C.muted,marginTop:8,textAlign:"center"}}>Ingresa un monto y elige una categoría.</div>}
      </div>

      {/* EN QUE SE VA LA PLATA */}
      {porCat.length>0 && (
        <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,padding:16,marginBottom:16}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>En qué se va la plata</div>
          {porCat.map((c,i) => (
            <div key={c.id} style={{marginBottom:i<porCat.length-1?12:0}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5,gap:10}}>
                <span style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.label}</span>
                <span style={{fontSize:13,fontWeight:700,flexShrink:0}}>S/{c.total.toFixed(0)}</span>
              </div>
              <div style={{height:8,background:C.muted2,borderRadius:4,overflow:"hidden"}}>
                <div style={{height:"100%",width:Math.max((c.total/maxCat)*100,2)+"%",background:i===0?C.re:"#FCA5A5",borderRadius:4}}/>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DETALLE */}
      <div style={{fontSize:13,fontWeight:700,marginBottom:10}}>Gastos registrados</div>
      {delMes.length===0 ? (
        <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,padding:"22px 16px",textAlign:"center",color:C.muted,fontSize:13}}>
          Sin gastos registrados este mes.
        </div>
      ) : delMes.map(e => (
        <div key={e.id} style={{background:C.card,border:"1px solid "+C.border,borderLeft:"4px solid "+C.re,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10}}>
            <div style={{minWidth:0,flex:1}}>
              <div style={{fontSize:13,fontWeight:600}}>{catEgreso(e.categoria).label}</div>
              {e.detalle && <div style={{fontSize:12,color:C.muted,marginTop:2,wordBreak:"break-word"}}>{e.detalle}</div>}
              <div style={{fontSize:11,color:C.muted,marginTop:4,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span>{fmtFecha(e.fecha)} · {fmtHora(e.fecha)}</span>
                <Pill color={e.medio==="efectivo"?"gr":"pr"}>{medioPago(e.medio).label}</Pill>
                <span>· {e.responsable}</span>
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:15,fontWeight:700,color:C.re}}>−S/{(e.monto||0).toFixed(0)}</div>
              <button onClick={() => setConfDel(e.id)}
                style={{background:"none",border:"none",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:"inherit",padding:"4px 0 0",textDecoration:"underline"}}>
                Eliminar
              </button>
            </div>
          </div>
          {confDel===e.id && (
            <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid "+C.border}}>
              <div style={{fontSize:12,color:C.txt,marginBottom:8}}>¿Eliminar este gasto de S/{(e.monto||0).toFixed(0)}?</div>
              <div style={{display:"flex",gap:8}}>
                <Btn onClick={()=>setConfDel(null)} v="secondary" full>Cancelar</Btn>
                <Btn onClick={()=>{ onDel(e.id); setConfDel(null); }} v="danger" full>Sí, eliminar</Btn>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── TRAZABILIDAD (full audit log view) ──
function TrazaView({hist, onBack, isDesktop}) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState("todos");

  const movs = hist.filter(esMovimiento);
  const filtrados = movs.filter(v => {
    const matchQ = !q || (v.producto||"").toLowerCase().includes(q.toLowerCase()) || (v.sku||"").toLowerCase().includes(q.toLowerCase());
    const tipo = v.anulada ? "anulada" : v.tipo==="ajuste" ? (v.subtipo==="restock"?"restock":"ajuste") : v.tipo;
    const matchF = filtro==="todos" ||
      (filtro==="restock" && tipo==="restock") ||
      (filtro==="ajuste"  && tipo==="ajuste") ||
      (filtro==="traslado"&& v.tipo==="traslado") ||
      (filtro==="devolucion" && v.tipo==="devolucion") ||
      (filtro==="edicion" && v.tipo==="edicion") ||
      (filtro==="anulada" && v.anulada);
    return matchQ && matchF;
  }).sort((a,b) => new Date(b.fecha)-new Date(a.fecha));

  const meta = (v) => {
    if (v.anulada)            return {txt:"Venta anulada", c:C.re,      bg:C.reBg};
    if (v.tipo==="devolucion")return {txt: v.subtipo==="cambio"?"Cambio":"Reembolso", c:C.or, bg:C.orBg};
    if (v.tipo==="traslado")  return {txt:"Traslado",      c:C.gr,      bg:C.grBg};
    if (v.tipo==="edicion")   return {txt:"Edición",       c:"#0891b2", bg:"#ECFEFF"};
    if (v.subtipo==="restock")return {txt:"Restock",       c:C.pu,      bg:C.puBg};
    return {txt:"Ajuste de conteo", c:C.pu, bg:C.puBg};
  };
  const rol = (r) => r==="admin"?"Dueña":r==="vendedora"?"Vendedora":"—";

  const filtros = [["todos","Todos"],["restock","Restock"],["ajuste","Ajustes"],["traslado","Traslados"],["devolucion","Devoluciones"],["edicion","Ediciones"],["anulada","Anuladas"]];

  return (
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:16,fontWeight:500}}>← Volver</button>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:4,letterSpacing:-0.5}}>Trazabilidad</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:16}}>Registro de todos los cambios de inventario con fecha, hora y responsable.</div>

      {/* Search */}
      <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por producto o código..."
        style={{width:"100%",background:C.card,border:"1.5px solid "+C.border,borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box",marginBottom:12}}/>

      {/* Filter chips */}
      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:16}}>
        {filtros.map(([v,l]) => (
          <button key={v} onClick={()=>setFiltro(v)}
            style={{flexShrink:0,padding:"7px 14px",borderRadius:20,border:"1.5px solid "+(filtro===v?C.gr:C.border),background:filtro===v?C.gr:C.card,color:filtro===v?"#fff":C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:600}}>
            {l}
          </button>
        ))}
      </div>

      {filtrados.length===0
        ? <div style={{background:C.card,borderRadius:16,padding:"40px 20px",textAlign:"center",border:"1px solid "+C.border,color:C.muted,fontSize:14}}>{q||filtro!=="todos"?"Sin movimientos que coincidan.":"Aún no hay movimientos registrados."}</div>
        : <div style={{display:"grid",gridTemplateColumns:isDesktop?"1fr 1fr":"1fr",gap:12}}>
          {filtrados.map(v => {
            const m = meta(v);
            const quien = v.anulada ? v.anuladaPor : v.responsable;
            return (
              <div key={v.id} style={{background:C.card,border:"1px solid "+C.border,borderLeft:"4px solid "+m.c,borderRadius:14,padding:"16px",boxShadow:sh}}>
                {/* Header */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div>
                    <span style={{fontSize:10,fontWeight:700,color:m.c,background:m.bg,borderRadius:6,padding:"2px 8px"}}>{m.txt.toUpperCase()}</span>
                    <div style={{fontSize:15,fontWeight:700,marginTop:6}}>{v.producto}</div>
                    <div style={{fontSize:11,color:C.muted,marginTop:1}}>{v.sku} · {v.sede}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:12,color:C.txt,fontWeight:600}}>{fmtFecha(v.anulada&&v.fechaAnulacion?v.fechaAnulacion:v.fecha).split(" ").slice(0,2).join(" ")}</div>
                    <div style={{fontSize:11,color:C.muted}}>{fmtHora(v.anulada&&v.fechaAnulacion?v.fechaAnulacion:v.fecha)}</div>
                  </div>
                </div>

                {/* Body — structured detail */}
                <div style={{background:C.muted2,borderRadius:10,padding:"12px 14px",fontSize:13}}>
                  {/* Anulada */}
                  {v.anulada && (
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:v.fechaAnulacion?8:0}}>
                        <span style={{color:C.muted}}>{tallaLbl(v.talla)} · {v.cantidad}u</span>
                        <span style={{color:C.re,fontWeight:600,textDecoration:"line-through"}}>S/{(v.total||0).toFixed(0)}</span>
                      </div>
                      <div style={{borderTop:"1px solid "+C.border,paddingTop:8,display:"flex",flexDirection:"column",gap:4}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                          <span style={{color:C.muted}}>Vendido</span>
                          <span style={{color:C.txt}}>{fmtFecha(v.fecha).split(" ").slice(0,2).join(" ")} · {fmtHora(v.fecha)}</span>
                        </div>
                        {v.fechaAnulacion && (
                          <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}>
                            <span style={{color:C.re}}>Anulado</span>
                            <span style={{color:C.re,fontWeight:600}}>{fmtFecha(v.fechaAnulacion).split(" ").slice(0,2).join(" ")} · {fmtHora(v.fechaAnulacion)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Restock / Ajuste with cambios */}
                  {!v.anulada && v.cambios && v.cambios.length>0 && v.tipo==="ajuste" && (
                    <div>
                      <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:6,textTransform:"uppercase",letterSpacing:0.3}}>Cambios de stock</div>
                      {v.cambios.map((c,i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span>{tallaLbl(c.talla)}{c.nueva && <span style={{color:C.gr,fontSize:11}}> (talla nueva)</span>}</span>
                          <span style={{fontWeight:700,color:c.delta>0?C.gr:C.re}}>{c.delta>0?"+":""}{c.delta}u</span>
                        </div>
                      ))}
                      {(v.precioCompra||v.precioVenta) && (
                        <div style={{borderTop:"1px solid "+C.border,marginTop:8,paddingTop:8,display:"flex",gap:16}}>
                          {v.precioCompra && <span style={{fontSize:12,color:C.muted}}>Compra: <b style={{color:C.txt}}>S/{v.precioCompra}</b></span>}
                          {v.precioVenta && <span style={{fontSize:12,color:C.muted}}>Venta: <b style={{color:C.txt}}>S/{v.precioVenta}</b></span>}
                        </div>
                      )}
                      {v.motivo && v.subtipo!=="restock" && <div style={{fontSize:12,color:C.muted,marginTop:8}}>Motivo: <b style={{color:C.txt}}>{v.motivo}</b></div>}
                      {v.stockAntes!==undefined && (
                        <div style={{fontSize:12,color:C.muted,marginTop:8,borderTop:"1px solid "+C.border,paddingTop:8}}>
                          Stock total: <b style={{color:C.txt}}>{v.stockAntes}u → {v.stockDespues}u</b>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Traslado */}
                  {!v.anulada && v.tipo==="traslado" && (
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,fontSize:12}}>
                        <span style={{background:C.reBg,color:C.re,borderRadius:6,padding:"2px 8px",fontWeight:600}}>{v.origen}</span>
                        <span style={{color:C.muted}}>→</span>
                        <span style={{background:C.grBg,color:C.gr,borderRadius:6,padding:"2px 8px",fontWeight:600}}>{v.destino}</span>
                      </div>
                      {v.cambios && v.cambios.map((c,i) => (
                        <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                          <span>{tallaLbl(c.talla)}</span>
                          <span style={{fontWeight:700,color:C.gr}}>{c.cantidad}u</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Edicion */}
                  {!v.anulada && v.tipo==="edicion" && (
                    <div>
                      {v.cambiosCampos
                        ? v.cambiosCampos.map((c,i) => (
                          <div key={i} style={{marginBottom:6}}>
                            <div style={{fontSize:11,color:C.muted,fontWeight:600}}>{c.campo}</div>
                            <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
                              <span style={{color:C.muted,textDecoration:"line-through"}}>{c.antes}</span>
                              <span style={{color:C.muted}}>→</span>
                              <span style={{color:C.txt,fontWeight:600}}>{c.despues}</span>
                            </div>
                          </div>
                        ))
                        : <div style={{color:C.muted}}>{v.detalle}</div>
                      }
                    </div>
                  )}

                  {/* Fallback for old entries without structured data */}
                  {!v.anulada && !v.cambios && !v.cambiosCampos && v.detalle && (
                    <div style={{color:C.muted}}>{v.detalle}</div>
                  )}
                </div>

                {/* Footer — responsable */}
                <div style={{fontSize:11,color:C.muted,marginTop:10,display:"flex",alignItems:"center",gap:6}}>
                  <span style={{width:6,height:6,borderRadius:"50%",background:quien==="admin"?C.pu:C.gr,display:"inline-block"}}/>
                  Responsable: <b style={{color:C.txt}}>{rol(quien)}</b>
                </div>
              </div>
            );
          })}
        </div>
      }
    </div>
  );
}


function DashboardView({activos, ventasMes, alertas, topMesData, planActivo, expInv, hist, egresos, isDesktop, onVerTraza, onVerEgresos}) {
  const [showAlertas, setShowAlertas] = useState(false);
  const [metrica, setMetrica] = useState("total");   // "total" = ingresos | "ganancia"

  const agotados  = activos.filter(p => totalStock(p)===0);
  const bajStock  = activos.filter(p => p.tallas.some(t=>t.stock>0&&t.stock<=STOCK_BAJO));
  const totalAlerts = agotados.length + bajStock.length;

  // Today's sales (real sales only)
  const ventasHoyArr = hist.filter(v => esHoy(v.fecha) && esVentaReal(v));
  const ingresosHoy  = ventasHoyArr.reduce((a,v)=>a+(v.total||0),0);
  const ganHoy       = ventasHoyArr.reduce((a,v)=>a+(v.ganancia||0),0);
  // Month metrics
  const ventasMesReales = ventasMes.filter(esVentaReal);
  const ingresosMes  = ventasMesReales.reduce((a,v)=>a+(v.total||0),0);
  const ganMes       = ventasMesReales.reduce((a,v)=>a+(v.ganancia||0),0);
  const ticketProm   = ventasMesReales.length>0 ? ingresosMes/ventasMesReales.length : 0;
  // Egresos del mes y utilidad real (ganancia bruta menos gastos operativos)
  const egresosMes = (egresos||[]).filter(e => { const d=new Date(e.fecha); return d.getMonth()===MES && d.getFullYear()===ANIO; })
                                  .reduce((a,e)=>a+(e.monto||0),0);
  const utilidadMes = ganMes - egresosMes;
  // Inventory metrics
  const invertido    = activos.reduce((a,p)=>a+(p.compra||0)*totalStock(p),0);
  const valorVenta   = activos.reduce((a,p)=>a+(p.venta||0)*totalStock(p),0);
  const unidadesTot  = activos.reduce((a,p)=>a+totalStock(p),0);

  // ── ACUMULADO DEL MES ──
  // Suma corrida dia a dia, cortada en HOY (no dibujamos el mes que todavia no
  // paso). Se compara contra el MISMO TRAMO del mes anterior: sin esa referencia
  // el acumulado es solo una curva que sube y no dice si vamos bien o mal.
  const acum = (() => {
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
    // el mes anterior pudo ser mas corto (ej. feb): no inventamos dias que no existieron
    const prev = porDia(mesPrev, anioPrev, Math.min(diaHoy, diasMesPrev));

    const puntos = Array.from({length:diaHoy}, (_,i) => ({
      dia: i+1,
      actual: actual[i+1] || 0,
      prev: prev[i+1] != null ? prev[i+1] : null,
    }));
    const totalActual = actual[diaHoy] || 0;
    const totalPrev   = prev[Math.min(diaHoy, diasMesPrev)] || 0;
    const max = Math.max(totalActual, totalPrev, 1);
    const dif = totalPrev>0 ? ((totalActual-totalPrev)/totalPrev)*100 : null;
    return {puntos, totalActual, totalPrev, max, dif, diaHoy, hayPrev: totalPrev>0};
  })();

  // ── TOP PRODUCTOS POR INGRESOS ──
  // Agrupado por SKU (todas las tallas juntas): el dashboard responde "cual es mi
  // producto que mas vende", no "cual talla". Ordenado por ingresos, que es lo que
  // dice donde esta la plata (unidades solo dice que se mueve rapido).
  const topIngresos = (() => {
    const ag = {};
    ventasMes.filter(esVentaReal).forEach(v => {
      const k = v.sku || v.producto;
      if (!ag[k]) ag[k] = {sku:v.sku, nombre:v.producto, total:0, ganancia:0, unidades:0};
      ag[k].total     += (v.total||0);
      ag[k].ganancia  += (v.ganancia||0);
      ag[k].unidades  += (v.cantidad||0);
    });
    return Object.values(ag).sort((a,b) => b.total-a.total).slice(0,5);
  })();
  const maxTop = Math.max(...topIngresos.map(t=>t.total), 1);


  const KCard = ({label, value, sub, color}) => (
    <div style={{background:C.card,borderRadius:16,padding:"16px 16px",boxShadow:sh,border:"1px solid "+C.border}}>
      <div style={{fontSize:11,color:C.muted,fontWeight:500,marginBottom:8,textTransform:"uppercase",letterSpacing:0.3}}>{label}</div>
      <div style={{fontSize:22,fontWeight:700,color:color||C.txt,letterSpacing:-0.5,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:C.muted,marginTop:4}}>{sub}</div>}
    </div>
  );

  return (
    <div>
      <div style={{fontSize:13,color:C.muted,fontWeight:500,marginBottom:4}}>{HOY.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long"})}</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:20,letterSpacing:-0.5}}>Resumen del negocio</div>

      {activos.length===0 && (
        <div style={{background:C.prBg,border:"1px solid "+C.prLt,borderRadius:16,padding:"20px 16px",marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:600,color:C.pr,marginBottom:4}}>Bienvenido a BerroStock</div>
          <div style={{fontSize:13,color:C.muted}}>Ve a Stock → Agregar para ingresar tus primeros productos.</div>
        </div>
      )}

      {/* TODAY */}
      <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Hoy</div>
      <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr 1fr",gap:12,marginBottom:20}}>
        <KCard label="Ventas" value={ventasHoyArr.length} sub={ventasHoyArr.length===1?"transacción":"transacciones"}/>
        <KCard label="Ingresos" value={"S/"+ingresosHoy.toFixed(0)} color={C.gr}/>
        <KCard label="Ganancia" value={"S/"+ganHoy.toFixed(0)} color={C.gr}/>
      </div>

      {/* MONTH */}
      <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Este mes</div>
      <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(4,1fr)":"1fr 1fr",gap:12,marginBottom:20}}>
        <KCard label="Ingresos" value={"S/"+ingresosMes.toFixed(0)}/>
        <KCard label="Ganancia" value={"S/"+ganMes.toFixed(0)} color={C.gr}/>
        <KCard label="Ventas" value={ventasMesReales.length}/>
        <KCard label="Ticket prom." value={"S/"+ticketProm.toFixed(0)}/>
      </div>

      {/* INVENTORY */}
      <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:10,textTransform:"uppercase",letterSpacing:0.5}}>Inventario</div>
      <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(4,1fr)":"1fr 1fr",gap:12,marginBottom:20}}>
        <KCard label="Invertido" value={"S/"+invertido.toFixed(0)} sub="costo del stock"/>
        <KCard label="Valor venta" value={"S/"+valorVenta.toFixed(0)} sub="potencial" color={C.gr}/>
        <KCard label="Productos" value={activos.length} sub="SKUs activos"/>
        <KCard label="Unidades" value={unidadesTot} sub="en stock"/>
      </div>

      {/* Compact alerts row — tappable */}
      {totalAlerts>0 && (
        <button onClick={() => setShowAlertas(!showAlertas)}
          style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"12px 16px",cursor:"pointer",fontFamily:"inherit",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,textAlign:"left"}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {agotados.length>0 && <span style={{background:C.reBg,color:C.re,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><Ico n="circAlerta" s={13}/>{agotados.length} agotado{agotados.length!==1?"s":""}</span>}
            {bajStock.length>0 && <span style={{background:C.yeBg,color:C.ye,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600,display:"inline-flex",alignItems:"center",gap:5}}><Ico n="alerta" s={13}/>{bajStock.length} bajo stock</span>}
          </div>
          <span style={{color:C.muted,fontSize:14}}>{showAlertas?"▲":"▼"}</span>
        </button>
      )}
      {showAlertas && alertas.map(p => (
        <div key={p.id} style={{background:C.card,border:"1px solid "+C.border,borderLeft:"4px solid "+C.or,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{p.sku} · {p.sede}</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>{p.nombre}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {p.tallas.filter(t=>t.stock<=STOCK_BAJO).map(t=><Pill key={t.talla} color={t.stock===0?"re":"ye"}>{tallaLbl(t.talla)}: {t.stock===0?"agotado":t.stock+"u"}</Pill>)}
          </div>
        </div>
      ))}


      {/* ACUMULADO DEL MES — linea continua, cortada en hoy, vs mes anterior */}
      <div style={{background:C.card,borderRadius:16,padding:"16px",border:"1px solid "+C.border,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12,marginBottom:4,flexWrap:"wrap"}}>
          <div>
            <div style={{fontSize:13,fontWeight:700}}>Acumulado de {HOY.toLocaleDateString("es-PE",{month:"long"})}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>Día {acum.diaHoy} del mes</div>
          </div>
          <div style={{display:"flex",background:C.muted2,borderRadius:9,padding:2,gap:2}}>
            {[["total","Ingresos"],["ganancia","Ganancia"]].map(([k,lbl]) => (
              <button key={k} onClick={() => setMetrica(k)}
                style={{background:metrica===k?C.card:"transparent",border:"none",borderRadius:7,padding:"6px 12px",fontSize:12,fontWeight:metrica===k?700:500,color:metrica===k?C.txt:C.muted,cursor:"pointer",fontFamily:"inherit",boxShadow:metrica===k?"0 1px 2px rgba(0,0,0,0.08)":"none"}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:12,flexWrap:"wrap"}}>
          <div style={{fontSize:26,fontWeight:700,color:metrica==="ganancia"?C.gr:C.txt,letterSpacing:-0.5}}>S/{acum.totalActual.toFixed(0)}</div>
          {acum.dif!=null && (
            <div style={{fontSize:12,fontWeight:600,color:acum.dif>=0?C.gr:C.re}}>
              {acum.dif>=0?"▲":"▼"} {Math.abs(acum.dif).toFixed(0)}% vs mes pasado
            </div>
          )}
        </div>

        {acum.totalActual===0 && !acum.hayPrev ? (
          <div style={{padding:"28px 0",textAlign:"center",color:C.muted,fontSize:13}}>Aún no hay ventas este mes.</div>
        ) : (() => {
          const W=300, H=96, PX=2;
          const px = (i,n) => n<=1 ? PX : PX + (i/(n-1))*(W-PX*2);
          const py = (v) => H - 6 - (v/acum.max)*(H-14);
          const linea = (campo) => {
            const pts = acum.puntos.filter(p => p[campo]!=null);
            if (!pts.length) return "";
            if (pts.length===1) { const y=py(pts[0][campo]); return "M"+PX+","+y+"L"+(W-PX)+","+y; }
            return pts.map((p,i) => (i?"L":"M")+px(i,pts.length).toFixed(1)+","+py(p[campo]).toFixed(1)).join(" ");
          };
          const dActual = linea("actual");
          const areaActual = dActual ? dActual+" L"+(W-PX)+","+(H-6)+" L"+PX+","+(H-6)+" Z" : "";
          const col = metrica==="ganancia" ? C.gr : C.pr;
          const ult = acum.puntos[acum.puntos.length-1];
          return (
            <div>
              <svg viewBox={"0 0 "+W+" "+H} width="100%" height={H} preserveAspectRatio="none" style={{display:"block",overflow:"visible"}}>
                <defs>
                  <linearGradient id="gradAcum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={col} stopOpacity="0.18"/>
                    <stop offset="100%" stopColor={col} stopOpacity="0"/>
                  </linearGradient>
                </defs>
                {areaActual && <path d={areaActual} fill="url(#gradAcum)"/>}
                {acum.hayPrev && <path d={linea("prev")} fill="none" stroke={C.border} strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" vectorEffect="non-scaling-stroke"/>}
                {dActual && <path d={dActual} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>}
                {ult && acum.puntos.length>0 && (
                  <circle cx={px(acum.puntos.length-1, acum.puntos.length)} cy={py(ult.actual)} r="3.5" fill={col} stroke={C.card} strokeWidth="2" vectorEffect="non-scaling-stroke"/>
                )}
              </svg>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.muted,marginTop:6}}>
                <span>1</span><span>Día {acum.diaHoy}</span>
              </div>
              {acum.hayPrev && (
                <div style={{display:"flex",gap:14,marginTop:10,fontSize:11,color:C.muted,flexWrap:"wrap"}}>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                    <span style={{width:14,height:2.5,background:col,borderRadius:2}}/>Este mes
                  </span>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                    <span style={{width:14,height:0,borderTop:"2px dashed "+C.border}}/>Mes pasado · S/{acum.totalPrev.toFixed(0)}
                  </span>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* TOP PRODUCTOS POR INGRESOS — agrupado por SKU, no por talla */}
      <div style={{background:C.card,borderRadius:16,padding:"16px",border:"1px solid "+C.border,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:2}}>Top productos del mes</div>
        <div style={{fontSize:11,color:C.muted,marginBottom:14}}>Por ingresos generados</div>
        {topIngresos.length===0 ? (
          <div style={{padding:"20px 0",textAlign:"center",color:C.muted,fontSize:13}}>Sin ventas registradas.</div>
        ) : topIngresos.map((t,i) => (
          <div key={t.sku||t.nombre} style={{marginBottom:i<topIngresos.length-1?14:0}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10,marginBottom:5}}>
              <div style={{minWidth:0,flex:1}}>
                <div style={{fontSize:13,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.nombre}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:1}}>{t.sku} · {t.unidades}u</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:14,fontWeight:700}}>S/{t.total.toFixed(0)}</div>
                <div style={{fontSize:10,color:C.gr,fontWeight:600}}>gan. S/{t.ganancia.toFixed(0)}</div>
              </div>
            </div>
            <div style={{height:8,background:C.muted2,borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:Math.max((t.total/maxTop)*100,2)+"%",background:i===0?C.pr:C.prLt,borderRadius:4}}/>
            </div>
          </div>
        ))}
      </div>

      {/* Top del mes — detalle por talla */}
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Detalle por talla</div>
      <TopList data={topMesData}/>
      <button onClick={onVerEgresos}
        style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"14px 16px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",marginTop:16,display:"flex",justifyContent:"space-between",alignItems:"center",gap:12}}>
        <div style={{minWidth:0}}>
          <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>Egresos del negocio</div>
          <div style={{fontSize:12,color:C.muted}}>
            {egresosMes>0 ? <>S/{egresosMes.toFixed(0)} este mes · utilidad real <b style={{color:utilidadMes>=0?C.gr:C.re}}>S/{utilidadMes.toFixed(0)}</b></>
                          : "Registra alquiler, servicios, sueldos y más"}
          </div>
        </div>
        <span style={{color:C.pr,fontSize:18,fontWeight:600,flexShrink:0}}>→</span>
      </button>
      <button onClick={onVerTraza}
        style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"14px 16px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",marginTop:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>Trazabilidad de inventario</div>
          <div style={{fontSize:12,color:C.muted}}>Historial de ajustes, traslados, ediciones y anulaciones</div>
        </div>
        <span style={{color:C.pr,fontSize:18,fontWeight:600}}>→</span>
      </button>
      <div style={{marginTop:16}}><Btn onClick={expInv} full v={planActivo?"primary":"secondary"}><span style={{display:"inline-flex",alignItems:"center",gap:6}}>{planActivo?"↓":<Ico n="candado" s={13}/>}Exportar inventario (.xlsx)</span></Btn></div>
    </div>
  );
}

// ── APP ──
export default function App() {
  const [isDesktop, setIsDesktop] = useState(typeof window!=="undefined" && window.innerWidth>=768);
  const [prods,  setProds]    = useState(() => LS.get("bs_prods",[]));
  const [hist,   setHist]     = useState(() => LS.get("bs_hist",[]));
  const [sesion, setSesion]   = useState(null);
  const [pines,  setPines]    = useState(() => LS.get("bs_pines",{admin:"1234",vendedora:"0000"}));
  const [vista,  setVista]    = useState("productos");
  const [plan,   setPlan]     = useState(() => LS.get("bs_plan","free"));
  const [form,   setForm]     = useState({sku:"",nombre:"",compra:"",venta:"",sede:"",tallas:[]});
  const [skuErr, setSkuErr]   = useState("");
  const [skuDupe,setSkuDupe]  = useState(null);
  const [vm,     setVm]       = useState(null);
  const [cant,   setCant]     = useState(1);
  const [toast,  setToast]    = useState(null);
  const [search, setSearch]   = useState("");
  const [sedeFil,setSedeFil]  = useState("Todas");
  const [verArch,setVerArch]  = useState(false);
  const [upModal,setUpModal]  = useState(false);
  const [pinsMod,setPinsMod]  = useState(false);
  const [impMod, setImpMod]   = useState(null);
  const [scanM,  setScanM]    = useState(false);
  const [editM,  setEditM]    = useState(null);
  const [editF,  setEditF]    = useState({sku:"",nombre:"",compra:"",venta:"",sede:"",tallas:[]});
  const [confDel,setConfDel]  = useState(false);
  const [transferM,setTransferM] = useState(null);
  const [restockM, setRestockM]  = useState(null); // {prod, cantidades:{talla:""}, nuevoPrecio:""}
  const [masOpcM,  setMasOpcM]   = useState(null); // prod for "···" menu
  const [ajusteM,  setAjusteM]   = useState(null); // {prod, tallaIdx, delta:"", motivo:""}
  const [verTraza, setVerTraza]  = useState(false);
  const [egresos, setEgresos]    = useState(() => LS.get("bs_egresos",[]));
  const [devM,    setDevM]       = useState(null); // {venta, modo, salida, q}
  const [verEgresos, setVerEgresos] = useState(false);
  const [errGuardado, setErrGuardado] = useState(false); // el navegador rechazo guardar
  const fileRef = useRef();

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  // Si el navegador rechaza guardar (sin espacio, modo privado), la usuaria DEBE
  // enterarse: en pantalla la venta quedo registrada, pero al recargar se pierde.
  // El aviso no se puede cerrar hasta que el guardado vuelva a funcionar.
  useEffect(() => { setErrGuardado(e => !LS.set("bs_prods", prods) || e); }, [prods]);
  useEffect(() => { setErrGuardado(e => !LS.set("bs_hist",  hist)  || e); }, [hist]);
  useEffect(() => { setErrGuardado(e => !LS.set("bs_egresos", egresos) || e); }, [egresos]);
  useEffect(() => { LS.set("bs_plan",  plan);  }, [plan]);
  useEffect(() => { LS.set("bs_pines", pines); }, [pines]);

  const t_ = (msg, tipo="ok") => { setToast({msg,tipo}); setTimeout(() => setToast(null), 2500); };

  const handleLogin = (rol) => { setSesion(rol); setVista(rol==="admin"?"dashboard":"productos"); setSearch(""); setSedeFil("Todas"); };

  const isAdmin   = sesion === "admin";
  const pro       = plan === "pro" || plan === "trial";
  const activos   = prods.filter(p => !p.archivado);
  const archivados= prods.filter(p => p.archivado);
  const limited   = plan === "free" && activos.length >= PLAN_MAX;
  const ventasHoy = hist.filter(v => esHoy(v.fecha) && !v.anulada && v.tipo!=="ajuste");
  const ventasMes = hist.filter(v => { const d=new Date(v.fecha); return d.getMonth()===MES&&d.getFullYear()===ANIO&&!v.anulada&&v.tipo!=="ajuste"; });
  // Ganancia bruta del mes: solo ventas reales (sin ajustes, traslados ni ediciones,
  // que traen montos que no son ingresos). Es la base de la utilidad real en Egresos.
  const ganMesBruta = ventasMes.filter(esVentaReal).reduce((a,v)=>a+(v.ganancia||0),0);
  const sedes     = ["Todas",...new Set(activos.map(p => p.sede).filter(Boolean))];
  const alertas   = activos.filter(p => p.tallas.some(t => t.stock <= STOCK_BAJO));
  const filtrados = activos.filter(p => {
    const ms = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return ms && (sedeFil==="Todas" || p.sede===sedeFil);
  });
  const topMesData = (() => {
    const ag = {};
    ventasMes.filter(esVentaReal).forEach(v => { const k=v.sku+"-T"+v.talla; if(!ag[k])ag[k]={nombre:v.producto,talla:v.talla,ganancia:0,unidades:0}; ag[k].ganancia+=(v.ganancia||0); ag[k].unidades+=(v.cantidad||0); });
    return Object.entries(ag).sort((a,b) => b[1].unidades-a[1].unidades).slice(0,5);
  })();

  // Deteccion de SKU duplicado EN VIVO (mismo codigo + misma sede). Corre en cada
  // tecla del campo SKU y al cambiar de sede. addProd la repite como respaldo.
  const buscarDupe = (sku, sede) => {
    const s = (sku||"").trim();
    if (!s) return null;
    const sedeReal = sede==="__nueva__" ? "" : sede;
    return prods.find(p => p.sku.toLowerCase()===s.toLowerCase()
      && (p.sede||"Principal").toLowerCase()===(sedeReal||"Principal").toLowerCase()) || null;
  };

  // Al detectar duplicado autocompleta el nombre y lo bloquea, para que el mismo
  // codigo no termine con descripciones distintas por un tipeo.
  const aplicarDupe = (sku, sede) => {
    const d = buscarDupe(sku, sede);
    if (d) {
      setSkuDupe(d);
      setSkuErr("Este código ya existe en esta sede.");
      setForm(ff => ({...ff, nombre:d.nombre}));
    } else {
      // solo limpia el nombre si venia autocompletado: no pisar lo que ella escribio
      if (skuDupe) setForm(ff => ({...ff, nombre:""}));
      setSkuDupe(null);
      setSkuErr("");
    }
  };

  const addProd = () => {
    if (!form.nombre||!form.compra||!form.venta) return t_("Completa nombre, compra y venta","error");
    // Clean sede: __nueva__ means they clicked "Nueva" but didn't type yet
    const sedeReal = form.sede==="__nueva__" ? "" : form.sede;
    if (!sedeReal) { setForm(ff=>({...ff,sede:""})); }
    // respaldo: la deteccion en vivo ya corrio en el onChange del SKU
    const dupe = buscarDupe(form.sku, form.sede);
    if (dupe) { setSkuErr("Este código ya existe en esta sede."); setSkuDupe(dupe); return; }
    if (limited) return setUpModal(true);
    setSkuErr(""); setSkuDupe(null);
    const tFinal = form.tallas.length>0 ? form.tallas : [{talla:"ÚNICA",stock:0}];
    setProds([...prods, {id:Date.now(), sku:form.sku.toUpperCase()||("SKU-"+Date.now()), nombre:form.nombre, compra:parseFloat(form.compra), ultimoCosto:parseFloat(form.compra), venta:parseFloat(form.venta), archivado:false, sede:sedeReal||"Principal", tallas:tFinal, fechaIngreso:new Date().toISOString()}]);
    setForm({sku:"",nombre:"",compra:"",venta:"",sede:"",tallas:[]});
    t_("Producto agregado ✓"); setVista("productos");
  };

  // ── EGRESOS ──
  const addEgreso = ({monto, categoria, detalle, medio}) => {
    setEgresos([...egresos, {
      id: Date.now(), monto, categoria, detalle: detalle||"", medio: medio||"efectivo",
      responsable: sesion, fecha: new Date().toISOString(),
    }]);
    t_("Gasto registrado ✓");
  };
  const delEgreso = (id) => { setEgresos(egresos.filter(e => e.id!==id)); t_("Gasto eliminado ✓"); };

  const doVenta = () => {
    const precio = parseFloat(vm.precioFinal) || vm.prod.venta;
    const talla  = vm.prod.tallas[vm.ti];
    // el input ya bloquea negativos, pero un precio invalido contamina la ganancia
    // del mes entero: se valida tambien aca, que es donde se escribe el registro.
    if (!(precio >= 0) || !isFinite(precio)) return t_("El precio no puede ser negativo","error");
    if (cant > talla.stock) return t_("Stock insuficiente","error");
    setProds(prods.map(p => p.id!==vm.prod.id ? p : {...p, tallas:p.tallas.map((t,i) => i===vm.ti ? {...t,stock:t.stock-cant} : t)}));
    // prodId es la identidad permanente del producto: el SKU, el nombre y la sede
    // se pueden editar despues, y sin este campo la anulacion no encuentra a que
    // producto devolver el stock.
    setHist([...hist, {id:Date.now(), prodId:vm.prod.id, producto:vm.prod.nombre, sku:vm.prod.sku, talla:talla.talla, sede:vm.prod.sede, cantidad:cant, precioVenta:precio, precioOriginal:vm.prod.venta, precioCompra:vm.prod.compra, total:precio*cant, ganancia:((precio-(vm.prod.compra||0))*cant), medio:vm.medio||"efectivo", responsable:sesion, fecha:new Date().toISOString()}]);
    t_("Venta registrada ✓"); setVm(null); setCant(1);
  };

  // Devuelve unidades al inventario. Lo usan anular y devoluciones.
  // Identifica el producto por prodId (permanente) y cae a SKU+sede solo para las
  // ventas viejas, que no tienen prodId. Si la talla fue renombrada o borrada, la
  // vuelve a crear: perder stock en silencio es peor que dejar una talla suelta,
  // que la dueña puede fusionar editando el producto.
  const reponerStock = (lista, venta) => {
    let encontrado = false, tallaRecreada = false;
    const out = lista.map(p => {
      const esteEs = venta.prodId != null
        ? p.id === venta.prodId
        : (p.sku === venta.sku && p.sede === venta.sede);
      if (!esteEs) return p;
      encontrado = true;
      const ti = p.tallas.findIndex(t => t.talla === venta.talla);
      if (ti >= 0) {
        return {...p, tallas: p.tallas.map((t,i) => i===ti ? {...t, stock:t.stock+venta.cantidad} : t)};
      }
      tallaRecreada = true;
      return {...p, tallas: [...p.tallas, {talla:venta.talla, stock:venta.cantidad}]};
    });
    return {prods: out, encontrado, tallaRecreada};
  };

  const doAnular = (ventaId) => {
    const venta = hist.find(v => v.id === ventaId);
    if (!venta || venta.anulada) return;
    const {prods:nuevos, encontrado, tallaRecreada} = reponerStock(prods, venta);
    setProds(nuevos);
    setHist(hist.map(v => v.id===ventaId ? {...v, anulada:true, anuladaPor:sesion, fechaAnulacion:new Date().toISOString(),
      ...(tallaRecreada?{tallaRecreada:true}:{})} : v));
    if (!encontrado)        t_("Venta anulada — el producto ya no existe, revisa el stock","error");
    else if (tallaRecreada) t_("Venta anulada — se recreó la talla "+tallaLbl(venta.talla));
    else                    t_("Venta anulada — stock repuesto ✓");
  };

  // ── DEVOLUCION ──
  // Reembolso: entra el producto, sale la plata.
  // Cambio: entra el producto devuelto y sale otro; la diferencia de precio la
  // paga o la recibe el cliente.
  // En ambos casos la venta original se marca `devuelta` para que deje de contar
  // en ingresos y ganancia, igual que una anulada, pero se conserva el registro.
  const doDevolver = () => {
    const {venta, modo, salida} = devM;
    if (!venta) return;
    if (modo==="cambio" && !salida) return t_("Elige qué se lleva el cliente","error");

    // 1) el producto devuelto vuelve al inventario
    const rep = reponerStock(prods, venta);
    let nuevosProds = rep.prods;

    // 2) si es cambio, sale el producto nuevo
    let salidaOk = true;
    if (modo==="cambio") {
      const sp = nuevosProds.find(p => p.id===salida.prod.id);
      const st = sp && sp.tallas.find(t => t.talla===salida.talla);
      if (!sp || !st || st.stock < 1) { salidaOk = false; }
      else {
        nuevosProds = nuevosProds.map(p => p.id!==sp.id ? p : {
          ...p, tallas: p.tallas.map(t => t.talla===salida.talla ? {...t, stock:t.stock-1} : t)
        });
      }
    }
    if (!salidaOk) return t_("Ese producto ya no tiene stock","error");
    setProds(nuevosProds);

    const ahora = new Date().toISOString();
    const precioSalida = modo==="cambio" ? (salida.prod.venta||0) : 0;
    const diferencia   = modo==="cambio" ? precioSalida - (venta.total||0) : 0;

    // 3) marcar la venta original y dejar el movimiento en Trazabilidad
    const marcada = hist.map(v => v.id!==venta.id ? v : {
      ...v, devuelta: modo, fechaDevolucion: ahora, devueltaPor: sesion,
      ...(rep.tallaRecreada?{tallaRecreada:true}:{}),
    });
    const registro = {
      id: Date.now(), tipo:"devolucion", subtipo:modo,
      ventaOriginalId: venta.id,
      prodId: venta.prodId, producto: venta.producto, sku: venta.sku,
      talla: venta.talla, sede: venta.sede, cantidad: venta.cantidad,
      montoDevuelto: venta.total||0,
      ...(modo==="cambio" ? {
        salidaProdId: salida.prod.id, salidaProducto: salida.prod.nombre,
        salidaSku: salida.prod.sku, salidaTalla: salida.talla,
        salidaPrecio: precioSalida, diferencia,
      } : {}),
      detalle: modo==="cambio"
        ? venta.producto+" "+tallaLbl(venta.talla)+" → "+salida.prod.nombre+" "+tallaLbl(salida.talla)
          + (diferencia===0 ? " · sin pago" : diferencia>0 ? " · paga S/"+diferencia.toFixed(0) : " · se devuelve S/"+Math.abs(diferencia).toFixed(0))
        : venta.producto+" "+tallaLbl(venta.talla)+" · se devolvió S/"+(venta.total||0).toFixed(0),
      responsable: sesion, fecha: ahora,
    };
    setHist([...marcada, registro]);
    setDevM(null);

    if (rep.tallaRecreada) t_("Registrado — se recreó la talla "+tallaLbl(venta.talla));
    else if (!rep.encontrado) t_("Registrado — el producto ya no existe, revisa el stock","error");
    else if (modo==="cambio") t_(diferencia===0 ? "Cambio registrado ✓" : diferencia>0 ? "Cambio ✓ — cobra S/"+diferencia.toFixed(0) : "Cambio ✓ — devuelve S/"+Math.abs(diferencia).toFixed(0));
    else t_("Reembolso registrado ✓");
  };

  const doArch = (id) => {
    const p = prods.find(x => x.id===id);
    if (!p.archivado && totalStock(p)>0) return t_("Solo puedes archivar modelos sin stock","error");
    if (p.archivado && limited) return setUpModal(true);
    setProds(prods.map(x => x.id===id ? {...x,archivado:!x.archivado} : x));
    t_(p.archivado?"Restaurado ✓":"Archivado ✓");
  };

  const openEdit = (p) => { setEditF({sku:p.sku, nombre:p.nombre, compra:String(ultCosto(p)), venta:String(p.venta), sede:p.sede||"", tallas:[...p.tallas]}); setConfDel(false); setEditM(p); };
  const saveEdit = () => {
    if (!editF.nombre||!editF.compra||!editF.venta) return t_("Faltan campos","error");
    if (prods.some(p => p.sku.toLowerCase()===editF.sku.toLowerCase() && p.id!==editM.id && (p.sede||"Principal").toLowerCase()===(editF.sede||"Principal").toLowerCase())) return t_("Código ya existe en esta sede","error");
    // Detect changes for traceability
    const cambios = [];
    const cambiosTexto = [];
    if (editM.nombre !== editF.nombre) { cambios.push({campo:"Nombre", antes:editM.nombre, despues:editF.nombre}); cambiosTexto.push('nombre: "'+editM.nombre+'" → "'+editF.nombre+'"'); }
    if (parseFloat(ultCosto(editM)) !== parseFloat(editF.compra)) { cambios.push({campo:"Precio compra", antes:"S/"+ultCosto(editM), despues:"S/"+editF.compra}); cambiosTexto.push("compra: S/"+ultCosto(editM)+" → S/"+editF.compra); }
    if (parseFloat(editM.venta) !== parseFloat(editF.venta)) { cambios.push({campo:"Precio venta", antes:"S/"+editM.venta, despues:"S/"+editF.venta}); cambiosTexto.push("venta: S/"+editM.venta+" → S/"+editF.venta); }
    // Editar resetea AMBOS: es la herramienta para decir "el costo real es este,
    // olvida el historial de promedios".
    setProds(prods.map(p => p.id!==editM.id ? p : {...p, sku:editF.sku.toUpperCase()||p.sku, nombre:editF.nombre, compra:parseFloat(editF.compra), ultimoCosto:parseFloat(editF.compra), venta:parseFloat(editF.venta), sede:editF.sede||p.sede, tallas:editF.tallas.length>0?editF.tallas:p.tallas}));
    // Log price/name changes to movements
    if (cambios.length > 0) {
      setHist([...hist, {
        id: Date.now(), tipo:"edicion",
        producto: editF.nombre, sku: editF.sku.toUpperCase()||editM.sku, sede: editF.sede||editM.sede,
        detalle: cambiosTexto.join(" · "), cambiosCampos: cambios,
        responsable: sesion,
        fecha: new Date().toISOString(),
      }]);
    }
    setEditM(null); t_("Actualizado ✓");
  };
  const delProd = (id) => { setProds(prods.filter(p => p.id!==id)); setEditM(null); setConfDel(false); t_("Eliminado"); };

  const doTransfer = (destSede, items, srcProd) => {
    const liveSource = prods.find(p => p.id === srcProd.id);
    if (!liveSource) return;
    const destExists = prods.some(p => p.sku===srcProd.sku && p.sede===destSede && p.id!==srcProd.id);
    let newProds = prods.map(p => {
      // Decrease source
      if (p.id === liveSource.id) {
        return {...p, tallas: p.tallas.map(t => {
          const c = parseInt(items[t.talla])||0;
          return c > 0 ? {...t, stock:Math.max(0,t.stock-c)} : t;
        })};
      }
      // Increase existing destination
      if (p.sku===srcProd.sku && p.sede===destSede) {
        const newT = p.tallas.map(t => { const c=parseInt(items[t.talla])||0; return c>0?{...t,stock:t.stock+c}:t; });
        Object.entries(items).forEach(([talla,cantStr]) => { const c=parseInt(cantStr)||0; if(c>0&&!newT.find(t=>t.talla===talla)) newT.push({talla,stock:c}); });
        return {...p, tallas:newT};
      }
      return p;
    });
    // Create new product at destination if it didn't exist
    if (!destExists) {
      const newTallas = liveSource.tallas.map(t => {
        const c = parseInt(items[t.talla])||0;
        return {...t, stock:c};
      }).filter(t => t.stock > 0);
      if (newTallas.length > 0) {
        newProds = [...newProds, {
          ...liveSource,
          id: Date.now(),
          sede: destSede,
          tallas: newTallas,
          fechaIngreso: new Date().toISOString(),
        }];
      }
    }
    setProds(newProds);
    // Build detail of what was transferred for traceability
    const detalleArr = [];
    const cambios = [];
    Object.entries(items).forEach(([talla,c]) => { if(parseInt(c)>0){ detalleArr.push(tallaLbl(talla)+" "+parseInt(c)+"u"); cambios.push({talla, cantidad:parseInt(c)}); } });
    setHist([...hist, {
      id: Date.now(), tipo:"traslado",
      producto: liveSource.nombre, sku: liveSource.sku, sede: liveSource.sede,
      detalle: detalleArr.join(", ")+" → "+destSede,
      cambios, origen: liveSource.sede, destino: destSede,
      cantidad: Object.values(items).reduce((a,v)=>a+(parseInt(v)||0),0),
      responsable: sesion,
      fecha: new Date().toISOString(),
    }]);
    setTransferM(null);
    t_("Traslado a "+destSede+" completado ✓");
  };

  const doAjuste = () => {
    if (!ajusteM.motivo) return;
    const delta = parseInt(ajusteM.delta) || 0;
    if (delta === 0) return;
    const {prod, tallaIdx} = ajusteM;
    // Always use live data from prods state (not stale modal reference)
    const liveProd = prods.find(p => p.id === prod.id);
    if (!liveProd) return;
    const talla = liveProd.tallas[tallaIdx];
    if (!talla) return;
    const nuevoStock = Math.max(0, talla.stock + delta);
    setProds(prods.map(p => p.id!==prod.id ? p : {
      ...p, tallas: p.tallas.map((t,i) => i===tallaIdx ? {...t, stock:nuevoStock} : t)
    }));
    setHist([...hist, {
      id: Date.now(),
      tipo: "ajuste", subtipo:"conteo",
      producto: liveProd.nombre,
      sku: liveProd.sku,
      talla: talla.talla,
      sede: liveProd.sede,
      detalle: tallaLbl(talla.talla)+" "+(delta>0?"+":"")+delta+"u",
      cambios: [{talla:talla.talla, delta, nueva:false}],
      cantidad: delta,
      motivo: ajusteM.motivo,
      stockAntes: talla.stock,
      stockDespues: nuevoStock,
      responsable: sesion,
      fecha: new Date().toISOString(),
    }]);
    setAjusteM(null);
    t_("Ajuste registrado ✓");
  };

  const doRestock = () => {
    if (!restockM) return;
    const {prod, cantidades, nuevoPrecio, nuevaVenta, nuevasTallas} = restockM;
    const liveProd = prods.find(p => p.id === prod.id);
    if (!liveProd) return;
    const totalExistentes = Object.values(cantidades).reduce((a,v) => a+(parseInt(v)||0), 0);
    const totalNuevas = nuevasTallas.reduce((a,t) => a+(t.stock||0), 0);
    if (totalExistentes + totalNuevas === 0) return t_("Ingresa al menos una unidad","error");
    const precioNuevo = parseFloat(nuevoPrecio);
    const ventaNueva  = parseFloat(nuevaVenta);
    setProds(prods.map(p => {
      if (p.id !== prod.id) return p;
      const stockPrevio = totalStock(p);   // ANTES de sumar las unidades nuevas
      const newTallas = p.tallas.map(t => {
        const c = parseInt(cantidades[t.talla])||0;
        return c > 0 ? {...t, stock:t.stock+c} : t;
      });
      // Add new tallas from restock
      nuevasTallas.forEach(nt => {
        if (nt.talla && nt.stock > 0 && !newTallas.find(t=>t.talla===nt.talla))
          newTallas.push({talla:nt.talla, stock:nt.stock});
      });
      return {...p, tallas:newTallas,
        compra: costoPromedio(stockPrevio, p.compra, totalExistentes+totalNuevas, precioNuevo),
        ultimoCosto: precioNuevo>0 ? precioNuevo : ultCosto(p),   // el tecleado, no el promedio
        venta:  ventaNueva>0  ? ventaNueva  : p.venta,
        fechaIngreso: new Date().toISOString()
      };
    }));
    // Build per-size breakdown for traceability
    const detalleArr = [];
    const cambios = [];
    Object.entries(cantidades).forEach(([talla,c]) => { if(parseInt(c)>0){ detalleArr.push(tallaLbl(talla)+" +"+parseInt(c)); cambios.push({talla, delta:parseInt(c), nueva:false}); } });
    nuevasTallas.forEach(nt => { if(nt.stock>0){ detalleArr.push(tallaLbl(nt.talla)+" +"+nt.stock+" (nuevo)"); cambios.push({talla:nt.talla, delta:nt.stock, nueva:true}); } });
    const detalle = detalleArr.join(", ");
    setHist([...hist, {
      id: Date.now(), tipo:"ajuste", subtipo:"restock",
      producto: liveProd.nombre, sku: liveProd.sku, sede: liveProd.sede,
      talla: "varios", detalle, cambios,
      precioCompra: precioNuevo>0?precioNuevo:null,
      precioVenta: ventaNueva>0?ventaNueva:null,
      cantidad: totalExistentes+totalNuevas,
      motivo: "Restock"+(precioNuevo>0?" · compra S/"+precioNuevo:"")+(ventaNueva>0?" · venta S/"+ventaNueva:""),
      stockAntes: totalStock(liveProd),
      stockDespues: totalStock(liveProd)+totalExistentes+totalNuevas,
      responsable: sesion,
      fecha: new Date().toISOString(),
    }]);
    setRestockM(null);
    t_("Restock registrado — +"+(totalExistentes+totalNuevas)+"u ✓");
  };

  // "✚ Sumar stock a este producto": camino alterno al restock, desde el form de
  // Agregar cuando el SKU ya existe en esa sede. Debe dejar el MISMO rastro que
  // doRestock — TrazaView los renderiza con la misma tarjeta.
  const doSumarStock = () => {
    if (!skuDupe) return;
    if (form.tallas.length === 0) return t_("Agrega al menos un tipo y cantidad","error");
    // producto vivo, no el snapshot capturado al detectar el duplicado
    const p = prods.find(x => x.id === skuDupe.id);
    if (!p) return;
    const compraNew = parseFloat(form.compra) || 0;
    const ventaNew  = parseFloat(form.venta)  || 0;

    const stockAntes = totalStock(p);

    const newTallas  = [...p.tallas];
    const cambios    = [];
    const detalleArr = [];
    let totalAgregado = 0;
    form.tallas.forEach(nt => {
      const ti = newTallas.findIndex(t => t.talla === nt.talla);
      const esNueva = ti < 0;
      if (esNueva) newTallas.push({...nt});
      else if (nt.stock > 0) newTallas[ti] = {...newTallas[ti], stock:newTallas[ti].stock + nt.stock};
      if (nt.stock > 0) {
        cambios.push({talla:nt.talla, delta:nt.stock, nueva:esNueva});
        detalleArr.push(tallaLbl(nt.talla)+" +"+nt.stock+(esNueva?" (nuevo)":""));
        totalAgregado += nt.stock;
      }
    });
    if (totalAgregado === 0) return t_("Ingresa al menos una unidad","error");

    setProds(prods.map(x => x.id!==p.id ? x : {...x, tallas:newTallas,
      compra: costoPromedio(stockAntes, x.compra, totalAgregado, compraNew),
      ultimoCosto: compraNew>0 ? compraNew : ultCosto(x),   // el tecleado, no el promedio
      venta:  ventaNew>0  ? ventaNew  : x.venta,
      fechaIngreso: new Date().toISOString()}));

    setHist([...hist, {
      id: Date.now(), tipo:"ajuste", subtipo:"restock",
      producto: p.nombre, sku: p.sku, sede: p.sede,
      talla: "varios", detalle: detalleArr.join(", "), cambios,
      precioCompra: compraNew>0?compraNew:null,
      precioVenta:  ventaNew>0?ventaNew:null,
      cantidad: totalAgregado,
      motivo: "Restock"+(compraNew>0?" · compra S/"+compraNew:"")+(ventaNew>0?" · venta S/"+ventaNew:""),
      stockAntes,
      stockDespues: stockAntes + totalAgregado,
      responsable: sesion,
      fecha: new Date().toISOString(),
    }]);

    setForm({sku:"",nombre:"",compra:"",venta:"",sede:"",tallas:[]});
    setSkuErr(""); setSkuDupe(null);
    t_("Stock sumado a "+p.nombre+" ✓");
    setVista("productos");
  };

  // Respaldo manual — protección temporal hasta migrar a Firebase
  const descargarRespaldo = () => {
    const data = {
      version: 2,   // v2 agrega egresos; los respaldos v1 se restauran igual
      exportado: new Date().toISOString(),
      prods, hist, plan, egresos,
    };
    const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = "BerroStock_Respaldo_"+HOY.toLocaleDateString("es-PE").replace(/\//g,"-")+".json";
    a.click();
    URL.revokeObjectURL(url);
    t_("Respaldo descargado ✓");
  };

  const restaurarRespaldo = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const d = JSON.parse(ev.target.result);
        if (!d.prods || !Array.isArray(d.prods)) return t_("Archivo de respaldo inválido","error");
        if (!window.confirm("Esto reemplazará TODOS los datos actuales ("+prods.length+" productos, "+hist.length+" movimientos, "+egresos.length+" gastos) por los del respaldo ("+d.prods.length+" productos, "+(d.hist||[]).length+" movimientos, "+(d.egresos||[]).length+" gastos). ¿Continuar?")) return;
        setProds(d.prods);
        setHist(d.hist||[]);
        // Un respaldo v1 no trae egresos: se restaura vacio en vez de dejar los
        // gastos del negocio anterior mezclados con el inventario restaurado.
        setEgresos(Array.isArray(d.egresos) ? d.egresos : []);
        if (d.plan) setPlan(d.plan);
        t_("Respaldo restaurado ✓");
      } catch(err) { t_("No se pudo leer el archivo","error"); }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const expExcel = (tipo, mes=MES, anio=ANIO) => {
    if (!pro) return setUpModal(true);
    // Solo ventas reales: los movimientos de inventario (restock, traslado,
    // edicion, devolucion) no traen `ganancia` y reventaban el .toFixed().
    const datos = (tipo==="dia" ? ventasHoy : hist.filter(v => { const d=new Date(v.fecha); return d.getMonth()===mes&&d.getFullYear()===anio; }))
                    .filter(esVentaReal);
    const tit   = tipo==="dia" ? ("Ventas_"+HOY.toLocaleDateString("es-PE").replace(/\//g,"-")) : ("Ventas_"+MESES[mes]+"_"+anio);
    const rows  = datos.map(v => ({"Código":v.sku,"Producto":v.producto,"Talla":v.talla,"Sede":v.sede||"—","Fecha":new Date(v.fecha).toLocaleDateString("es-PE"),"Cant":v.cantidad,"P.Orig":v.precioOriginal,"P.Venta":v.precioVenta,"Medio":medioPago(v.medio).label,"Total":v.total,"Ganancia":(v.ganancia||0).toFixed(2)}));
    rows.push({},{"Producto":"TOTAL","Cant":datos.reduce((a,v)=>a+(v.cantidad||0),0),"Total":datos.reduce((a,v)=>a+(v.total||0),0).toFixed(2),"Ganancia":datos.reduce((a,v)=>a+(v.ganancia||0),0).toFixed(2)});
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Ventas"); XLSX.writeFile(wb,tit+".xlsx");
    t_("Excel descargado ✓");
  };

  const expInv = () => {
    if (!pro) return setUpModal(true);
    const rows = [];
    activos.forEach(p => p.tallas.forEach(t => rows.push({"Código":p.sku,"Producto":p.nombre,"Sede":p.sede||"—","Talla":t.talla,"Stock":t.stock,"Compra":ultCosto(p),"Venta":p.venta,"Margen%":mg(ultCosto(p),p.venta),"Fecha Ingreso":fmtFecha(p.fechaIngreso)})));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Inventario"); XLSX.writeFile(wb,("Inventario_"+HOY.toLocaleDateString("es-PE").replace(/\//g,"-")+".xlsx"));
    t_("Inventario exportado ✓");
  };

  const handleFile = (e) => {
    const file = e.target.files[0]; if(!file) return;
    const ext  = file.name.split(".").pop().toLowerCase();
    const proc = (rawRows) => {
      if (!rawRows.length) return t_("Archivo vacío","error");
      const headers = Object.keys(rawRows[0]);
      const det = (al) => headers.find(h => al.some(a => h.toLowerCase().includes(a)))||null;
      setImpMod({rows:rawRows, headers, fase:"mapeo", modoImport:null, items:null, conflictos:[], colMap:{sku:det(["sku","codigo","cod","ref"]), nombre:det(["nombre","producto","name"]), talla:det(["talla","size","talle"]), stock:det(["stock","cantidad","qty"]), compra:det(["compra","costo","cost"]), venta:det(["venta","precio","price","pvp"]), sede:det(["sede","tienda","local","ubicacion"])}});
    };
    const r = new FileReader();
    if (ext==="csv") { r.onload=(ev)=>{ const lines=ev.target.result.trim().split("\n"); const hds=lines[0].split(",").map(h=>h.trim().replace(/"/g,"")); const rows=lines.slice(1).map(l=>{const v=l.split(",").map(x=>x.trim().replace(/"/g,""));const o={};hds.forEach((h,i)=>o[h]=v[i]||"");return o;}).filter(rw=>Object.values(rw).some(x=>x)); proc(rows); }; r.readAsText(file); }
    else { r.onload=(ev)=>{ const wb=XLSX.read(ev.target.result,{type:"array"}); proc(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""})); }; r.readAsArrayBuffer(file); }
    e.target.value = "";
  };

  // mapeo -> consolida el archivo y decide si hace falta resolver conflictos
  const avanzarMapeo = () => {
    if (!impMod.colMap.nombre) return t_("Necesitas mapear la columna nombre","error");
    if (!impMod.modoImport)    return t_("Elige qué contiene el archivo","error");
    const {items, conflictos} = consolidarImport(impMod.rows, impMod.colMap);
    if (!items.length) return t_("No se encontraron productos con nombre","error");
    setImpMod({...impMod, items, conflictos, fase: conflictos.length ? "conflictos" : "confirmar"});
  };
  const setConflicto = (i, patch) =>
    setImpMod(m => ({...m, conflictos:m.conflictos.map((c,j) => j===i ? {...c,...patch} : c)}));

  // precio final de un item: lo que la usuaria eligio en la ventana de conflictos,
  // o el unico valor que traia el archivo si no hubo conflicto.
  const precioResuelto = (it, campo, conflictos) => {
    const c = (conflictos||[]).find(x => x.key===it.key && x.campo===campo);
    if (!c) return it[campo];
    return c.elegido==="otro" ? (parseFloat(c.otro)||0) : (c.elegido||0);
  };

  // Resumen para la pantalla de confirmacion: que se crea, que se actualiza,
  // que cambia de precio, y que productos de la app NO vienen en el archivo.
  const resumenImport = () => {
    if (!impMod?.items) return null;
    const {items, conflictos} = impMod;
    const nuevos=[], actualizados=[], cambiosPrecio=[];
    items.forEach(it => {
      const ex = prods.find(x => x.sku===it.sku && x.sede===it.sede);
      if (!ex) { nuevos.push(it); return; }
      actualizados.push(it);
      const cReal = precioResuelto(it, "compra", conflictos);
      if (cReal>0 && parseFloat(ultCosto(ex))!==cReal)
        cambiosPrecio.push({sku:it.sku, nombre:it.nombre, antes:ultCosto(ex), despues:cReal});
    });
    const ausentes = prods.filter(p => !items.some(it => it.sku===p.sku && it.sede===p.sede));
    return {nuevos, actualizados, cambiosPrecio, ausentes};
  };

  const doImport = () => {
    const {items, conflictos, modoImport} = impMod;
    const reemplazar = modoImport === "reemplazar";

    let u = [...prods];
    const nuevos = [];

    items.forEach((it,i) => {
      const compraReal = precioResuelto(it, "compra", conflictos);
      const ventaReal  = precioResuelto(it, "venta",  conflictos);
      const unidades   = it.tallas.reduce((a,t)=>a+t.stock,0);
      const idx = u.findIndex(x => x.sku===it.sku && x.sede===it.sede);

      if (idx < 0) {
        // producto nuevo: compra y ultimoCosto arrancan iguales, igual que addProd
        nuevos.push({id:Date.now()+i, sku:it.sku, nombre:it.nombre, sede:it.sede,
          compra:compraReal, ultimoCosto:compraReal, venta:ventaReal,
          archivado:false, tallas:it.tallas, fechaIngreso:new Date().toISOString()});
        return;
      }

      const ex = u[idx];
      if (reemplazar) {
        // RAMA A — el archivo es su inventario declarado: el stock se reemplaza y
        // el costo se resetea sin promediar (mismo criterio que saveEdit).
        u[idx] = {...ex, nombre:it.nombre||ex.nombre, tallas:it.tallas,
          compra:      compraReal>0 ? compraReal : ex.compra,
          ultimoCosto: compraReal>0 ? compraReal : ultCosto(ex),
          venta:       ventaReal>0  ? ventaReal  : ex.venta,
          fechaIngreso:new Date().toISOString()};
      } else {
        // RAMA B — mercaderia que llega: el stock se suma y el costo se promedia
        // contra lo que ya habia. stockPrevio se mide ANTES de fusionar tallas.
        const stockPrevio = totalStock(ex);
        const newTallas = [...ex.tallas];
        it.tallas.forEach(nt => {
          const ti = newTallas.findIndex(t => t.talla===nt.talla);
          if (ti>=0) newTallas[ti] = {...newTallas[ti], stock:newTallas[ti].stock+nt.stock};
          else newTallas.push({...nt});
        });
        u[idx] = {...ex, tallas:newTallas,
          compra:      costoPromedio(stockPrevio, ex.compra, unidades, compraReal),
          ultimoCosto: compraReal>0 ? compraReal : ultCosto(ex),
          venta:       ventaReal>0  ? ventaReal  : ex.venta,
          fechaIngreso:new Date().toISOString()};
      }
      // id y archivado nunca se pisan: salen de {...ex} y el archivo no los toca
    });

    const cupo = pro ? Infinity : Math.max(0, PLAN_MAX-activos.length);
    const entran = nuevos.slice(0, cupo);
    setProds([...u, ...entran]);
    setImpMod(null);
    t_(entran.length+" nuevos"+(items.length-nuevos.length>0 ? ", "+(items.length-nuevos.length)+" actualizados" : "")+" ✓");
    setVista("productos");
  };

  // Sub-vistas: pantallas completas que tapan la vista actual (Trazabilidad,
  // Egresos). Se agrupan para que agregar una nueva no obligue a tocar 7 guardas.
  const subv = verTraza || verEgresos;
  const cerrarSubv = () => { setVerTraza(false); setVerEgresos(false); };

  const navAdmin = [{id:"dashboard",icon:"⊞",label:"Inicio"},{id:"productos",icon:"◫",label:"Stock"},{id:"ventas-hoy",icon:"○",label:"Hoy"},{id:"historial",icon:"◷",label:"Historial"},{id:"agregar",icon:"+",label:"Agregar"}];
  const navVend  = [{id:"productos",icon:"◫",label:"Stock"},{id:"ventas-hoy",icon:"○",label:"Mis ventas"}];
  const navItems = isAdmin ? navAdmin : navVend;

  if (!sesion) return <LoginScreen onLogin={handleLogin} pines={pines}/>;

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'DM Sans',system-ui,sans-serif",color:C.txt,...(isDesktop?{marginLeft:220}:{maxWidth:420,margin:"0 auto",paddingBottom:88})}}>
      <style>{"*{-webkit-tap-highlight-color:transparent} @keyframes toastIn{from{opacity:0;transform:translateX(-50%) scale(0.95)}to{opacity:1;transform:translateX(-50%) scale(1)}} input:focus{outline:none;border-color:"+C.pr+"!important;box-shadow:0 0 0 3px "+C.prBg+";}"}</style>

      {/* SIDEBAR — desktop only */}
      {isDesktop && (
        <div style={{position:"fixed",top:0,left:0,bottom:0,width:220,background:C.card,borderRight:"1px solid "+C.border,display:"flex",flexDirection:"column",zIndex:60,boxShadow:"2px 0 12px rgba(0,0,0,0.04)"}}>
          <div style={{padding:"20px 16px 16px",borderBottom:"1px solid "+C.border}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
              <img src="/logo-128.png" alt="" width="32" height="32" style={{display:"block",width:32,height:32,objectFit:"contain",flexShrink:0}}/>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,letterSpacing:-0.5,color:BRAND.tinta}}>Berro<span style={{color:BRAND.verdeDk}}>Stock</span></div>
            </div>
            <div style={{fontSize:11,color:C.muted,fontWeight:500,paddingLeft:42}}>{isAdmin?"Dueña / Admin":"Vendedora"}</div>
          </div>
          <div style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
            {navItems.map(({id,icon,label}) => (
              <button key={id} onClick={() => { setVista(id); cerrarSubv(); }}
                style={{width:"100%",background:vista===id&&!subv?C.prBg:"transparent",border:"none",cursor:"pointer",padding:"11px 14px",borderRadius:12,display:"flex",alignItems:"center",gap:12,marginBottom:3,textAlign:"left",transition:"background 0.15s"}}>
                <span style={{fontSize:20,lineHeight:1}}>{icon}</span>
                <span style={{fontSize:13,fontWeight:vista===id?700:500,color:vista===id?C.pr:C.txt}}>{label}</span>
              </button>
            ))}
          </div>
          <div style={{padding:"12px 8px",borderTop:"1px solid "+C.border,display:"flex",flexDirection:"column",gap:6}}>
            {isAdmin && <button onClick={() => setPinsMod(true)} style={{background:C.muted2,border:"1px solid "+C.border,borderRadius:10,padding:"9px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:12,color:C.muted,textAlign:"left",display:"flex",alignItems:"center",gap:8}}><Ico n="engranaje" s={14}/>Configuración PINs</button>}
            {isAdmin && <button onClick={() => setUpModal(true)} style={{background:plan==="pro"?C.puBg:plan==="trial"?C.grBg:C.muted2,border:"1px solid "+(plan==="pro"?C.pu:plan==="trial"?C.gr:C.border),borderRadius:10,padding:"9px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:12,color:plan==="pro"?C.pu:plan==="trial"?C.gr:C.muted,textAlign:"left",display:"flex",alignItems:"center",gap:8}}>{plan==="pro"?"✦ PRO":plan==="trial"?"▷ TRIAL":"FREE"} · Plan actual</button>}
            <button onClick={() => setSesion(null)} style={{background:C.muted2,border:"1px solid "+C.border,borderRadius:10,padding:"9px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:12,color:C.muted,textAlign:"left",display:"flex",alignItems:"center",gap:8}}>↩ Cerrar sesión</button>
          </div>
        </div>
      )}

      {/* HEADER */}
      {!isDesktop && <div style={{background:C.card,padding:"14px 20px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <img src="/logo-128.png" alt="" width="32" height="32" style={{display:"block",width:32,height:32,objectFit:"contain",flexShrink:0}}/>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,letterSpacing:-0.5,lineHeight:1,color:BRAND.tinta}}>Berro<span style={{color:BRAND.verdeDk}}>Stock</span></div>
            <div style={{fontSize:10,color:C.muted,fontWeight:500}}>{isAdmin?"Dueña":"Vendedora"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isAdmin && <button onClick={() => setPinsMod(true)} style={{background:C.muted2,border:"1px solid "+C.border,borderRadius:8,padding:"7px",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted}}><Ico n="engranaje" s={15}/></button>}
          {isAdmin && <button onClick={() => setUpModal(true)} style={{background:plan==="pro"?C.puBg:plan==="trial"?C.grBg:C.muted2,border:"1.5px solid "+(plan==="pro"?C.pu:plan==="trial"?C.gr:C.border),color:plan==="pro"?C.pu:plan==="trial"?C.gr:C.muted,borderRadius:20,padding:"5px 12px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{plan==="pro"?"✦ PRO":plan==="trial"?"▷ TRIAL":"FREE"}</button>}
          <button onClick={() => setSesion(null)} style={{background:C.muted2,border:"1px solid "+C.border,borderRadius:8,padding:"5px 10px",fontSize:12,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Salir</button>
        </div>
      </div>

      }
      {/* AVISO DE GUARDADO FALLIDO — barra fija, no se puede ignorar.
          Sin esto la usuaria sigue vendiendo creyendo que se guarda todo. */}
      {errGuardado && (
        <div style={{position:"fixed",left:0,right:0,bottom:0,background:C.re,color:"#fff",zIndex:1000,
          padding:isDesktop?"14px 24px":"12px 16px",boxShadow:"0 -4px 16px rgba(0,0,0,0.2)",
          display:"flex",alignItems:"center",gap:12,flexWrap:"wrap",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0,flex:1}}>
            <Ico n="alerta" s={20}/>
            <div style={{minWidth:0}}>
              <div style={{fontSize:13,fontWeight:700}}>No se pudo guardar</div>
              <div style={{fontSize:12,opacity:0.92}}>El navegador se quedó sin espacio. Descarga un respaldo ahora — si cierras la app, perderás lo último que registraste.</div>
            </div>
          </div>
          <button onClick={descargarRespaldo}
            style={{background:"#fff",color:C.re,border:"none",borderRadius:10,padding:"10px 18px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
            Descargar respaldo
          </button>
        </div>
      )}

      {/* TOAST */}
      {toast && <div style={{position:"fixed",top:76,left:"50%",transform:"translateX(-50%)",background:toast.tipo==="error"?C.re:C.gr,color:"#fff",padding:"10px 20px",borderRadius:24,fontSize:13,fontWeight:600,zIndex:999,whiteSpace:"nowrap",boxShadow:shMd,animation:"toastIn 0.2s ease"}}>{toast.tipo==="error"?"✕ ":"✓ "}{toast.msg}</div>}

      {/* MODALS */}
      {vm         && <VentaModal vm={vm} cant={cant} setCant={setCant} isAdmin={isAdmin} onConfirm={doVenta} onClose={() => { setVm(null); setCant(1); }}/>}
      {devM       && <DevolucionModal dev={devM} prods={activos} onSet={setDevM} onConfirm={doDevolver} onClose={() => setDevM(null)} isDesktop={isDesktop}/>}
      {editM      && <EditModal  editM={editM} editF={editF} setEditF={setEditF} confDel={confDel} setConfDel={setConfDel} onSave={saveEdit} onDelete={delProd} onClose={() => setEditM(null)}/>}
      {transferM  && <TransferModal transferM={transferM} setTransferM={setTransferM} prods={prods} onTransfer={doTransfer}/>}

      {/* AJUSTE MODAL */}
      {/* RESTOCK MODAL */}
      {restockM && (
        <Sheet>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>✚ Restock</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:4,display:"flex",alignItems:"center",gap:6}}><Ico n="calendario" s={13}/><span>{HOY.toLocaleDateString("es-PE",{day:"numeric",month:"long",year:"numeric"})} · {restockM.prod.nombre}</span></div>
          <div style={{fontSize:11,color:C.gr,marginBottom:16}}>Se registra automáticamente con la fecha de hoy.</div>

          <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:10}}>¿Cuántas unidades llegaron por tipo?</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {restockM.prod.tallas.map(t => (
              <div key={t.talla} style={{display:"flex",alignItems:"center",gap:12,background:C.muted2,borderRadius:12,padding:"12px 14px"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700}}>{tallaLbl(t.talla)}</div>
                  <div style={{fontSize:11,color:C.muted}}>Stock actual: {t.stock}u</div>
                </div>
                <button onClick={() => setRestockM({...restockM, cantidades:{...restockM.cantidades,[t.talla]:String(Math.max(0,(parseInt(restockM.cantidades[t.talla])||0)-1))}})}
                  style={{width:36,height:36,borderRadius:10,background:C.card,border:"1px solid "+C.border,fontSize:18,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
                <div style={{width:36,textAlign:"center",fontSize:20,fontWeight:700,color:(parseInt(restockM.cantidades[t.talla])||0)>0?C.gr:C.muted}}>
                  {restockM.cantidades[t.talla]||"0"}
                </div>
                <button onClick={() => setRestockM({...restockM, cantidades:{...restockM.cantidades,[t.talla]:String((parseInt(restockM.cantidades[t.talla])||0)+1)}})}
                  style={{width:36,height:36,borderRadius:10,background:C.pr,border:"none",fontSize:18,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
              </div>
            ))}
          </div>

          {/* New tallas */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:8}}>¿Llegan tallas nuevas? <span style={{fontWeight:400}}>(opcional)</span></div>
            {restockM.nuevasTallas.map((t,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:C.muted2,borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                <div style={{width:80,fontSize:13,fontWeight:700,color:C.gr}}>{tallaLbl(t.talla)}</div>
                <button onClick={() => setRestockM({...restockM,nuevasTallas:restockM.nuevasTallas.map((x,j)=>j===i?{...x,stock:Math.max(0,x.stock-1)}:x)})}
                  style={{width:32,height:32,borderRadius:8,background:C.card,border:"1px solid "+C.border,fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
                <div style={{width:32,textAlign:"center",fontSize:18,fontWeight:700,color:t.stock>0?C.gr:C.muted}}>{t.stock}</div>
                <button onClick={() => setRestockM({...restockM,nuevasTallas:restockM.nuevasTallas.map((x,j)=>j===i?{...x,stock:x.stock+1}:x)})}
                  style={{width:32,height:32,borderRadius:8,background:C.pr,border:"none",fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
                <button onClick={() => setRestockM({...restockM,nuevasTallas:restockM.nuevasTallas.filter((_,j)=>j!==i)})}
                  style={{width:32,height:32,borderRadius:8,background:C.reBg,border:"1px solid #FCA5A5",fontSize:14,cursor:"pointer",fontFamily:"inherit",color:C.re,marginLeft:"auto"}}>✕</button>
              </div>
            ))}
            <div style={{display:"flex",gap:8}}>
              <input placeholder="Ej: XL, 42, Verde..." value={restockM._newTipo||""}
                onChange={e => setRestockM({...restockM,_newTipo:e.target.value.toUpperCase()})}
                onKeyDown={e => {
                  if(e.key==="Enter"&&restockM._newTipo?.trim()) {
                    const t=restockM._newTipo.trim();
                    if(!restockM.prod.tallas.find(x=>x.talla===t)&&!restockM.nuevasTallas.find(x=>x.talla===t))
                      setRestockM({...restockM,nuevasTallas:[...restockM.nuevasTallas,{talla:t,stock:1}],_newTipo:""});
                  }
                }}
                style={{flex:1,background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"9px 12px",color:C.txt,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
              <button onClick={() => {
                const t=restockM._newTipo?.trim();
                if(t&&!restockM.prod.tallas.find(x=>x.talla===t)&&!restockM.nuevasTallas.find(x=>x.talla===t))
                  setRestockM({...restockM,nuevasTallas:[...restockM.nuevasTallas,{talla:t,stock:1}],_newTipo:""});
              }} style={{background:C.pr,color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar</button>
            </div>
          </div>

          {/* Precios */}
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            {/* compra sin indicador ↑/↓: prod.compra es el promedio ponderado, un
                numero que la usuaria nunca pago. Comparar contra el confundiria.
                venta si compara — ahi el precio vigente de etiqueta es uno solo. */}
            {[{label:"Precio de compra",key:"nuevoPrecio",prev:restockM.prod.compra,ph:"Costo de este lote",cmp:false},
              {label:"Precio de venta ref.",key:"nuevaVenta",prev:restockM.prod.venta,ph:String(restockM.prod.venta),cmp:true}].map(f => (
              <div key={f.key} style={{flex:1}}>
                <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:6}}>{f.label} <span style={{fontWeight:400}}>(opcional)</span></div>
                <div style={{background:C.muted2,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:12,color:C.muted}}>S/</span>
                  <input type="number" placeholder={f.ph} value={restockM[f.key]}
                    onChange={e => setRestockM({...restockM,[f.key]:e.target.value})}
                    style={{flex:1,background:"transparent",border:"none",color:C.txt,fontSize:15,fontWeight:600,outline:"none",fontFamily:"inherit"}}/>
                </div>
                {f.cmp && restockM[f.key] && parseFloat(restockM[f.key])!==f.prev && (
                  <div style={{fontSize:10,color:parseFloat(restockM[f.key])>f.prev?C.or:C.gr,marginTop:3}}>
                    {parseFloat(restockM[f.key])>f.prev?"↑ Subió":"↓ Bajó"} de S/{f.prev}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:10}}>
            <Btn onClick={() => setRestockM(null)} v="secondary">Cancelar</Btn>
            <Btn onClick={doRestock} full>Confirmar restock</Btn>
          </div>
        </Sheet>
      )}

      {/* "···" MORE OPTIONS SHEET */}
      {masOpcM && (
        <Sheet>
          <div style={{fontSize:11,color:C.muted,marginBottom:4}}>{masOpcM.sku} · {masOpcM.sede}</div>
          <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>{masOpcM.nombre}</div>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={() => { openEdit(masOpcM); setMasOpcM(null); }}
              style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:40,height:40,background:C.muted2,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:C.txt}}><Ico n="lapiz" s={19}/></div>
              <div><div style={{fontSize:14,fontWeight:600}}>Editar</div><div style={{fontSize:12,color:C.muted,marginTop:1}}>Cambiar nombre, precio de venta o precio de compra</div></div>
            </button>
            <button onClick={() => { setAjusteM({prod:masOpcM, tallaIdx:masOpcM.tallas.reduce((mi,t,i,arr)=>t.stock<arr[mi].stock?i:mi,0), delta:"", motivo:""}); setMasOpcM(null); }}
              style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:40,height:40,background:C.muted2,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:C.txt}}><Ico n="portapapeles" s={19}/></div>
              <div><div style={{fontSize:14,fontWeight:600}}>Corrección de conteo</div><div style={{fontSize:12,color:C.muted,marginTop:1}}>El número físico no coincide con el sistema</div></div>
            </button>
            <button onClick={() => { setTransferM({srcProd:masOpcM}); setMasOpcM(null); }}
              style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:40,height:40,background:C.muted2,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:C.txt}}><Ico n="traslado" s={19}/></div>
              <div><div style={{fontSize:14,fontWeight:600}}>Trasladar</div><div style={{fontSize:12,color:C.muted,marginTop:1}}>Mover unidades de otra ubicación a esta</div></div>
            </button>
            {totalStock(masOpcM)===0 && (
              <button onClick={() => { doArch(masOpcM.id); setMasOpcM(null); }}
                style={{background:C.reBg,border:"1px solid #FCA5A5",borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:40,height:40,background:"#FEE2E2",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",color:C.re}}><Ico n="archivo" s={19}/></div>
                <div><div style={{fontSize:14,fontWeight:600,color:C.re}}>Archivar</div><div style={{fontSize:12,color:C.re,opacity:0.7,marginTop:1}}>Ocultar producto sin stock</div></div>
              </button>
            )}
          </div>
          <button onClick={() => setMasOpcM(null)} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:"12px 0",marginTop:8}}>Cancelar</button>
        </Sheet>
      )}

      {ajusteM && (
        <Sheet>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4,display:"flex",alignItems:"center",gap:8}}><Ico n="portapapeles" s={17}/>Ajuste de inventario</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:16}}>Queda registrado con fecha, hora y motivo.</div>
          <div style={{background:C.muted2,borderRadius:12,padding:"12px 16px",marginBottom:16}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{ajusteM.prod.sku} · {ajusteM.prod.sede}</div>
            <div style={{fontSize:15,fontWeight:700}}>{ajusteM.prod.nombre}</div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>¿Qué tipo ajustas?</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {(prods.find(p=>p.id===ajusteM.prod.id)||ajusteM.prod).tallas.map((t,i) => (
                <button key={t.talla} onClick={() => setAjusteM({...ajusteM, tallaIdx:i, delta:""})}
                  style={{padding:"8px 16px",borderRadius:10,border:"2px solid "+(ajusteM.tallaIdx===i?C.gr:C.border),background:ajusteM.tallaIdx===i?C.grBg:C.card,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                  <div style={{fontSize:14,fontWeight:700,color:ajusteM.tallaIdx===i?C.gr:C.txt}}>{tallaLbl(t.talla)}</div>
                  <div style={{fontSize:11,color:C.muted}}>{t.stock}u</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>¿Cuántas unidades corriges? (usa − para reducir)</div>
            <div style={{display:"flex",gap:8,alignItems:"center",background:C.muted2,borderRadius:12,padding:"8px 12px"}}>
              <button onClick={() => setAjusteM({...ajusteM,delta:String((parseInt(ajusteM.delta)||0)-1)})}
                style={{width:40,height:40,borderRadius:10,background:C.card,border:"1px solid "+C.border,fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:C.re}}>−</button>
              <div style={{flex:1,textAlign:"center"}}>
                <div style={{fontSize:28,fontWeight:700,color:(parseInt(ajusteM.delta)||0)>0?C.gr:(parseInt(ajusteM.delta)||0)<0?C.re:C.muted}}>
                  {(parseInt(ajusteM.delta)||0)>0?"+":""}{ajusteM.delta||"0"}
                </div>
                <div style={{fontSize:11,color:C.muted}}>
                  Stock resultante: <b style={{color:C.txt}}>{Math.max(0,((prods.find(p=>p.id===ajusteM.prod.id)||ajusteM.prod).tallas[ajusteM.tallaIdx]?.stock||0)+(parseInt(ajusteM.delta)||0))}u</b>
                </div>
              </div>
              <button onClick={() => setAjusteM({...ajusteM,delta:String((parseInt(ajusteM.delta)||0)+1)})}
                style={{width:40,height:40,borderRadius:10,background:C.pr,border:"none",fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
            </div>
          </div>

          <div style={{marginBottom:20}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>Motivo del ajuste <span style={{color:C.re}}>*</span></div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {["Conteo físico","Producto dañado","Pérdida / robo","Corrección de error","Otro"].map(m => (
                <button key={m} onClick={() => setAjusteM({...ajusteM,motivo:m})}
                  style={{padding:"10px 14px",borderRadius:10,border:"1.5px solid "+(ajusteM.motivo===m?C.gr:C.border),background:ajusteM.motivo===m?C.grBg:C.card,cursor:"pointer",fontFamily:"inherit",textAlign:"left",fontSize:13,fontWeight:ajusteM.motivo===m?600:400,color:ajusteM.motivo===m?C.gr:C.txt,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  {m}{ajusteM.motivo===m&&<span>✓</span>}
                </button>
              ))}
            </div>
          </div>

          <div style={{display:"flex",gap:10}}>
            <Btn onClick={() => setAjusteM(null)} v="secondary">Cancelar</Btn>
            <Btn onClick={doAjuste} full disabled={!ajusteM.motivo||(parseInt(ajusteM.delta)||0)===0}>
              {!ajusteM.motivo?"Elige un motivo":((parseInt(ajusteM.delta)||0)===0?"Ingresa una cantidad":"Confirmar ajuste")}
            </Btn>
          </div>
        </Sheet>
      )}

      {/* ESCANER — el codigo leido pasa por la misma deteccion de duplicados que
          el tecleo a mano, asi que si el producto ya existe se avisa al instante */}
      {scanM && (
        <ScannerModal
          onClose={() => setScanM(false)}
          onDetect={(cod) => {
            const v = cod.toUpperCase();
            setScanM(false);
            setForm(ff => ({...ff, sku:v}));
            aplicarDupe(v, form.sede);
          }}
        />
      )}

      {/* IMPORT MODAL */}
      {impMod && (
        <Sheet>
          {impMod.fase==="mapeo" && (<>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Importar productos</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:16}}>{impMod.rows.length} filas detectadas</div>
          {["sku","nombre","talla","stock","compra","venta","sede"].map(field => (
            <div key={field} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+C.border}}>
              <div style={{fontSize:13,color:field==="nombre"?C.txt:C.muted,fontWeight:field==="nombre"?600:400}}>{field}{field==="nombre"&&" *"}</div>
              <select value={impMod.colMap[field]||""} onChange={e => setImpMod({...impMod,colMap:{...impMod.colMap,[field]:e.target.value||null}})}
                style={{background:C.muted2,border:"1px solid "+C.border,color:C.txt,borderRadius:8,padding:"4px 8px",fontSize:12,fontFamily:"inherit"}}>
                <option value="">— no mapear —</option>
                {impMod.headers.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
          {/* Que contiene el archivo — sin preseleccion, que elija conscientemente */}
          <div style={{marginTop:18}}>
            <div style={{fontSize:13,color:C.txt,fontWeight:600,marginBottom:10}}>¿Qué contiene este archivo?</div>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {v:"reemplazar", label:"Es mi inventario actualizado",
                 sub:"Las cantidades del Excel reemplazan las que tienes en la app. Los productos que no aparezcan en el archivo quedan como están."},
                {v:"sumar", label:"Es mercadería que acaba de llegar",
                 sub:"Las cantidades del Excel se suman a tu stock actual."},
              ].map(op => {
                const sel = impMod.modoImport===op.v;
                return (
                  <button key={op.v} onClick={() => setImpMod({...impMod, modoImport:op.v})}
                    style={{padding:"14px 16px",borderRadius:12,border:"2px solid "+(sel?C.pr:C.border),background:sel?C.prBg:C.card,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"flex-start",gap:12,transition:"all 0.15s"}}>
                    <div style={{width:18,height:18,borderRadius:"50%",border:"2px solid "+(sel?C.pr:C.border),flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {sel && <div style={{width:9,height:9,borderRadius:"50%",background:C.pr}}/>}
                    </div>
                    <div>
                      <div style={{fontSize:14,fontWeight:700,color:sel?C.pr:C.txt}}>{op.label}</div>
                      <div style={{fontSize:11,color:C.muted,marginTop:3,lineHeight:1.5}}>{op.sub}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {!pro && <div style={{fontSize:12,color:C.or,margin:"12px 0"}}>Plan Free: máx. {Math.max(0,PLAN_MAX-activos.length)} SKUs importables.</div>}
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <Btn onClick={() => setImpMod(null)} v="secondary">Cancelar</Btn>
            <Btn onClick={avanzarMapeo} full disabled={!impMod.modoImport||!impMod.colMap.nombre}>
              {!impMod.colMap.nombre ? "Mapea la columna nombre" : (!impMod.modoImport ? "Elige qué contiene" : "Continuar")}
            </Btn>
          </div>
          </>)}

          {/* FASE CONFLICTOS — solo si el archivo trae precios contradictorios */}
          {impMod.fase==="conflictos" && (() => {
            const listos = impMod.conflictos.every(c => c.elegido!=null && (c.elegido!=="otro" || parseFloat(c.otro)>0));
            return (<>
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Precios en conflicto</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:16,lineHeight:1.5}}>
                {impMod.conflictos.length} {impMod.conflictos.length===1?"producto aparece":"productos aparecen"} con más de un precio en tu archivo. Elige cuál es el correcto:
              </div>
              <div style={{maxHeight:"46vh",overflowY:"auto",marginBottom:16}}>
                {impMod.conflictos.map((c,i) => (
                  <div key={c.key+c.campo} style={{padding:"14px 0",borderTop:i>0?"1px solid "+C.border:"none"}}>
                    <div style={{fontSize:14,fontWeight:700,marginBottom:2}}>{c.nombre}</div>
                    <div style={{fontSize:11,color:C.muted,marginBottom:10}}>{c.ctx} · {c.label}</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
                      {c.opciones.map(op => {
                        const sel = c.elegido===op;
                        return (
                          <button key={op} onClick={() => setConflicto(i,{elegido:op})}
                            style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(sel?C.pr:C.border),background:sel?C.pr:C.card,color:sel?"#fff":C.txt,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>
                            S/{op}
                          </button>
                        );
                      })}
                      <button onClick={() => setConflicto(i,{elegido:"otro"})}
                        style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(c.elegido==="otro"?C.pr:C.border),background:c.elegido==="otro"?C.prBg:C.card,color:c.elegido==="otro"?C.pr:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>
                        Otro
                      </button>
                      {c.elegido==="otro" && (
                        <input type="number" autoFocus value={c.otro} placeholder="S/"
                          onChange={e => setConflicto(i,{otro:e.target.value})}
                          style={{width:90,background:C.card,border:"1.5px solid "+C.pr,borderRadius:10,padding:"7px 10px",color:C.txt,fontSize:13,fontWeight:600,outline:"none",fontFamily:"inherit"}}/>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",gap:10}}>
                <Btn onClick={() => setImpMod(null)} v="secondary">Cancelar</Btn>
                <Btn onClick={() => setImpMod({...impMod, fase:"confirmar"})} full disabled={!listos}>
                  {listos ? "Continuar importación" : "Elige todos los precios"}
                </Btn>
              </div>
            </>);
          })()}

          {/* FASE CONFIRMAR — que se va a hacer, antes de aplicarlo */}
          {impMod.fase==="confirmar" && (() => {
            const r = resumenImport();
            if (!r) return null;
            return (<>
              <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Confirmar importación</div>
              <div style={{fontSize:13,color:C.muted,marginBottom:16}}>
                {impMod.modoImport==="reemplazar" ? "Las cantidades del Excel reemplazan las de la app." : "Las cantidades del Excel se suman a tu stock."}
              </div>
              <div style={{background:C.muted2,borderRadius:12,padding:"14px 16px",marginBottom:12}}>
                <div style={{fontSize:13,color:C.txt,fontWeight:600}}>
                  Se {r.actualizados.length===1?"actualizará":"actualizarán"} {r.actualizados.length} {r.actualizados.length===1?"producto":"productos"}, se {r.nuevos.length===1?"creará":"crearán"} {r.nuevos.length} {r.nuevos.length===1?"nuevo":"nuevos"}.
                </div>
                {r.ausentes.length>0 && (
                  <div style={{fontSize:12,color:C.muted,marginTop:6,lineHeight:1.5}}>
                    {r.ausentes.length} {r.ausentes.length===1?"producto de tu app no está":"productos de tu app no están"} en este archivo — no se {r.ausentes.length===1?"modificará":"modificarán"}.
                  </div>
                )}
              </div>
              {r.cambiosPrecio.length>0 && (
                <div style={{background:C.yeBg,border:"1px solid "+C.orLt,borderRadius:12,padding:"12px 14px",marginBottom:16}}>
                  <div style={{fontSize:12,color:C.ye,fontWeight:700,marginBottom:8,display:"flex",alignItems:"center",gap:5}}>
                    <Ico n="alerta" s={13}/>{r.cambiosPrecio.length} {r.cambiosPrecio.length===1?"producto cambia":"productos cambian"} de precio de compra
                  </div>
                  <div style={{maxHeight:"26vh",overflowY:"auto"}}>
                    {r.cambiosPrecio.map(c => (
                      <div key={c.sku} style={{display:"flex",justifyContent:"space-between",gap:10,fontSize:12,padding:"3px 0"}}>
                        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                          <b style={{color:C.txt}}>{c.sku}</b> <span style={{color:C.muted}}>{c.nombre}</span>
                        </span>
                        <span style={{color:C.muted,flexShrink:0}}>S/{c.antes} → <b style={{color:C.txt}}>S/{c.despues}</b></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!pro && <div style={{fontSize:12,color:C.or,marginBottom:12}}>Plan Free: máx. {Math.max(0,PLAN_MAX-activos.length)} SKUs nuevos.</div>}
              <div style={{display:"flex",gap:10}}>
                <Btn onClick={() => setImpMod({...impMod, fase: impMod.conflictos.length ? "conflictos" : "mapeo"})} v="secondary">Atrás</Btn>
                <Btn onClick={doImport} full>Importar</Btn>
              </div>
            </>);
          })()}
        </Sheet>
      )}

      {/* SETTINGS MODAL */}
      {pinsMod && (
        <Sheet>
          <div style={{fontSize:16,fontWeight:700,marginBottom:20,display:"flex",alignItems:"center",gap:8}}><Ico n="engranaje" s={17}/>PINs de acceso</div>
          {["admin","vendedora"].map(rol => (
            <div key={rol} style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:500}}>{rol==="admin"?"PIN Dueña / Admin":"PIN Vendedora"}</div>
              <input type="tel" inputMode="numeric" pattern="[0-9]*" value={pines[rol]} onChange={e => setPines(p => ({...p,[rol]:e.target.value.slice(0,4)}))} style={{...IS,fontSize:22,fontWeight:700,letterSpacing:8}}/>
            </div>
          ))}
          <div style={{background:C.yeBg,border:"1px solid "+C.orLt,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.ye}}>Guarda los PINs en un lugar seguro.</div>

          {/* Respaldo de datos */}
          <div style={{borderTop:"1px solid "+C.border,paddingTop:16,marginBottom:16}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Respaldo de datos</div>
            <div style={{fontSize:11,color:C.muted,marginBottom:12,lineHeight:1.5}}>
              Tus datos se guardan en este dispositivo. Descarga un respaldo periódicamente para no perderlos si se borra el navegador o cambias de equipo.
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={descargarRespaldo}
                style={{flex:1,background:C.prBg,border:"1.5px solid "+C.pr,color:C.pr,borderRadius:12,padding:"11px 0",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                ↓ Descargar respaldo
              </button>
              <label style={{flex:1,background:C.muted2,border:"1.5px solid "+C.border,color:C.muted,borderRadius:12,padding:"11px 0",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"center",display:"block"}}>
                ↑ Restaurar
                <input type="file" accept=".json" onChange={restaurarRespaldo} style={{display:"none"}}/>
              </label>
            </div>
            <div style={{fontSize:10,color:C.muted,marginTop:8}}>
              {prods.length} productos · {hist.length} movimientos registrados
            </div>
          </div>

          <Btn onClick={() => setPinsMod(false)} full>Listo</Btn>
        </Sheet>
      )}

      {/* UPGRADE MODAL */}
      {upModal && (
        <div style={{position:"fixed",inset:0,background:"rgba(26,26,24,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20}}>
          <div style={{background:C.card,borderRadius:24,padding:28,width:"100%",maxWidth:360,boxShadow:shMd}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{width:52,height:52,background:C.puBg,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:24}}>✦</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800}}>Elige tu plan</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>Prueba gratis 14 días. Sin tarjeta.</div>
            </div>
            {[["SKUs activos","Hasta "+PLAN_MAX,"Ilimitados"],["Roles Dueña/Vendedora","✓","✓"],["Importar Excel/CSV","✗","✓"],["Exportar reportes","✗","✓"],["Historial completo","Solo mes","Ilimitado"],["Soporte WhatsApp","—","✓"]].map(([l,f,p],i) => (
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid "+C.border,fontSize:13}}>
                <div style={{color:C.muted}}>{l}</div>
                <div style={{display:"flex",gap:16}}><span style={{color:C.muted,width:64,textAlign:"center",fontSize:12}}>{f}</span><span style={{color:C.pu,width:64,textAlign:"center",fontWeight:600,fontSize:12}}>{p}</span></div>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:20,marginBottom:10}}>
              <button onClick={() => { setPlan("trial"); setUpModal(false); t_("Trial activado — 14 días gratis ✓"); }} style={{flex:1,padding:"14px 0",borderRadius:14,background:C.prBg,border:"1.5px solid "+C.pr,color:C.pr,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>Probar gratis<br/><span style={{fontSize:11,fontWeight:400,color:C.muted}}>14 días</span></button>
              <button onClick={() => { setPlan("pro"); setUpModal(false); t_("¡Bienvenido a PRO! ✦"); }} style={{flex:1,padding:"14px 0",borderRadius:14,background:C.pu,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>Activar PRO<br/><span style={{fontSize:11,fontWeight:400,opacity:0.8}}>S/ 15/mes</span></button>
            </div>
            <button onClick={() => setUpModal(false)} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:"6px 0"}}>Continuar con Free</button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleFile}/>

      {/* VIEWS */}
      {isDesktop && (
        <div style={{padding:"24px 40px 0",borderBottom:"1px solid "+C.border,marginBottom:0,background:C.card}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,paddingBottom:16,color:C.txt}}>
            {vista==="dashboard"?"Inicio":vista==="productos"?(isAdmin?"Inventario":"Stock disponible"):vista==="ventas-hoy"?"Ventas":vista==="historial"?"Historial":vista==="agregar"?"Nuevo producto":""}
          </div>
        </div>
      )}
      <div style={{padding:isDesktop?"32px 40px 40px":"20px 16px 0"}}>
        {verTraza && isAdmin && <TrazaView hist={hist} onBack={()=>setVerTraza(false)} isDesktop={isDesktop}/>}
        {verEgresos && isAdmin && <EgresosView egresos={egresos} onAdd={addEgreso} onDel={delEgreso} ganMes={ganMesBruta} onBack={()=>setVerEgresos(false)} isDesktop={isDesktop}/>}
        {!subv && vista==="dashboard"  && isAdmin && <DashboardView activos={activos} ventasMes={ventasMes} alertas={alertas} topMesData={topMesData} planActivo={pro} expInv={expInv} hist={hist} egresos={egresos} isDesktop={isDesktop} onVerTraza={()=>setVerTraza(true)} onVerEgresos={()=>setVerEgresos(true)}/>}
        {!subv && vista==="ventas-hoy" && <HoyView ventasHoy={ventasHoy} hist={hist} egresos={egresos} isAdmin={isAdmin} planActivo={pro} expExcel={expExcel} doAnular={doAnular} onDevolver={(v)=>setDevM({venta:v, modo:"reembolso", salida:null, q:""})}/>}
        {!subv && vista==="historial"  && isAdmin && <HistorialView hist={hist} isAdmin={isAdmin} planActivo={pro} expExcel={expExcel} onVerTraza={()=>setVerTraza(true)}/>}

        {!subv && vista==="productos" && (
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:14,letterSpacing:-0.5}}>{isAdmin?"Inventario":"Stock disponible"}</div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <input placeholder="Nombre o código..." value={search} onChange={e => setSearch(e.target.value)} style={{flex:1,background:C.card,border:"1.5px solid "+C.border,borderRadius:12,padding:"11px 14px",color:C.txt,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
              {isAdmin && <button onClick={() => fileRef.current.click()} style={{background:C.card,border:"1.5px solid "+C.border,borderRadius:12,padding:"11px 14px",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>↑ Import</button>}
            </div>
            {sedes.length>2 && (
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:12}}>
                {sedes.map(s => <button key={s} onClick={() => setSedeFil(s)} style={{background:sedeFil===s?C.gr:C.card,color:sedeFil===s?"#fff":C.muted,border:"1.5px solid "+(sedeFil===s?C.gr:C.border),borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{s}</button>)}
              </div>
            )}
            {!pro && isAdmin && <div style={{background:C.yeBg,border:"1px solid "+C.orLt,borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:12,color:C.ye,fontWeight:500}}>{activos.length}/{PLAN_MAX} SKUs en plan Free</div><button onClick={() => setUpModal(true)} style={{background:"none",border:"none",color:C.or,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Actualizar →</button></div>}
            {filtrados.length===0 && activos.length===0 && (
              <div style={{background:C.card,borderRadius:16,padding:"40px 20px",textAlign:"center",border:"1px solid "+C.border}}>
                <div style={{display:"flex",justifyContent:"center",marginBottom:12,color:C.muted}}><Ico n="caja" s={32} w={1.4}/></div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Sin productos aún</div>
                <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Agrega tu primer producto o importa desde Excel.</div>
                {isAdmin && <Btn onClick={() => setVista("agregar")} sm>+ Agregar producto</Btn>}
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(auto-fill,minmax(360px,1fr))":"1fr",gap:12}}>
            {filtrados.map(p => {
              const tot = totalStock(p);
              return (
                <div key={p.id} style={{background:C.card,border:"1px solid "+(tot===0?C.orLt:C.border),borderRadius:16,padding:16,marginBottom:12,boxShadow:sh}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:C.muted,fontWeight:500}}>{p.sku}</span>
                        {p.sede && <span style={{background:C.muted2,color:C.muted,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:600,display:"inline-flex",alignItems:"center",gap:3}}><Ico n="pin" s={10}/>{p.sede}</span>}
                        {isAdmin && p.fechaIngreso && <span style={{background:C.grBg,color:C.gr,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:500,display:"inline-flex",alignItems:"center",gap:4}}><Ico n="calendario" s={11}/>{fmtFecha(p.fechaIngreso)}</span>}
                      </div>
                      <div style={{fontSize:15,fontWeight:700}}>{p.nombre}</div>
                    </div>
                    <Pill color={tot===0?"re":tot<=STOCK_BAJO?"ye":"gr"}>{tot===0?"Agotado":tot+"u"}</Pill>
                  </div>
                  <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>Toca un tipo para vender:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:isAdmin?14:8}}>
                    {p.tallas.map((t,ti) => (
                      <button key={t.talla} disabled={t.stock===0} onClick={() => { setVm({prod:p, ti, precioFinal:String(p.venta), medio:"efectivo", onChange:(v)=>setVm(x=>({...x,precioFinal:v})), onMedio:(m)=>setVm(x=>({...x,medio:m}))}); setCant(1); }}
                        style={{background:t.stock===0?C.muted2:t.stock<=STOCK_BAJO?C.yeBg:C.grBg,border:"1.5px solid "+(t.stock===0?C.border:t.stock<=STOCK_BAJO?"#FCD34D":C.grLt),borderRadius:10,padding:"8px 14px",cursor:t.stock===0?"default":"pointer",fontFamily:"inherit",opacity:t.stock===0?0.5:1,minWidth:52,textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:700,color:t.stock===0?C.muted:t.stock<=STOCK_BAJO?C.ye:C.gr}}>{tallaLbl(t.talla)}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:1}}>{t.stock}u</div>
                      </button>
                    ))}
                  </div>
                  {isAdmin && (
                    <div>
                      <div style={{display:"flex",background:C.muted2,borderRadius:10,padding:"10px 14px",marginBottom:10}}>
                        {[["Compra","S/"+ultCosto(p)],["Venta ref.","S/"+p.venta],["Margen",mg(ultCosto(p),p.venta)==="—"?"—":mg(ultCosto(p),p.venta)+"%"]].map(([l,val],i) => (
                          <div key={i} style={{flex:1,borderRight:i<2?"1px solid "+C.border:"none",paddingRight:i<2?12:0,marginRight:i<2?12:0}}>
                            <div style={{fontSize:10,color:C.muted,marginBottom:3,fontWeight:500}}>{l}</div>
                            <div style={{fontSize:13,fontWeight:700,color:i===2?C.gr:C.txt}}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <Btn onClick={() => setRestockM({prod:p, cantidades:{}, nuevoPrecio:"", nuevaVenta:"", nuevasTallas:[]})} full sm>✚ Restock</Btn>
                        <button onClick={() => setMasOpcM(p)}
                          style={{background:C.muted2,border:"1px solid "+C.border,borderRadius:12,padding:"8px 16px",cursor:"pointer",fontFamily:"inherit",fontSize:14,fontWeight:600,color:C.muted,flexShrink:0}}>···</button>
                      </div>
                    </div>
                  )}

                </div>
              );
            })}
            </div>
            {isAdmin && archivados.length>0 && (
              <div style={{marginTop:8,marginBottom:16}}>
                <button onClick={() => setVerArch(!verArch)} style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"11px 16px",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"100%",textAlign:"left",fontWeight:500,display:"flex",justifyContent:"space-between"}}>
                  <span>Modelos archivados ({archivados.length})</span><span>{verArch?"▾":"▸"}</span>
                </button>
                {verArch && archivados.map(p => (
                  <div key={p.id} style={{background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"12px 16px",marginTop:8,opacity:0.7}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontSize:11,color:C.muted,marginBottom:2}}>{p.sku} · {p.sede}</div><div style={{fontSize:13,fontWeight:600,color:C.muted}}>{p.nombre}</div></div>
                      <Btn onClick={() => doArch(p.id)} v="secondary" sm>Restaurar</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!subv && vista==="agregar" && isAdmin && (
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,letterSpacing:-0.5}}>Nuevo producto</div>
              <button onClick={() => fileRef.current.click()} style={{background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"8px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:C.muted}}>↑ Import</button>
            </div>
            {limited && <div style={{background:C.puBg,border:"1px solid #DDD6FE",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:12,color:C.pu,fontWeight:500}}>Límite plan Free ({PLAN_MAX} SKUs)</div><button onClick={() => setUpModal(true)} style={{background:"none",border:"none",color:C.pu,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Actualizar →</button></div>}
            {[{l:"Código / SKU (opcional)",k:"sku",t:"text",ph:"Ej: NIK-AIR-042",hint:"Se genera automáticamente si lo dejas vacío."},
              {l:"Nombre del producto *",k:"nombre",t:"text",ph:"Ej: Zapatilla Nike Air"},
              {l:"Sede / Ubicación",k:"sede",t:"text",ph:"",hint:""},
              {l:"Precio de compra (S/) *",k:"compra",t:"number",ph:"120.00"},
              {l:"Precio de venta ref. (S/) *",k:"venta",t:"number",ph:"200.00",hint:"Ajustable al momento de cada venta."}
            ].map(f => (
              <div key={f.k} style={{marginBottom:14}}>
                <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:500}}>{f.l==="_ SEDE_CUSTOM_"?"Sede / Ubicación":f.l}</div>
                {f.k==="sede" ? (
                  <div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:sedes.filter(s=>s!=="Todas").length>0?8:0}}>
                      {sedes.filter(s=>s!=="Todas").map(s => (
                        <button key={s} onClick={() => { setForm(ff=>({...ff,sede:s})); aplicarDupe(form.sku, s); }}
                          style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(form.sede===s?C.gr:C.border),background:form.sede===s?C.gr:C.card,color:form.sede===s?"#fff":C.txt,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>
                          {s}
                        </button>
                      ))}
                      <button onClick={() => { setForm(ff=>({...ff,sede:"__nueva__"})); aplicarDupe(form.sku, "__nueva__"); }}
                        style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(form.sede==="__nueva__"||!sedes.filter(s=>s!=="Todas").includes(form.sede)&&form.sede&&form.sede!=="__nueva__"?C.gr:C.border),background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:500}}>
                        + Nueva
                      </button>
                    </div>
                    {(form.sede==="__nueva__" || (form.sede && !sedes.filter(s=>s!=="Todas").includes(form.sede))) && (
                      <input autoFocus value={form.sede==="__nueva__"?"":form.sede} placeholder="Ej: Tienda Centro, Depósito B..."
                        onChange={e => { setForm(ff=>({...ff,sede:e.target.value})); aplicarDupe(form.sku, e.target.value); }}
                        style={{width:"100%",background:C.card,border:"1.5px solid "+C.pr,borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",marginTop:4}}/>
                    )}
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>Selecciona una existente o crea una nueva.</div>
                  </div>
                ) : (
                  <>
                    <div style={{display:"flex",gap:8}}>
                      <input type={f.t} value={form[f.k]} placeholder={f.ph}
                        disabled={f.k==="nombre" && !!skuDupe}
                        onChange={e => { const v=f.k==="sku"?e.target.value.toUpperCase():e.target.value; setForm(ff=>({...ff,[f.k]:v})); if(f.k==="sku") aplicarDupe(v, form.sede); }}
                        style={{flex:1,minWidth:0,background:(f.k==="nombre"&&skuDupe)?C.muted2:C.card,border:"1.5px solid "+(f.k==="sku"&&skuErr?C.re:C.border),borderRadius:12,padding:"12px 14px",color:(f.k==="nombre"&&skuDupe)?C.muted:C.txt,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",cursor:(f.k==="nombre"&&skuDupe)?"not-allowed":"auto"}}/>
                      {f.k==="sku" && (
                        <button onClick={() => setScanM(true)} title="Escanear código de barras"
                          style={{background:C.card,border:"1.5px solid "+C.border,borderRadius:12,padding:"0 15px",color:C.pr,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:7,fontSize:13,fontWeight:600,flexShrink:0}}>
                          <Ico n="codigo" s={18}/>{isDesktop && "Escanear"}
                        </button>
                      )}
                    </div>
                    {f.k==="nombre" && skuDupe && (
                      <div style={{fontSize:11,color:C.muted,marginTop:4}}>Vinculado a un producto ya registrado. Para corregir el nombre usa “Solo editar precio / tallas”.</div>
                    )}
                  </>
                )}
                {f.k==="sku" && skuErr && (
                  <div style={{background:C.yeBg,border:"1px solid "+C.orLt,borderRadius:10,padding:"12px 14px",marginTop:8}}>
                    <div style={{fontSize:12,color:C.ye,fontWeight:600,marginBottom:6,display:"flex",alignItems:"center",gap:5}}><Ico n="alerta" s={13}/>{skuErr}</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Para <b>nueva temporada</b> con distinto precio: edita el producto. Para <b>agregar stock</b>: usa ✚ Restock en Stock.</div>
                    {skuDupe && (
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <button onClick={doSumarStock} style={{background:C.pr,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>✚ Sumar stock a este producto</button>
                        <button onClick={() => { openEdit(skuDupe); setSkuErr(""); setSkuDupe(null); setVista("productos"); }} style={{background:C.muted2,color:C.txt,border:"1px solid "+C.border,borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",width:"100%",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6}}><Ico n="lapiz" s={14}/>Solo editar precio / tallas</button>
                      </div>
                    )}
                  </div>
                )}
                {f.hint && !skuErr && <div style={{fontSize:11,color:C.muted,marginTop:4}}>{f.hint}</div>}
              </div>
            ))}
            {form.compra && form.venta && parseFloat(form.venta)>parseFloat(form.compra) && <div style={{background:C.grBg,border:"1px solid "+C.grLt,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:C.gr,fontWeight:600}}>Margen estimado: {mg(parseFloat(form.compra),parseFloat(form.venta))}%</div>}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:500}}>Tipos y stock inicial</div>
              <div style={{fontSize:11,color:C.muted,marginBottom:10}}>Ej: tallas (38, 39, 40), colores (Rojo, Azul), presentaciones...</div>
              <TiposEditor tipos={form.tallas} setTipos={t => setForm(f => ({...f,tallas:t}))}/>
            </div>
            <div style={{marginBottom:16,background:C.grBg,border:"1px solid "+C.grLt,borderRadius:12,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:11,color:C.gr,fontWeight:600,marginBottom:2,display:"flex",alignItems:"center",gap:5}}><Ico n="calendario" s={12}/>Fecha de ingreso</div>
                <div style={{fontSize:14,fontWeight:700,color:C.txt}}>{HOY.toLocaleDateString("es-PE",{day:"numeric",month:"long",year:"numeric"})}</div>
              </div>
              <div style={{fontSize:11,color:C.gr,opacity:0.7}}>Se registra automáticamente</div>
            </div>
            <Btn onClick={addProd} full>Agregar producto</Btn>
          </div>
        )}
      </div>

      {/* NAV — mobile only */}
      {!isDesktop && <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:420,background:C.card,borderTop:"1px solid "+C.border,display:"flex",padding:"8px 8px 12px",gap:4,boxShadow:"0 -4px 16px rgba(0,0,0,0.06)"}}>
        {navItems.map(({id,icon,label}) => (
          <button key={id} onClick={() => { setVista(id); cerrarSubv(); }} style={{flex:1,background:vista===id&&!subv?C.prBg:"transparent",border:"none",cursor:"pointer",padding:"8px 4px",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:18,lineHeight:1}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:vista===id?700:500,color:vista===id?C.pr:C.muted,letterSpacing:0.3,textTransform:"uppercase"}}>{label}</span>
          </button>
        ))}
      </div>}
    </div>
  );
}
