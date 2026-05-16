import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const HOY = new Date();
const MES = HOY.getMonth();
const ANIO = HOY.getFullYear();
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const STOCK_BAJO = 3;
const PLAN_MAX = 5;

const totalStock = (p) => p.tallas.reduce((a,t)=>a+t.stock,0);
const mg = (c,v) => (((v-c)/c)*100).toFixed(0);
const esHoy = (f) => { const d=new Date(f); return d.getDate()===HOY.getDate()&&d.getMonth()===MES&&d.getFullYear()===ANIO; };
const parseTallas = (s) => {
  if(!s.trim()) return [{talla:"ÚNICA",stock:0}];
  return s.split(",").map(x=>{const p=x.trim().split(":");return{talla:p[0].trim().toUpperCase(),stock:parseInt(p[1])||0};}).filter(t=>t.talla);
};

// localStorage con fallback silencioso (funciona en Vercel, falla silenciosamente en preview)
const LS = {
  get: (key, def) => { try { const v=localStorage.getItem(key); return v?JSON.parse(v):def; } catch { return def; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

const C = {
  bg:"#FAFAF7", card:"#FFFFFF", muted2:"#F4F3EE", border:"#E8E6DF",
  txt:"#1A1A18", muted:"#8A8880",
  gr:"#059669", grBg:"#ECFDF5", grLt:"#D1FAE5",
  or:"#EA580C", orBg:"#FFF7ED", orLt:"#FED7AA",
  re:"#DC2626", reBg:"#FEF2F2",
  ye:"#D97706", yeBg:"#FFFBEB",
  pu:"#7C3AED", puBg:"#F5F3FF",
};
const sh   = "0 1px 3px rgba(0,0,0,0.06),0 4px 16px rgba(0,0,0,0.04)";
const shMd = "0 4px 12px rgba(0,0,0,0.08),0 12px 32px rgba(0,0,0,0.06)";
const IS   = {width:"100%",background:C.muted2,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};

// ── ATOMS ──
const Pill = ({children,color}) => {
  const m={gr:{bg:C.grBg,c:C.gr},or:{bg:C.orBg,c:C.or},re:{bg:C.reBg,c:C.re},ye:{bg:C.yeBg,c:C.ye},pu:{bg:C.puBg,c:C.pu}};
  const s=m[color]||m.gr;
  return <span style={{background:s.bg,color:s.c,borderRadius:20,padding:"3px 10px",fontSize:11,fontWeight:600}}>{children}</span>;
};
const Card = ({label,value,color,icon}) => (
  <div style={{background:C.card,borderRadius:16,padding:"16px 14px",boxShadow:sh,border:`1px solid ${C.border}`}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
      <div style={{fontSize:11,color:C.muted,fontWeight:500}}>{label}</div>
      {icon&&<span style={{fontSize:18}}>{icon}</span>}
    </div>
    <div style={{fontSize:22,fontWeight:700,color:color||C.txt,letterSpacing:-0.5}}>{value}</div>
  </div>
);
const Btn = ({onClick,children,v,full,sm,disabled}) => {
  const s={primary:{background:C.gr,color:"#fff",border:"none"},secondary:{background:C.muted2,color:C.txt,border:`1px solid ${C.border}`},danger:{background:C.reBg,color:C.re,border:"1px solid #FCA5A5"}};
  const st=s[v||"primary"];
  return <button onClick={onClick} disabled={disabled} style={{...st,borderRadius:12,padding:sm?"8px 16px":"13px 20px",fontWeight:600,fontSize:sm?12:14,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",width:full?"100%":"auto",opacity:disabled?0.5:1}}>{children}</button>;
};
const Sheet = ({children}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(26,26,24,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.card,borderRadius:"24px 24px 0 0",padding:24,width:"100%",maxWidth:420,boxShadow:"0 -8px 32px rgba(0,0,0,0.12)",maxHeight:"92vh",overflowY:"auto"}}>
      <div style={{width:40,height:4,background:C.border,borderRadius:4,margin:"0 auto 20px"}}/>
      {children}
    </div>
  </div>
);

// ── LOGIN ──
const LoginScreen = ({onLogin,pines}) => {
  const [rol,setRol]=useState(null);
  const [pin,setPin]=useState("");
  const [err,setErr]=useState(false);
  const tap=(k)=>{
    if(k==="del"){setPin(p=>p.slice(0,-1));setErr(false);return;}
    if(pin.length>=4)return;
    const nx=pin+k; setPin(nx);
    if(nx.length===4){
      if(nx===pines[rol])onLogin(rol);
      else{setErr(true);setTimeout(()=>{setPin("");setErr(false);},700);}
    }
  };
  if(!rol) return (
    <div style={{background:C.bg,minHeight:"100vh",maxWidth:420,margin:"0 auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;600;700&display=swap');`}</style>
      <div style={{width:64,height:64,background:C.gr,borderRadius:18,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:16,boxShadow:shMd}}>📦</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:28,fontWeight:800,letterSpacing:-1,marginBottom:4}}>BerroStock</div>
      <div style={{fontSize:13,color:C.muted,marginBottom:40}}>Control de inventario</div>
      <div style={{width:"100%"}}>
        <div style={{fontSize:15,fontWeight:600,textAlign:"center",marginBottom:20}}>¿Quién eres?</div>
        {[{r:"admin",icon:"👑",title:"Dueña / Admin",sub:"Acceso completo"},{r:"vendedora",icon:"🛍️",title:"Vendedora",sub:"Stock y ventas"}].map(x=>(
          <button key={x.r} onClick={()=>setRol(x.r)} style={{background:C.card,border:`2px solid ${C.border}`,borderRadius:16,padding:"18px 20px",cursor:"pointer",fontFamily:"inherit",width:"100%",textAlign:"left",display:"flex",alignItems:"center",gap:14,boxShadow:sh,marginBottom:12}}>
            <div style={{width:44,height:44,background:x.r==="admin"?C.puBg:C.grBg,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{x.icon}</div>
            <div><div style={{fontSize:15,fontWeight:700}}>{x.title}</div><div style={{fontSize:12,color:C.muted,marginTop:2}}>{x.sub}</div></div>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div style={{background:C.bg,minHeight:"100vh",maxWidth:420,margin:"0 auto",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <button onClick={()=>{setRol(null);setPin("");setErr(false);}} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:32,alignSelf:"flex-start"}}>← Volver</button>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{fontSize:32,marginBottom:8}}>{rol==="admin"?"👑":"🛍️"}</div>
        <div style={{fontSize:15,fontWeight:600}}>{rol==="admin"?"Dueña / Admin":"Vendedora"}</div>
        <div style={{fontSize:13,color:err?C.re:C.muted,marginTop:4}}>{err?"PIN incorrecto":"Ingresa tu PIN de 4 dígitos"}</div>
      </div>
      <div style={{display:"flex",gap:14,marginBottom:32}}>
        {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",background:pin.length>i?(err?C.re:C.gr):C.border}}/>)}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,width:260}}>
        {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i)=>(
          <button key={i} onClick={()=>k&&tap(k)} style={{background:k?C.card:"transparent",border:k?`1px solid ${C.border}`:"none",borderRadius:14,padding:"16px 0",fontSize:k==="del"?18:20,fontWeight:k==="del"?400:600,cursor:k?"pointer":"default",fontFamily:"inherit",boxShadow:k?sh:"none"}}>
            {k==="del"?"⌫":k}
          </button>
        ))}
      </div>
      <div style={{textAlign:"center",marginTop:16,fontSize:11,color:C.muted}}>{rol==="admin"?"PIN por defecto: 1234":"PIN por defecto: 0000"}</div>
    </div>
  );
};

// ── VENTA MODAL ──
const VentaModal = ({vm,cant,setCant,isAdmin,onConfirm,onClose}) => {
  const talla=vm.prod.tallas[vm.ti];
  const precio=parseFloat(vm.precioFinal)||vm.prod.venta;
  return (
    <Sheet>
      <div style={{background:C.grBg,borderRadius:12,padding:"10px 14px",marginBottom:18}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{vm.prod.sku} · T{talla.talla} · {vm.prod.sede}</div>
        <div style={{fontSize:15,fontWeight:700}}>{vm.prod.nombre}</div>
      </div>
      <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>Cantidad</div>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18,background:C.muted2,borderRadius:16,padding:"8px 12px"}}>
        <button onClick={()=>setCant(Math.max(1,cant-1))} style={{width:40,height:40,borderRadius:12,background:C.card,border:`1px solid ${C.border}`,fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
        <div style={{fontSize:28,fontWeight:700,flex:1,textAlign:"center"}}>{cant}</div>
        <button onClick={()=>setCant(Math.min(talla.stock,cant+1))} style={{width:40,height:40,borderRadius:12,background:C.gr,border:"none",fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
      </div>
      <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:6}}>Precio de venta S/ {isAdmin&&<span style={{color:C.gr,fontSize:11}}>(ajustable)</span>}</div>
      {isAdmin
        ? <input type="number" value={vm.precioFinal} onChange={e=>vm.onChange(e.target.value)} style={{...IS,fontSize:24,fontWeight:700,marginBottom:6}}/>
        : <div style={{background:C.muted2,borderRadius:12,padding:"12px 14px",marginBottom:6}}><div style={{fontSize:24,fontWeight:700}}>{vm.prod.venta}</div></div>
      }
      {isAdmin&&precio!==vm.prod.venta&&<div style={{fontSize:12,color:precio>vm.prod.venta?C.gr:C.or,marginBottom:4}}>{precio>vm.prod.venta?"↑ Por encima":"↓ Por debajo"} del ref. S/{vm.prod.venta}</div>}
      {isAdmin&&precio<vm.prod.compra&&<div style={{fontSize:12,color:C.re,marginBottom:4}}>⚠ Debajo del costo</div>}
      <div style={{display:"flex",justifyContent:"space-between",background:C.muted2,borderRadius:12,padding:"10px 14px",marginBottom:18,marginTop:8}}>
        <span style={{fontSize:13,color:C.muted}}>Stock: <b style={{color:C.txt}}>{talla.stock}u</b></span>
        <span style={{fontSize:13,color:C.muted}}>Total: <b style={{color:C.gr}}>S/{(cant*precio).toFixed(2)}</b></span>
      </div>
      <div style={{display:"flex",gap:10}}>
        <Btn onClick={onClose} v="secondary">Cancelar</Btn>
        <Btn onClick={onConfirm} full>Confirmar venta</Btn>
      </div>
    </Sheet>
  );
};

// ── EDIT MODAL ──
const EditModal = ({editM,editF,setEditF,confDel,setConfDel,onSave,onDelete,onClose}) => (
  <Sheet>
    {!confDel ? (
      <div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{fontSize:16,fontWeight:700}}>Editar producto</div>
          <button onClick={()=>setConfDel(true)} style={{background:C.reBg,border:"1px solid #FCA5A5",color:C.re,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑 Eliminar</button>
        </div>
        {[{l:"Código / SKU",k:"sku"},{l:"Nombre",k:"nombre"},{l:"Sede / Ubicación",k:"sede"}].map(f=>(
          <div key={f.k} style={{marginBottom:12}}>
            <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:500}}>{f.l}</div>
            <input value={editF[f.k]} onChange={e=>setEditF(ef=>({...ef,[f.k]:f.k==="sku"?e.target.value.toUpperCase():e.target.value}))} style={IS}/>
          </div>
        ))}
        <div style={{display:"flex",gap:10,marginBottom:12}}>
          {[{l:"Compra (S/)",k:"compra"},{l:"Venta ref. (S/)",k:"venta"}].map(f=>(
            <div key={f.k} style={{flex:1}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:500}}>{f.l}</div>
              <input type="number" value={editF[f.k]} onChange={e=>setEditF(ef=>({...ef,[f.k]:e.target.value}))} style={IS}/>
            </div>
          ))}
        </div>
        {editF.compra&&editF.venta&&parseFloat(editF.venta)>parseFloat(editF.compra)&&(
          <div style={{background:C.grBg,border:`1px solid ${C.grLt}`,borderRadius:10,padding:"8px 14px",marginBottom:12,fontSize:13,color:C.gr,fontWeight:600}}>Margen: {mg(parseFloat(editF.compra),parseFloat(editF.venta))}%</div>
        )}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:4,fontWeight:500}}>Tallas y stock <span style={{color:C.gr,fontWeight:400}}>(38:3,39:5 ó S:4,M:6)</span></div>
          <input value={editF.tallasInput} onChange={e=>setEditF(ef=>({...ef,tallasInput:e.target.value}))} style={IS}/>
        </div>
        {editF.tallasInput&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
            {parseTallas(editF.tallasInput).map(t=>(
              <div key={t.talla} style={{background:C.grBg,border:`1px solid ${C.grLt}`,borderRadius:8,padding:"5px 12px",fontSize:12}}>
                <span style={{color:C.gr,fontWeight:700}}>T{t.talla}</span> <span style={{color:C.muted}}>{t.stock}u</span>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={onClose} v="secondary">Cancelar</Btn>
          <Btn onClick={onSave} full>Guardar cambios</Btn>
        </div>
      </div>
    ) : (
      <div style={{textAlign:"center",padding:"8px 0"}}>
        <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>¿Eliminar este producto?</div>
        <div style={{fontSize:13,color:C.muted,marginBottom:8}}>{editM.nombre}</div>
        <div style={{fontSize:12,color:C.re,background:C.reBg,borderRadius:10,padding:"10px 14px",marginBottom:20}}>Esta acción no se puede deshacer.</div>
        <div style={{display:"flex",gap:10}}>
          <Btn onClick={()=>setConfDel(false)} v="secondary" full>Cancelar</Btn>
          <Btn onClick={()=>onDelete(editM.id)} v="danger" full>Sí, eliminar</Btn>
        </div>
      </div>
    )}
  </Sheet>
);

// ── VIEWS ──
function BarChart({porDia}) {
  const maxVal=Math.max(...porDia.map(x=>x.total),1);
  return (
    <div style={{display:"flex",alignItems:"flex-end",gap:3,height:72}}>
      {porDia.map((d,i)=>{
        const h=Math.max((d.total/maxVal)*60,d.total>0?4:0);
        const isToday=d.dia===HOY.getDate();
        return (
          <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <div style={{width:"100%",height:h,borderRadius:3,background:isToday?C.gr:d.total>0?C.grLt:C.muted2}}/>
            {(d.dia===1||d.dia%5===0||isToday)&&<div style={{fontSize:7,color:isToday?C.gr:C.muted,fontWeight:isToday?700:400}}>{d.dia}</div>}
          </div>
        );
      })}
    </div>
  );
}

function TopList({data}) {
  if(!data.length) return <div style={{background:C.card,borderRadius:16,padding:"20px 16px",color:C.muted,fontSize:13,textAlign:"center",border:`1px solid ${C.border}`}}>Sin ventas registradas.</div>;
  return (
    <div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden"}}>
      {data.map(([k,d],i)=>(
        <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:i<data.length-1?`1px solid ${C.border}`:"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:28,height:28,borderRadius:8,background:i===0?C.grBg:C.muted2,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:i===0?C.gr:C.muted}}>{i+1}</div>
            <div><div style={{fontSize:13,fontWeight:600}}>{d.nombre}</div><div style={{fontSize:11,color:C.muted}}>T{d.talla} · {d.unidades}u</div></div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:10,color:C.muted,marginBottom:2}}>Ganancia</div>
            <div style={{fontSize:14,color:C.gr,fontWeight:700}}>S/{d.ganancia.toFixed(0)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function HoyView({ventasHoy,isAdmin,planActivo,expExcel}) {
  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
        <div>
          <div style={{fontSize:13,color:C.muted,fontWeight:500,marginBottom:2}}>{isAdmin?"Ventas del día":"Mis ventas hoy"}</div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,letterSpacing:-0.5}}>{HOY.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long"})}</div>
        </div>
        {isAdmin&&<button onClick={()=>expExcel("dia")} style={{background:planActivo?C.grBg:C.muted2,border:`1.5px solid ${planActivo?C.gr:C.border}`,color:planActivo?C.gr:C.muted,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{planActivo?"↓":"🔒"} Excel</button>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:isAdmin?"1fr 1fr 1fr":"1fr 1fr",gap:10,marginBottom:20}}>
        <Card label="Ventas"   value={ventasHoy.length}/>
        <Card label="Ingresos" value={`S/${ventasHoy.reduce((a,v)=>a+v.total,0).toFixed(0)}`}/>
        {isAdmin&&<Card label="Ganancia" value={`S/${ventasHoy.reduce((a,v)=>a+v.ganancia,0).toFixed(0)}`} color={C.gr}/>}
      </div>
      {ventasHoy.length===0
        ?<div style={{background:C.card,borderRadius:16,padding:"40px 20px",textAlign:"center",border:`1px solid ${C.border}`}}><div style={{fontSize:32,marginBottom:8}}>🛍️</div><div style={{fontSize:14,color:C.muted}}>Sin ventas hoy todavía.</div></div>
        :[...ventasHoy].reverse().map(v=>(
          <div key={v.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:2}}>{v.sku} · T{v.talla} · {v.sede}</div><div style={{fontSize:14,fontWeight:600}}>{v.producto}</div></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:15,color:C.gr,fontWeight:700}}>S/{v.total.toFixed(0)}</div>
                {isAdmin&&v.precioVenta!==v.precioOriginal&&<div style={{fontSize:11,color:v.precioVenta>v.precioOriginal?C.gr:C.or}}>{v.precioVenta>v.precioOriginal?"↑":"↓"} vendido a S/{v.precioVenta} (ref. S/{v.precioOriginal})</div>}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
              <span>{v.cantidad}u × S/{v.precioVenta}</span>
              {isAdmin&&<span>Ganancia: <b style={{color:C.txt}}>S/{v.ganancia.toFixed(0)}</b></span>}
            </div>
          </div>
        ))
      }
    </div>
  );
}

function HistorialView({hist,isAdmin,planActivo,expExcel}) {
  const [hMes,  setHMes]  = useState(MES);
  const [hAnio, setHAnio] = useState(ANIO);
  const [hDia,  setHDia]  = useState(null);

  const esCurrent = hMes===MES&&hAnio===ANIO;
  const prevMes = () => { setHDia(null); if(hMes===0){setHMes(11);setHAnio(a=>a-1);}else setHMes(m=>m-1); };
  const nextMes = () => { if(esCurrent)return; setHDia(null); if(hMes===11){setHMes(0);setHAnio(a=>a+1);}else setHMes(m=>m+1); };

  const ventasM = hist.filter(v=>{const d=new Date(v.fecha);return d.getMonth()===hMes&&d.getFullYear()===hAnio;});
  const ventasD = hDia?ventasM.filter(v=>new Date(v.fecha).getDate()===hDia):[];
  const diasEnMes = new Date(hAnio,hMes+1,0).getDate();
  const porDia = Array.from({length:diasEnMes},(_,i)=>{
    const dia=i+1;
    const vs=ventasM.filter(v=>new Date(v.fecha).getDate()===dia);
    return {dia,total:vs.reduce((a,v)=>a+v.total,0),ganancia:vs.reduce((a,v)=>a+v.ganancia,0),count:vs.length};
  });
  const topData = (() => {
    const ag={};
    ventasM.forEach(v=>{const k=v.sku+"-T"+v.talla;if(!ag[k])ag[k]={nombre:v.producto,talla:v.talla,ganancia:0,unidades:0};ag[k].ganancia+=v.ganancia;ag[k].unidades+=v.cantidad;});
    return Object.entries(ag).sort((a,b)=>b[1].unidades-a[1].unidades).slice(0,5);
  })();

  if(hDia) return (
    <div>
      <button onClick={()=>setHDia(null)} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:20,display:"flex",alignItems:"center",gap:6,fontWeight:500}}>← {MESES[hMes]} {hAnio}</button>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:20,letterSpacing:-0.5}}>
        {hDia} de {MESES[hMes]}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        <Card label="Ventas"   value={ventasD.length}/>
        <Card label="Ingresos" value={`S/${ventasD.reduce((a,v)=>a+v.total,0).toFixed(0)}`}/>
        {isAdmin&&<Card label="Ganancia" value={`S/${ventasD.reduce((a,v)=>a+v.ganancia,0).toFixed(0)}`} color={C.gr}/>}
      </div>
      {ventasD.length===0
        ?<div style={{background:C.card,borderRadius:16,padding:"30px 20px",textAlign:"center",border:`1px solid ${C.border}`,color:C.muted,fontSize:14}}>Sin ventas este día.</div>
        :ventasD.map(v=>(
          <div key={v.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,padding:"14px 16px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div><div style={{fontSize:11,color:C.muted,marginBottom:2}}>{v.sku} · T{v.talla} · {v.sede}</div><div style={{fontSize:14,fontWeight:600}}>{v.producto}</div></div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:15,color:C.gr,fontWeight:700}}>S/{v.total.toFixed(0)}</div>
                {isAdmin&&v.precioVenta!==v.precioOriginal&&<div style={{fontSize:11,color:v.precioVenta>v.precioOriginal?C.gr:C.or}}>{v.precioVenta>v.precioOriginal?"↑":"↓"} ref. S/{v.precioOriginal}</div>}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:C.muted}}>
              <span>{v.cantidad}u × S/{v.precioVenta}</span>
              {isAdmin&&<span>Ganancia: <b style={{color:C.txt}}>S/{v.ganancia.toFixed(0)}</b></span>}
            </div>
          </div>
        ))
      }
    </div>
  );

  return (
    <div>
      {/* Navegador de mes */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <button onClick={prevMes} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit",fontSize:16}}>‹</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,letterSpacing:-0.5}}>{MESES[hMes]}</div>
          <div style={{fontSize:12,color:C.muted}}>{hAnio} {esCurrent&&<span style={{color:C.gr,fontWeight:600}}>· Mes actual</span>}</div>
        </div>
        <button onClick={nextMes} style={{background:esCurrent?C.muted2:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"8px 14px",cursor:esCurrent?"default":"pointer",fontFamily:"inherit",fontSize:16,opacity:esCurrent?0.3:1}}>›</button>
      </div>

      {isAdmin&&<button onClick={()=>expExcel("mes",hMes,hAnio)} style={{background:planActivo?C.grBg:C.muted2,border:`1.5px solid ${planActivo?C.gr:C.border}`,color:planActivo?C.gr:C.muted,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:20}}>{planActivo?"↓":"🔒"} Excel {MESES[hMes]}</button>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
        <Card label="Transacciones"   value={ventasM.length}/>
        <Card label="Unidades"         value={ventasM.reduce((a,v)=>a+v.cantidad,0)}/>
        <Card label="Ingresos totales" value={`S/${ventasM.reduce((a,v)=>a+v.total,0).toFixed(0)}`}/>
        {isAdmin&&<Card label="Ganancia neta" value={`S/${ventasM.reduce((a,v)=>a+v.ganancia,0).toFixed(0)}`} color={C.gr}/>}
      </div>

      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Ingresos por día</div>
      <div style={{background:C.card,borderRadius:16,padding:"16px 14px",marginBottom:20,border:`1px solid ${C.border}`}}>
        <BarChart porDia={porDia}/>
      </div>

      {/* Días con ventas - clickeables */}
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Días con ventas</div>
      {porDia.filter(d=>d.count>0).length===0
        ?<div style={{background:C.card,borderRadius:12,padding:"20px 16px",textAlign:"center",border:`1px solid ${C.border}`,color:C.muted,fontSize:13,marginBottom:20}}>Sin ventas en {MESES[hMes]}.</div>
        :<div style={{background:C.card,borderRadius:16,border:`1px solid ${C.border}`,overflow:"hidden",marginBottom:20}}>
          {porDia.filter(d=>d.count>0).reverse().map((d,i,arr)=>(
            <button key={d.dia} onClick={()=>setHDia(d.dia)}
              style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:i<arr.length-1?`1px solid ${C.border}`:"none",background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <div>
                <div style={{fontSize:14,fontWeight:600,color:C.txt}}>{d.dia} de {MESES[hMes]}</div>
                <div style={{fontSize:12,color:C.muted,marginTop:2}}>{d.count} transacción{d.count!==1?"es":""}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:14,color:C.gr,fontWeight:700}}>S/{d.total.toFixed(0)}</div>
                {isAdmin&&<div style={{fontSize:11,color:C.muted}}>gan. S/{d.ganancia.toFixed(0)}</div>}
              </div>
            </button>
          ))}
        </div>
      }

      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Top tallas del mes</div>
      <TopList data={topData}/>
    </div>
  );
}

function DashboardView({activos,ventasMes,alertas,topMesData,planActivo,expInv}) {
  return (
    <div>
      <div style={{fontSize:13,color:C.muted,fontWeight:500,marginBottom:4}}>{HOY.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long"})}</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:20,letterSpacing:-0.5}}>Buen día 👑</div>
      {activos.length===0&&(
        <div style={{background:C.grBg,border:`1px solid ${C.grLt}`,borderRadius:16,padding:"20px 16px",marginBottom:24,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>🚀</div>
          <div style={{fontSize:14,fontWeight:600,color:C.gr,marginBottom:4}}>¡Bienvenido a BerroStock!</div>
          <div style={{fontSize:13,color:C.muted}}>Ve a Stock → Agregar para ingresar tus primeros productos.</div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:24}}>
        <Card label="Invertido en stock" value={`S/${activos.reduce((a,p)=>a+p.compra*totalStock(p),0).toFixed(0)}`} icon="💰"/>
        <Card label="Ganancia del mes"   value={`S/${ventasMes.reduce((a,v)=>a+v.ganancia,0).toFixed(0)}`} color={C.gr} icon="📈"/>
        <Card label="Stock bajo" value={activos.filter(p=>p.tallas.some(t=>t.stock>0&&t.stock<=STOCK_BAJO)).length} color={C.ye} icon="⚠️"/>
        <Card label="Sin stock"  value={activos.filter(p=>totalStock(p)===0).length} color={C.re} icon="📭"/>
      </div>
      {alertas.length>0&&(
        <div style={{marginBottom:24}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Alertas de stock</div>
          {alertas.map(p=>(
            <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.or}`,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
              <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{p.sku} · {p.sede}</div>
              <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>{p.nombre}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {p.tallas.filter(t=>t.stock<=STOCK_BAJO).map(t=><Pill key={t.talla} color={t.stock===0?"re":"ye"}>T{t.talla}: {t.stock===0?"agotado":`${t.stock}u`}</Pill>)}
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Top del mes</div>
      <TopList data={topMesData}/>
      <div style={{marginTop:24}}>
        <Btn onClick={expInv} full v={planActivo?"primary":"secondary"}>{planActivo?"↓ ":"🔒 "}Exportar inventario (.xlsx)</Btn>
      </div>
    </div>
  );
}

// ── APP ──
export default function App() {
  const [prods,  setProds]   = useState(()=>LS.get("bs_prods",[]));
  const [hist,   setHist]    = useState(()=>LS.get("bs_hist",[]));
  const [sesion, setSesion]  = useState(null);
  const [pines,  setPines]   = useState(()=>LS.get("bs_pines",{admin:"1234",vendedora:"0000"}));
  const [vista,  setVista]   = useState("productos");
  const [plan,   setPlan]    = useState(()=>LS.get("bs_plan","free"));
  const [form,   setForm]    = useState({sku:"",nombre:"",compra:"",venta:"",sede:"",tallasInput:""});
  const [skuErr, setSkuErr]  = useState("");
  const [vm,     setVm]      = useState(null);
  const [cant,   setCant]    = useState(1);
  const [toast,  setToast]   = useState(null);
  const [search, setSearch]  = useState("");
  const [sedeFil,setSedeFil] = useState("Todas");
  const [verArch,setVerArch] = useState(false);
  const [upModal,setUpModal] = useState(false);
  const [setMod, setSetMod]  = useState(false);
  const [impMod, setImpMod]  = useState(null);
  const [editM,  setEditM]   = useState(null);
  const [editF,  setEditF]   = useState({sku:"",nombre:"",compra:"",venta:"",sede:"",tallasInput:""});
  const [confDel,setConfDel] = useState(false);
  const fileRef = useRef();

  // Persistencia localStorage
  useEffect(()=>{ LS.set("bs_prods",prods); },[prods]);
  useEffect(()=>{ LS.set("bs_hist",hist);   },[hist]);
  useEffect(()=>{ LS.set("bs_plan",plan);   },[plan]);
  useEffect(()=>{ LS.set("bs_pines",pines); },[pines]);

  const t_ = (msg,tipo="ok") => { setToast({msg,tipo}); setTimeout(()=>setToast(null),2500); };
  const isAdmin   = sesion==="admin";
  const pro       = plan==="pro"||plan==="trial";
  const activos   = prods.filter(p=>!p.archivado);
  const archivados= prods.filter(p=>p.archivado);
  const limited   = plan==="free"&&activos.length>=PLAN_MAX;
  const ventasHoy = hist.filter(v=>esHoy(v.fecha));
  const ventasMes = hist.filter(v=>{ const d=new Date(v.fecha); return d.getMonth()===MES&&d.getFullYear()===ANIO; });
  const sedes     = ["Todas",...new Set(activos.map(p=>p.sede).filter(Boolean))];
  const alertas   = activos.filter(p=>p.tallas.some(t=>t.stock<=STOCK_BAJO));
  const filtrados = activos.filter(p=>{
    const ms=p.nombre.toLowerCase().includes(search.toLowerCase())||p.sku.toLowerCase().includes(search.toLowerCase());
    return ms&&(sedeFil==="Todas"||p.sede===sedeFil);
  });
  const topMesData = (()=>{
    const ag={};
    ventasMes.forEach(v=>{const k=v.sku+"-T"+v.talla;if(!ag[k])ag[k]={nombre:v.producto,talla:v.talla,ganancia:0,unidades:0};ag[k].ganancia+=v.ganancia;ag[k].unidades+=v.cantidad;});
    return Object.entries(ag).sort((a,b)=>b[1].unidades-a[1].unidades).slice(0,5);
  })();

  const addProd = () => {
    if(!form.nombre||!form.compra||!form.venta)return t_("Completa nombre, compra y venta","error");
    if(form.sku&&prods.some(p=>p.sku.toLowerCase()===form.sku.toLowerCase())){setSkuErr("Código ya existe");return;}
    if(limited)return setUpModal(true);
    setSkuErr("");
    setProds([...prods,{id:Date.now(),sku:form.sku.toUpperCase()||("SKU-"+Date.now()),nombre:form.nombre,compra:parseFloat(form.compra),venta:parseFloat(form.venta),archivado:false,sede:form.sede||"Principal",tallas:parseTallas(form.tallasInput)}]);
    setForm({sku:"",nombre:"",compra:"",venta:"",sede:"",tallasInput:""});
    t_("Producto agregado ✓"); setVista("productos");
  };

  const doVenta = () => {
    const precio=isAdmin?(parseFloat(vm.precioFinal)||vm.prod.venta):vm.prod.venta;
    const talla=vm.prod.tallas[vm.ti];
    if(cant>talla.stock)return t_("Stock insuficiente","error");
    setProds(prods.map(p=>p.id!==vm.prod.id?p:{...p,tallas:p.tallas.map((t,i)=>i===vm.ti?{...t,stock:t.stock-cant}:t)}));
    setHist([...hist,{id:Date.now(),producto:vm.prod.nombre,sku:vm.prod.sku,talla:talla.talla,sede:vm.prod.sede,cantidad:cant,precioVenta:precio,precioOriginal:vm.prod.venta,precioCompra:vm.prod.compra,total:precio*cant,ganancia:(precio-vm.prod.compra)*cant,fecha:new Date().toISOString()}]);
    t_("Venta registrada ✓"); setVm(null); setCant(1);
  };

  const doArch = (id) => {
    const p=prods.find(x=>x.id===id);
    if(!p.archivado&&totalStock(p)>0)return t_("Solo puedes archivar modelos sin stock","error");
    if(p.archivado&&limited)return setUpModal(true);
    setProds(prods.map(x=>x.id===id?{...x,archivado:!x.archivado}:x));
    t_(p.archivado?"Restaurado ✓":"Archivado ✓");
  };

  const openEdit=(p)=>{ setEditF({sku:p.sku,nombre:p.nombre,compra:String(p.compra),venta:String(p.venta),sede:p.sede||"",tallasInput:p.tallas.map(t=>t.talla+":"+t.stock).join(",")}); setConfDel(false); setEditM(p); };
  const saveEdit=()=>{ if(!editF.nombre||!editF.compra||!editF.venta)return t_("Faltan campos","error"); if(prods.some(p=>p.sku.toLowerCase()===editF.sku.toLowerCase()&&p.id!==editM.id))return t_("Código ya existe","error"); setProds(prods.map(p=>p.id!==editM.id?p:{...p,sku:editF.sku.toUpperCase()||p.sku,nombre:editF.nombre,compra:parseFloat(editF.compra),venta:parseFloat(editF.venta),sede:editF.sede||p.sede,tallas:parseTallas(editF.tallasInput)})); setEditM(null); t_("Actualizado ✓"); };
  const delProd=(id)=>{ setProds(prods.filter(p=>p.id!==id)); setEditM(null); setConfDel(false); t_("Eliminado"); };

  const expExcel = (tipo,mes=MES,anio=ANIO) => {
    if(!pro)return setUpModal(true);
    const datos=tipo==="dia"?ventasHoy:hist.filter(v=>{const d=new Date(v.fecha);return d.getMonth()===mes&&d.getFullYear()===anio;});
    const tit=tipo==="dia"?("Ventas_"+HOY.toLocaleDateString("es-PE").replace(/\//g,"-")):("Ventas_"+MESES[mes]+"_"+anio);
    const rows=datos.map(v=>({"Código":v.sku,"Producto":v.producto,"Talla":v.talla,"Sede":v.sede||"—","Fecha":new Date(v.fecha).toLocaleDateString("es-PE"),"Cant":v.cantidad,"P.Orig":v.precioOriginal,"P.Venta":v.precioVenta,"Total":v.total,"Ganancia":v.ganancia.toFixed(2)}));
    rows.push({},{"Producto":"TOTAL","Cant":datos.reduce((a,v)=>a+v.cantidad,0),"Total":datos.reduce((a,v)=>a+v.total,0).toFixed(2),"Ganancia":datos.reduce((a,v)=>a+v.ganancia,0).toFixed(2)});
    const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Ventas");XLSX.writeFile(wb,tit+".xlsx");
    t_("Excel descargado ✓");
  };
  const expInv = () => {
    if(!pro)return setUpModal(true);
    const rows=[];activos.forEach(p=>p.tallas.forEach(t=>rows.push({"Código":p.sku,"Producto":p.nombre,"Sede":p.sede||"—","Talla":t.talla,"Stock":t.stock,"Compra":p.compra,"Venta":p.venta,"Margen%":mg(p.compra,p.venta)})));
    const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Inventario");XLSX.writeFile(wb,("Inventario_"+HOY.toLocaleDateString("es-PE").replace(/\//g,"-")+".xlsx"));
    t_("Inventario exportado ✓");
  };

  const handleFile=(e)=>{
    const file=e.target.files[0];if(!file)return;
    const ext=file.name.split(".").pop().toLowerCase();
    const proc=(rawRows)=>{
      if(!rawRows.length)return t_("Archivo vacío","error");
      const headers=Object.keys(rawRows[0]);
      const det=(al)=>headers.find(h=>al.some(a=>h.toLowerCase().includes(a)))||null;
      setImpMod({rows:rawRows,headers,reemplazar:false,colMap:{sku:det(["sku","codigo","cod","ref"]),nombre:det(["nombre","producto","name"]),talla:det(["talla","size","talle"]),stock:det(["stock","cantidad","qty"]),compra:det(["compra","costo","cost"]),venta:det(["venta","precio","price","pvp"]),sede:det(["sede","tienda","local","ubicacion"])}});
    };
    const r=new FileReader();
    if(ext==="csv"){r.onload=(ev)=>{const lines=ev.target.result.trim().split("\n");const hds=lines[0].split(",").map(h=>h.trim().replace(/"/g,""));const rows=lines.slice(1).map(l=>{const v=l.split(",").map(x=>x.trim().replace(/"/g,""));const o={};hds.forEach((h,i)=>o[h]=v[i]||"");return o;}).filter(rw=>Object.values(rw).some(x=>x));proc(rows);};r.readAsText(file);}
    else{r.onload=(ev)=>{const wb=XLSX.read(ev.target.result,{type:"array"});proc(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""}));};r.readAsArrayBuffer(file);}
    e.target.value="";
  };

  const doImport=()=>{
    const{rows,colMap,reemplazar}=impMod;
    if(!colMap.nombre)return t_("Necesitas columna nombre","error");
    const mapa={};
    rows.forEach((r,i)=>{
      const sku=(r[colMap.sku]||"").toString().trim().toUpperCase()||("IMP-"+(Date.now()+i));
      const sede=(colMap.sede&&r[colMap.sede])?r[colMap.sede].toString().trim():"Principal";
      const talla=(r[colMap.talla]||"UNICA").toString().trim().toUpperCase();
      const key=sku+"||"+sede;
      if(!mapa[key])mapa[key]={id:Date.now()+i,sku,nombre:String(r[colMap.nombre]||"").trim(),compra:parseFloat(r[colMap.compra])||0,venta:parseFloat(r[colMap.venta])||0,archivado:false,sede,tallas:[]};
      mapa[key].tallas.push({talla,stock:parseInt(r[colMap.stock])||0});
    });
    const nuevos=Object.values(mapa).filter(p=>p.nombre);
    const dupes=nuevos.filter(p=>prods.some(x=>x.sku===p.sku&&x.sede===p.sede));
    const fresh=nuevos.filter(p=>!prods.some(x=>x.sku===p.sku&&x.sede===p.sede));
    if(reemplazar){let u=[...prods];dupes.forEach(np=>{const idx=u.findIndex(x=>x.sku===np.sku&&x.sede===np.sede);if(idx>=0)u[idx]={...u[idx],...np};});setProds([...u,...fresh.slice(0,pro?Infinity:Math.max(0,PLAN_MAX-activos.length))]);}
    else setProds([...prods,...fresh.slice(0,pro?Infinity:Math.max(0,PLAN_MAX-activos.length))]);
    setImpMod(null);
    t_(fresh.length+" nuevos"+(reemplazar&&dupes.length>0?", "+dupes.length+" reemplazados":dupes.length>0?", "+dupes.length+" omitidos":""));
    setVista("productos");
  };

  const navAdmin=[{id:"dashboard",icon:"⊞",label:"Inicio"},{id:"productos",icon:"◫",label:"Stock"},{id:"ventas-hoy",icon:"○",label:"Hoy"},{id:"historial",icon:"◷",label:"Historial"},{id:"agregar",icon:"+",label:"Agregar"}];
  const navVend =[{id:"productos",icon:"◫",label:"Stock"},{id:"ventas-hoy",icon:"○",label:"Mis ventas"}];
  const navItems=isAdmin?navAdmin:navVend;

  if(!sesion)return <LoginScreen onLogin={setSesion} pines={pines}/>;

  return (
    <div style={{background:C.bg,minHeight:"100vh",maxWidth:420,margin:"0 auto",fontFamily:"'DM Sans',system-ui,sans-serif",color:C.txt,paddingBottom:88}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;600;700&display=swap'); *{-webkit-tap-highlight-color:transparent} @keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}} @keyframes toastIn{from{opacity:0;transform:translateX(-50%) scale(0.95)}to{opacity:1;transform:translateX(-50%) scale(1)}} input:focus{border-color:${C.gr}!important;box-shadow:0 0 0 3px ${C.grBg};}`}</style>

      {/* HEADER */}
      <div style={{background:C.card,padding:"14px 20px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:C.gr,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📦</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,letterSpacing:-0.5,lineHeight:1}}>BerroStock</div>
            <div style={{fontSize:10,color:C.muted,fontWeight:500}}>{isAdmin?"👑 Dueña":"🛍️ Vendedora"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isAdmin&&<button onClick={()=>setSetMod(true)} style={{background:C.muted2,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",fontSize:16,cursor:"pointer"}}>⚙️</button>}
          {isAdmin&&<button onClick={()=>setUpModal(true)} style={{background:plan==="pro"?C.puBg:plan==="trial"?C.grBg:C.muted2,border:`1.5px solid ${plan==="pro"?C.pu:plan==="trial"?C.gr:C.border}`,color:plan==="pro"?C.pu:plan==="trial"?C.gr:C.muted,borderRadius:20,padding:"5px 12px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{plan==="pro"?"✦ PRO":plan==="trial"?"▷ TRIAL":"FREE"}</button>}
          <button onClick={()=>setSesion(null)} style={{background:C.muted2,border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px",fontSize:12,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Salir</button>
        </div>
      </div>

      {toast&&<div style={{position:"fixed",top:76,left:"50%",transform:"translateX(-50%)",background:toast.tipo==="error"?C.re:C.gr,color:"#fff",padding:"10px 20px",borderRadius:24,fontSize:13,fontWeight:600,zIndex:999,whiteSpace:"nowrap",boxShadow:shMd,animation:"toastIn 0.2s ease"}}>{toast.tipo==="error"?"✕ ":"✓ "}{toast.msg}</div>}

      {vm&&<VentaModal vm={vm} cant={cant} setCant={setCant} isAdmin={isAdmin} onConfirm={doVenta} onClose={()=>{setVm(null);setCant(1);}}/>}
      {editM&&<EditModal editM={editM} editF={editF} setEditF={setEditF} confDel={confDel} setConfDel={setConfDel} onSave={saveEdit} onDelete={delProd} onClose={()=>setEditM(null)}/>}

      {impMod&&(
        <Sheet>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Importar productos</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:16}}>{impMod.rows.length} filas detectadas</div>
          {["sku","nombre","talla","stock","compra","venta","sede"].map(field=>(
            <div key={field} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <div style={{fontSize:13,color:field==="nombre"?C.txt:C.muted,fontWeight:field==="nombre"?600:400}}>{field}{field==="nombre"&&" *"}</div>
              <select value={impMod.colMap[field]||""} onChange={e=>setImpMod({...impMod,colMap:{...impMod.colMap,[field]:e.target.value||null}})}
                style={{background:C.muted2,border:`1px solid ${C.border}`,color:C.txt,borderRadius:8,padding:"4px 8px",fontSize:12,fontFamily:"inherit"}}>
                <option value="">— no mapear —</option>
                {impMod.headers.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          ))}
          {(()=>{const mapa={};impMod.rows.forEach((r,i)=>{const sku=(r[impMod.colMap.sku]||"").toString().trim().toUpperCase()||("IMP-"+i);const sede=(impMod.colMap.sede&&r[impMod.colMap.sede])?r[impMod.colMap.sede].toString().trim():"Principal";const key=sku+"||"+sede;if(!mapa[key])mapa[key]={sku,sede};});const dupes=Object.values(mapa).filter(p=>prods.some(x=>x.sku===p.sku&&x.sede===p.sede));if(!dupes.length)return null;return(<div style={{background:C.yeBg,border:`1px solid ${C.orLt}`,borderRadius:10,padding:"10px 14px",marginTop:14}}><div style={{fontSize:12,color:C.ye,fontWeight:600,marginBottom:8}}>⚠ {dupes.length} producto(s) ya existen</div><div style={{display:"flex",gap:10}}>{[{v:false,label:"Omitir"},{v:true,label:"Reemplazar"}].map(op=>(<button key={String(op.v)} onClick={()=>setImpMod({...impMod,reemplazar:op.v})} style={{flex:1,padding:"8px 0",borderRadius:8,border:`1.5px solid ${impMod.reemplazar===op.v?C.gr:C.border}`,background:impMod.reemplazar===op.v?C.grBg:C.card,color:impMod.reemplazar===op.v?C.gr:C.muted,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{op.label}</button>))}</div></div>);})()}
          {!pro&&<div style={{fontSize:12,color:C.or,margin:"12px 0"}}>Plan Free: máx. {Math.max(0,PLAN_MAX-activos.length)} SKUs importables.</div>}
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <Btn onClick={()=>setImpMod(null)} v="secondary">Cancelar</Btn>
            <Btn onClick={doImport} full>Importar</Btn>
          </div>
        </Sheet>
      )}

      {setMod&&(
        <Sheet>
          <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>⚙️ Configuración de PINs</div>
          {["admin","vendedora"].map(rol=>(
            <div key={rol} style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:500}}>{rol==="admin"?"PIN Dueña / Admin":"PIN Vendedora"}</div>
              <input type="number" value={pines[rol]} onChange={e=>setPines(p=>({...p,[rol]:e.target.value.slice(0,4)}))} style={{...IS,fontSize:22,fontWeight:700,letterSpacing:8}}/>
            </div>
          ))}
          <div style={{background:C.yeBg,border:`1px solid ${C.orLt}`,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.ye}}>Guarda los PINs en un lugar seguro.</div>
          <Btn onClick={()=>setSetMod(false)} full>Listo</Btn>
        </Sheet>
      )}

      {upModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(26,26,24,0.7)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:20}}>
          <div style={{background:C.card,borderRadius:24,padding:28,width:"100%",maxWidth:360,boxShadow:shMd}}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{width:52,height:52,background:C.puBg,borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:24}}>✦</div>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800}}>Elige tu plan</div>
              <div style={{fontSize:13,color:C.muted,marginTop:4}}>Prueba gratis 14 días. Sin tarjeta.</div>
            </div>
            {[["SKUs activos","Hasta "+PLAN_MAX,"Ilimitados"],["Roles Dueña/Vendedora","✓","✓"],["Importar Excel/CSV","✗","✓"],["Exportar reportes","✗","✓"],["Historial de ventas","Solo mes actual","Ilimitado"],["Soporte WhatsApp","—","✓"]].map(([l,f,p],i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:13}}>
                <div style={{color:C.muted}}>{l}</div>
                <div style={{display:"flex",gap:16}}><span style={{color:C.muted,width:64,textAlign:"center",fontSize:12}}>{f}</span><span style={{color:C.pu,width:64,textAlign:"center",fontWeight:600,fontSize:12}}>{p}</span></div>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:20,marginBottom:10}}>
              <button onClick={()=>{setPlan("trial");setUpModal(false);t_("Trial activado — 14 días gratis ✓");}} style={{flex:1,padding:"14px 0",borderRadius:14,background:C.grBg,border:`1.5px solid ${C.gr}`,color:C.gr,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>Probar gratis<br/><span style={{fontSize:11,fontWeight:400,color:C.muted}}>14 días</span></button>
              <button onClick={()=>{setPlan("pro");setUpModal(false);t_("¡Bienvenido a PRO! ✦");}} style={{flex:1,padding:"14px 0",borderRadius:14,background:C.pu,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>Activar PRO<br/><span style={{fontSize:11,fontWeight:400,opacity:0.8}}>S/ 15/mes</span></button>
            </div>
            <button onClick={()=>setUpModal(false)} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:"6px 0"}}>Continuar con Free</button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleFile}/>

      <div style={{padding:"20px 16px 0"}}>
        {vista==="dashboard"&&isAdmin&&<DashboardView activos={activos} ventasMes={ventasMes} alertas={alertas} topMesData={topMesData} planActivo={pro} expInv={expInv}/>}
        {vista==="ventas-hoy"&&<HoyView ventasHoy={ventasHoy} isAdmin={isAdmin} planActivo={pro} expExcel={expExcel}/>}
        {vista==="historial"&&isAdmin&&<HistorialView hist={hist} isAdmin={isAdmin} planActivo={pro} expExcel={expExcel}/>}

        {vista==="productos"&&(
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:14,letterSpacing:-0.5}}>{isAdmin?"Inventario":"Stock disponible"}</div>
            <div style={{display:"flex",gap:10,marginBottom:12}}>
              <input placeholder="Nombre o código..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,background:C.card,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"11px 14px",color:C.txt,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
              {isAdmin&&<button onClick={()=>fileRef.current.click()} style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"11px 14px",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap"}}>↑ Import</button>}
            </div>
            {sedes.length>2&&(
              <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:8,marginBottom:12}}>
                {sedes.map(s=><button key={s} onClick={()=>setSedeFil(s)} style={{background:sedeFil===s?C.gr:C.card,color:sedeFil===s?"#fff":C.muted,border:`1.5px solid ${sedeFil===s?C.gr:C.border}`,borderRadius:20,padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>{s}</button>)}
              </div>
            )}
            {!pro&&isAdmin&&<div style={{background:C.yeBg,border:`1px solid ${C.orLt}`,borderRadius:12,padding:"10px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:12,color:C.ye,fontWeight:500}}>{activos.length}/{PLAN_MAX} SKUs en plan Free</div><button onClick={()=>setUpModal(true)} style={{background:"none",border:"none",color:C.or,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Actualizar →</button></div>}
            {filtrados.length===0&&activos.length===0&&(
              <div style={{background:C.card,borderRadius:16,padding:"40px 20px",textAlign:"center",border:`1px solid ${C.border}`}}>
                <div style={{fontSize:32,marginBottom:12}}>📦</div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Sin productos aún</div>
                <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Agrega tu primer producto o importa desde Excel.</div>
                <Btn onClick={()=>setVista("agregar")} sm>+ Agregar producto</Btn>
              </div>
            )}
            {filtrados.map(p=>{
              const tot=totalStock(p);
              return (
                <div key={p.id} style={{background:C.card,border:`1px solid ${tot===0?C.orLt:C.border}`,borderRadius:16,padding:16,marginBottom:12,boxShadow:sh}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:C.muted,fontWeight:500}}>{p.sku}</span>
                        {p.sede&&<span style={{background:C.muted2,color:C.muted,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:600}}>📍{p.sede}</span>}
                      </div>
                      <div style={{fontSize:15,fontWeight:700}}>{p.nombre}</div>
                    </div>
                    <Pill color={tot===0?"re":tot<=STOCK_BAJO?"ye":"gr"}>{tot===0?"Agotado":`${tot}u`}</Pill>
                  </div>
                  <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>Toca una talla para vender:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:isAdmin?14:8}}>
                    {p.tallas.map((t,ti)=>(
                      <button key={t.talla} disabled={t.stock===0} onClick={()=>{setVm({prod:p,ti,precioFinal:String(p.venta),onChange:(v)=>setVm(x=>({...x,precioFinal:v}))});setCant(1);}}
                        style={{background:t.stock===0?C.muted2:t.stock<=STOCK_BAJO?C.yeBg:C.grBg,border:`1.5px solid ${t.stock===0?C.border:t.stock<=STOCK_BAJO?"#FCD34D":C.grLt}`,borderRadius:10,padding:"8px 14px",cursor:t.stock===0?"default":"pointer",fontFamily:"inherit",opacity:t.stock===0?0.5:1,minWidth:52,textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:700,color:t.stock===0?C.muted:t.stock<=STOCK_BAJO?C.ye:C.gr}}>T{t.talla}</div>
                        <div style={{fontSize:10,color:t.stock===0?C.muted:t.stock<=STOCK_BAJO?C.ye:C.muted,marginTop:1}}>{t.stock}u</div>
                      </button>
                    ))}
                  </div>
                  {isAdmin&&(
                    <div>
                      <div style={{display:"flex",background:C.muted2,borderRadius:10,padding:"10px 14px",marginBottom:12}}>
                        {[["Compra","S/"+p.compra],["Venta ref.","S/"+p.venta],["Margen",mg(p.compra,p.venta)+"%"]].map(([l,val],i)=>(
                          <div key={i} style={{flex:1,borderRight:i<2?`1px solid ${C.border}`:"none",paddingRight:i<2?12:0,marginRight:i<2?12:0}}>
                            <div style={{fontSize:10,color:C.muted,marginBottom:3,fontWeight:500}}>{l}</div>
                            <div style={{fontSize:13,fontWeight:700,color:i===2?C.gr:C.txt}}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <Btn onClick={()=>openEdit(p)} v="secondary" full sm>✏ Editar</Btn>
                        {tot===0&&<Btn onClick={()=>doArch(p.id)} v="danger" full sm>Archivar</Btn>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {isAdmin&&archivados.length>0&&(
              <div style={{marginTop:8,marginBottom:16}}>
                <button onClick={()=>setVerArch(!verArch)} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"11px 16px",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"100%",textAlign:"left",fontWeight:500,display:"flex",justifyContent:"space-between"}}>
                  <span>Modelos archivados ({archivados.length})</span><span>{verArch?"▾":"▸"}</span>
                </button>
                {verArch&&archivados.map(p=>(
                  <div key={p.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"12px 16px",marginTop:8,opacity:0.7}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div><div style={{fontSize:11,color:C.muted,marginBottom:2}}>{p.sku} · {p.sede}</div><div style={{fontSize:13,fontWeight:600,color:C.muted}}>{p.nombre}</div><div style={{display:"flex",gap:4,marginTop:6,flexWrap:"wrap"}}>{p.tallas.map(t=><span key={t.talla} style={{fontSize:11,color:C.muted,background:C.muted2,border:`1px solid ${C.border}`,borderRadius:6,padding:"2px 8px"}}>T{t.talla}</span>)}</div></div>
                      <Btn onClick={()=>doArch(p.id)} v="secondary" sm>Restaurar</Btn>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {vista==="agregar"&&isAdmin&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,letterSpacing:-0.5}}>Nuevo producto</div>
              <button onClick={()=>fileRef.current.click()} style={{background:C.card,border:`1.5px solid ${C.border}`,borderRadius:10,padding:"8px 14px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:C.muted}}>↑ Import</button>
            </div>
            {limited&&<div style={{background:C.puBg,border:"1px solid #DDD6FE",borderRadius:12,padding:"12px 16px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{fontSize:12,color:C.pu,fontWeight:500}}>Límite plan Free ({PLAN_MAX} SKUs)</div><button onClick={()=>setUpModal(true)} style={{background:"none",border:"none",color:C.pu,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:700}}>Actualizar →</button></div>}
            {[{l:"Código / SKU (opcional)",k:"sku",t:"text",ph:"Ej: NIK-AIR-042",hint:"Se genera automáticamente si lo dejas vacío."},
              {l:"Nombre del producto *",k:"nombre",t:"text",ph:"Ej: Zapatilla Nike Air"},
              {l:"Sede / Ubicación",k:"sede",t:"text",ph:"Ej: Principal, Mercado Central",hint:"Útil si tienes varias tiendas."},
              {l:"Precio de compra (S/) *",k:"compra",t:"number",ph:"120.00"},
              {l:"Precio de venta ref. (S/) *",k:"venta",t:"number",ph:"200.00",hint:"Ajustable al momento de cada venta."}
            ].map(f=>(
              <div key={f.k} style={{marginBottom:14}}>
                <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:500}}>{f.l}</div>
                <input type={f.t} value={form[f.k]} placeholder={f.ph} onChange={e=>{const v=f.k==="sku"?e.target.value.toUpperCase():e.target.value;setForm(ff=>({...ff,[f.k]:v}));if(f.k==="sku")setSkuErr("");}}
                  style={{width:"100%",background:C.card,border:`1.5px solid ${f.k==="sku"&&skuErr?C.re:C.border}`,borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
                {f.k==="sku"&&skuErr&&<div style={{fontSize:11,color:C.re,marginTop:4}}>{skuErr}</div>}
                {f.hint&&!skuErr&&<div style={{fontSize:11,color:C.muted,marginTop:4}}>{f.hint}</div>}
              </div>
            ))}
            {form.compra&&form.venta&&parseFloat(form.venta)>parseFloat(form.compra)&&<div style={{background:C.grBg,border:`1px solid ${C.grLt}`,borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:13,color:C.gr,fontWeight:600}}>Margen estimado: {mg(parseFloat(form.compra),parseFloat(form.venta))}%</div>}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:500}}>Tallas y stock inicial</div>
              <input type="text" value={form.tallasInput} placeholder="Ej: 38:3,39:5,40:2  ó  S:4,M:6,L:2" onChange={e=>setForm(f=>({...f,tallasInput:e.target.value}))} style={{width:"100%",background:C.card,border:`1.5px solid ${C.border}`,borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
              <div style={{fontSize:11,color:C.muted,marginTop:4}}>Formato: talla:cantidad separados por coma.</div>
            </div>
            {form.tallasInput&&<div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:16}}>{parseTallas(form.tallasInput).map(t=><div key={t.talla} style={{background:C.grBg,border:`1px solid ${C.grLt}`,borderRadius:10,padding:"6px 14px",fontSize:13}}><span style={{color:C.gr,fontWeight:700}}>T{t.talla}</span> <span style={{color:C.muted}}>{t.stock}u</span></div>)}</div>}
            <Btn onClick={addProd} full>Agregar producto</Btn>
          </div>
        )}
      </div>

      {/* NAV */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:420,background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",padding:"8px 8px 12px",gap:4,boxShadow:"0 -4px 16px rgba(0,0,0,0.06)"}}>
        {navItems.map(({id,icon,label})=>(
          <button key={id} onClick={()=>setVista(id)} style={{flex:1,background:vista===id?C.grBg:"transparent",border:"none",cursor:"pointer",padding:"8px 4px",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:18,lineHeight:1}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:vista===id?700:500,color:vista===id?C.gr:C.muted,letterSpacing:0.3,textTransform:"uppercase"}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
