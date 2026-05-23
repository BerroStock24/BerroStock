import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

const HOY   = new Date();
const MES   = HOY.getMonth();
const ANIO  = HOY.getFullYear();
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const STOCK_BAJO = 3;
const PLAN_MAX   = 5;

const totalStock = (p) => p.tallas.reduce((a,t) => a+t.stock, 0);
const mg         = (c,v) => (((v-c)/c)*100).toFixed(0);
const esHoy      = (f)   => { const d=new Date(f); return d.getDate()===HOY.getDate()&&d.getMonth()===MES&&d.getFullYear()===ANIO; };
const parseTallas= (s)   => { if(!s.trim()) return [{talla:"ÚNICA",stock:0}]; return s.split(",").map(x=>{const p=x.trim().split(":");return{talla:p[0].trim().toUpperCase(),stock:parseInt(p[1])||0};}).filter(t=>t.talla); };
const fmtFecha   = (iso) => { try { return new Date(iso).toLocaleDateString("es-PE",{day:"numeric",month:"short",year:"numeric"}); } catch { return "—"; } };
const fmtHora    = (iso) => { try { return new Date(iso).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}); } catch { return ""; } };
const LS = {
  get: (k,d) => { try { const v=localStorage.getItem(k); return v?JSON.parse(v):d; } catch { return d; } },
  set: (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} },
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
const IS   = {width:"100%",background:C.muted2,border:"1.5px solid "+C.border,borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"};

// ── ANIMATED LOGO (fully hardcoded SVG — no computed expressions) ──
const AnimatedLogo = () => (
  <svg width="200" height="210" viewBox="60 42 180 192" style={{overflow:"visible"}}>
    <defs>
      <filter id="gs"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="gm"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="gl"><feGaussianBlur stdDeviation="16" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <linearGradient id="fT" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6ee7b7" stopOpacity="0.65"/>
        <stop offset="100%" stopColor="#059669" stopOpacity="0.25"/>
      </linearGradient>
      <linearGradient id="fL" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.45"/>
        <stop offset="100%" stopColor="#022c22" stopOpacity="0.65"/>
      </linearGradient>
      <linearGradient id="fR" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#34d399" stopOpacity="0.5"/>
        <stop offset="100%" stopColor="#022c22" stopOpacity="0.65"/>
      </linearGradient>
      <radialGradient id="aG" cx="50%" cy="60%" r="50%">
        <stop offset="0%" stopColor="#10b981" stopOpacity="0.28"/>
        <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
      </radialGradient>
    </defs>

    <ellipse cx="150" cy="175" rx="105" ry="58" fill="url(#aG)">
      <animate attributeName="opacity" values="0.7;1;0.7" dur="3s" repeatCount="indefinite"/>
    </ellipse>

    <polygon points="150,52 228,96 150,140 72,96"  fill="url(#fT)" stroke="none"/>
    <polygon points="72,96 150,140 150,220 72,180"  fill="url(#fL)" stroke="none"/>
    <polygon points="228,96 150,140 150,220 228,180" fill="url(#fR)" stroke="none"/>

    <line x1="124" y1="71" x2="202" y2="111" stroke="#a7f3d0" strokeWidth="0.8" opacity="0.5"/>
    <line x1="98"  y1="85" x2="176" y2="125" stroke="#a7f3d0" strokeWidth="0.8" opacity="0.5"/>
    <line x1="176" y1="71" x2="98"  y2="111" stroke="#a7f3d0" strokeWidth="0.8" opacity="0.5"/>
    <line x1="202" y1="85" x2="124" y2="125" stroke="#a7f3d0" strokeWidth="0.8" opacity="0.5"/>
    <circle cx="150" cy="84"  r="2.5" fill="#a7f3d0" filter="url(#gs)" opacity="0.8"/>
    <circle cx="177" cy="98"  r="2.5" fill="#a7f3d0" filter="url(#gs)" opacity="0.8"><animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="123" cy="98"  r="2.5" fill="#a7f3d0" filter="url(#gs)" opacity="0.8"/>
    <circle cx="150" cy="112" r="2.5" fill="#a7f3d0" filter="url(#gs)"><animate attributeName="opacity" values="0.8;0.3;0.8" dur="2.3s" repeatCount="indefinite"/></circle>

    <line x1="72"  y1="124" x2="150" y2="165" stroke="#10b981" strokeWidth="0.75" opacity="0.5"/>
    <line x1="72"  y1="152" x2="150" y2="193" stroke="#10b981" strokeWidth="0.75" opacity="0.5"/>
    <line x1="98"  y1="111" x2="98"  y2="193" stroke="#10b981" strokeWidth="0.75" opacity="0.45"/>
    <line x1="124" y1="125" x2="124" y2="207" stroke="#10b981" strokeWidth="0.75" opacity="0.45"/>
    <circle cx="98"  cy="138" r="2.2" fill="#6ee7b7" filter="url(#gs)" opacity="0.75"/>
    <circle cx="124" cy="152" r="2.2" fill="#6ee7b7" filter="url(#gs)"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="98"  cy="166" r="2.2" fill="#6ee7b7" filter="url(#gs)" opacity="0.75"/>
    <circle cx="124" cy="180" r="2.2" fill="#6ee7b7" filter="url(#gs)"><animate attributeName="opacity" values="0.9;0.4;0.9" dur="2.1s" repeatCount="indefinite"/></circle>

    <polygon points="92,141 130,160 130,190 92,170" fill="rgba(16,185,129,0.18)" stroke="#00e5b0" strokeWidth="1.4" filter="url(#gs)"/>
    <polygon points="101,150 121,161 121,175 101,164" fill="rgba(0,229,176,0.1)" stroke="#00e5b0" strokeWidth="0.9"/>
    <line x1="106" y1="154" x2="106" y2="168" stroke="#6ee7b7" strokeWidth="0.8" opacity="0.6"/>
    <line x1="114" y1="158" x2="114" y2="172" stroke="#6ee7b7" strokeWidth="0.8" opacity="0.6"/>
    <line x1="101" y1="160" x2="121" y2="170" stroke="#6ee7b7" strokeWidth="0.8" opacity="0.5"/>
    <circle cx="111" cy="165" r="6" fill="#10b981" filter="url(#gm)"><animate attributeName="opacity" values="0.5;1;0.5" dur="1.5s" repeatCount="indefinite"/></circle>
    <circle cx="111" cy="165" r="2.5" fill="#fff" filter="url(#gs)"/>
    <line x1="86" y1="152" x2="92" y2="155" stroke="#00e5b0" strokeWidth="0.9" opacity="0.75"/>
    <line x1="86" y1="162" x2="92" y2="165" stroke="#00e5b0" strokeWidth="0.9" opacity="0.75"/>
    <line x1="86" y1="172" x2="92" y2="175" stroke="#00e5b0" strokeWidth="0.9" opacity="0.75"/>
    <circle cx="141" cy="181" r="14" fill="#10b981" filter="url(#gl)" opacity="0.25"/>
    <circle cx="141" cy="181" r="6"  fill="#34d399" filter="url(#gm)"><animate attributeName="opacity" values="0.6;1;0.6" dur="1.2s" repeatCount="indefinite"/></circle>
    <circle cx="141" cy="181" r="2.5" fill="#fff" filter="url(#gm)"/>

    <line x1="228" y1="124" x2="150" y2="165" stroke="#34d399" strokeWidth="0.75" opacity="0.45"/>
    <line x1="228" y1="152" x2="150" y2="193" stroke="#34d399" strokeWidth="0.75" opacity="0.45"/>
    <line x1="202" y1="111" x2="202" y2="193" stroke="#34d399" strokeWidth="0.75" opacity="0.4"/>
    <line x1="176" y1="125" x2="176" y2="207" stroke="#34d399" strokeWidth="0.75" opacity="0.4"/>
    <circle cx="202" cy="138" r="2.2" fill="#34d399" filter="url(#gs)" opacity="0.7"/>
    <circle cx="176" cy="152" r="2.2" fill="#34d399" filter="url(#gs)"><animate attributeName="opacity" values="0.9;0.3;0.9" dur="1.9s" repeatCount="indefinite"/></circle>
    <circle cx="202" cy="166" r="2.2" fill="#34d399" filter="url(#gs)" opacity="0.7"/>
    <circle cx="176" cy="180" r="2.2" fill="#34d399" filter="url(#gs)"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.2s" repeatCount="indefinite"/></circle>

    <g stroke="rgba(167,243,208,0.15)" strokeWidth="3" fill="none" filter="url(#gl)">
      <line x1="150" y1="52"  x2="228" y2="96"/><line x1="150" y1="52"  x2="72"  y2="96"/>
      <line x1="72"  y1="96"  x2="72"  y2="180"/><line x1="228" y1="96"  x2="228" y2="180"/>
      <line x1="150" y1="140" x2="150" y2="220"/><line x1="72"  y1="180" x2="150" y2="220"/>
      <line x1="228" y1="180" x2="150" y2="220"/><line x1="228" y1="96"  x2="150" y2="140"/>
      <line x1="72"  y1="96"  x2="150" y2="140"/>
    </g>
    <g stroke="rgba(167,243,208,0.55)" strokeWidth="2" fill="none" filter="url(#gm)">
      <line x1="150" y1="52"  x2="228" y2="96"/><line x1="150" y1="52"  x2="72"  y2="96"/>
      <line x1="72"  y1="96"  x2="72"  y2="180"/><line x1="228" y1="96"  x2="228" y2="180"/>
      <line x1="150" y1="140" x2="150" y2="220"/><line x1="72"  y1="180" x2="150" y2="220"/>
      <line x1="228" y1="180" x2="150" y2="220"/><line x1="228" y1="96"  x2="150" y2="140"/>
      <line x1="72"  y1="96"  x2="150" y2="140"/>
    </g>
    <g stroke="#a7f3d0" strokeWidth="1.2" fill="none" filter="url(#gs)">
      <line x1="150" y1="52"  x2="228" y2="96"/><line x1="150" y1="52"  x2="72"  y2="96"/>
      <line x1="72"  y1="96"  x2="72"  y2="180"/><line x1="228" y1="96"  x2="228" y2="180"/>
      <line x1="150" y1="140" x2="150" y2="220"/><line x1="72"  y1="180" x2="150" y2="220"/>
      <line x1="228" y1="180" x2="150" y2="220"/><line x1="228" y1="96"  x2="150" y2="140"/>
      <line x1="72"  y1="96"  x2="150" y2="140"/>
    </g>

    <circle cx="150" cy="52"  r="5"   fill="#a7f3d0" filter="url(#gl)"><animate attributeName="r" values="4;6.5;4" dur="2s" repeatCount="indefinite"/></circle>
    <circle cx="150" cy="52"  r="2.5" fill="#fff"    filter="url(#gm)"/>
    <circle cx="228" cy="96"  r="4"   fill="#a7f3d0" filter="url(#gm)"/><circle cx="228" cy="96"  r="1.8" fill="#fff" filter="url(#gs)"/>
    <circle cx="72"  cy="96"  r="4"   fill="#a7f3d0" filter="url(#gm)"/><circle cx="72"  cy="96"  r="1.8" fill="#fff" filter="url(#gs)"/>
    <circle cx="150" cy="140" r="4.5" fill="#a7f3d0" filter="url(#gm)"><animate attributeName="opacity" values="0.6;1;0.6" dur="1.8s" repeatCount="indefinite"/></circle>
    <circle cx="150" cy="140" r="2"   fill="#fff"    filter="url(#gs)"/>
    <circle cx="72"  cy="180" r="3"   fill="#6ee7b7" filter="url(#gm)" opacity="0.7"/>
    <circle cx="228" cy="180" r="3"   fill="#34d399" filter="url(#gm)" opacity="0.7"/>
    <circle cx="150" cy="220" r="3.5" fill="#a7f3d0" filter="url(#gm)"><animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.3s" repeatCount="indefinite"/></circle>

    <ellipse cx="150" cy="140" rx="90" ry="22" fill="none" stroke="rgba(52,211,153,0.25)" strokeWidth="1.2" strokeDasharray="6 5"/>
    <g><animateTransform attributeName="transform" type="rotate" from="0 150 140" to="360 150 140" dur="4s" repeatCount="indefinite"/>
      <circle cx="240" cy="140" r="5" fill="#34d399" filter="url(#gm)"/>
    </g>
    <g><animateTransform attributeName="transform" type="rotate" from="180 150 140" to="540 150 140" dur="4s" repeatCount="indefinite"/>
      <circle cx="240" cy="140" r="3" fill="#6ee7b7" filter="url(#gs)" opacity="0.6"/>
    </g>
  </svg>
);

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

  const BG = {minHeight:"100vh",maxWidth:420,margin:"0 auto",fontFamily:"'DM Sans',system-ui,sans-serif",display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#081c12 0%,#060e0c 45%,#06091a 100%)",position:"relative",overflow:"hidden"};

  if (!rol) return (
    <div style={BG}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap'); @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}} .a1{animation:fadeUp .5s ease .05s both} .a2{animation:fadeUp .5s ease .2s both} .a3{animation:fadeUp .5s ease .35s both} .a4{animation:fadeUp .5s ease .5s both} .roleBtn:active{transform:scale(0.98)}"}</style>
      <div style={{position:"absolute",top:-60,right:-60,width:240,height:240,borderRadius:"50%",background:"radial-gradient(circle,rgba(16,185,129,0.1) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:80,left:-80,width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,rgba(5,150,105,0.07) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 28px 24px"}}>
        <div className="a1" style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:28}}>
          <AnimatedLogo/>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:32,fontWeight:800,letterSpacing:-1,color:"#f0fdf4",marginTop:4,lineHeight:1}}>Berro<span style={{color:"#34d399"}}>Stock</span></div>
          <div style={{fontSize:11,color:"#4b7a62",marginTop:6,letterSpacing:2,textTransform:"uppercase",fontWeight:500}}>Control de inventario inteligente</div>
        </div>
        <div className="a2" style={{display:"flex",gap:24,marginBottom:32}}>
          {[["📦","Stock"],["📍","Multi-sede"],["📊","Reportes"]].map(([icon,label]) => (
            <div key={label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
              <div style={{fontSize:20}}>{icon}</div>
              <div style={{fontSize:10,color:"#4b7a62",fontWeight:500,letterSpacing:0.5,textTransform:"uppercase"}}>{label}</div>
            </div>
          ))}
        </div>
        <div className="a3" style={{width:"100%",marginBottom:12}}>
          <div style={{fontSize:11,color:"#4b7a62",textAlign:"center",marginBottom:14,fontWeight:600,letterSpacing:1.5,textTransform:"uppercase"}}>¿Quién eres?</div>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[
              {r:"admin",    icon:"👑", title:"Dueña / Admin",  sub:"Ganancias, reportes y configuración", acc:"rgba(124,58,237,0.12)", brd:"rgba(124,58,237,0.3)"},
              {r:"vendedora",icon:"🛍️",title:"Vendedora",       sub:"Stock, ventas y reposición",          acc:"rgba(16,185,129,0.1)",  brd:"rgba(52,211,153,0.3)"},
            ].map(x => (
              <button key={x.r} className="roleBtn" onClick={() => setRol(x.r)}
                style={{background:x.acc,border:"1px solid "+x.brd,borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14,transition:"all 0.15s"}}>
                <div style={{width:44,height:44,background:"rgba(255,255,255,0.05)",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{x.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#f0fdf4"}}>{x.title}</div>
                  <div style={{fontSize:12,color:"#4b7a62",marginTop:2}}>{x.sub}</div>
                </div>
                <span style={{color:"#34d399",fontSize:18,opacity:0.5}}>›</span>
              </button>
            ))}
          </div>
        </div>
        <div className="a4" style={{fontSize:11,color:"rgba(75,122,98,0.4)",marginTop:8}}>BerroStock v1.0 · Hecho en Perú 🇵🇪</div>
      </div>
    </div>
  );

  const acc = rol === "admin" ? "#7c3aed" : "#10b981";
  return (
    <div style={BG}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;600;700&display=swap');"}</style>
      <div style={{flex:1,display:"flex",flexDirection:"column",padding:"28px"}}>
        <button onClick={() => { setRol(null); setPin(""); setErr(false); }}
          style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",color:"#4b7a62",fontSize:13,cursor:"pointer",fontFamily:"inherit",borderRadius:10,padding:"8px 16px",alignSelf:"flex-start"}}>
          ← Volver
        </button>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:56,height:56,background:acc+"18",border:"1.5px solid "+acc+"50",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,marginBottom:16}}>
            {rol === "admin" ? "👑" : "🛍️"}
          </div>
          <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,color:"#f0fdf4",marginBottom:4}}>{rol==="admin"?"Dueña / Admin":"Vendedora"}</div>
          <div style={{fontSize:13,color:err?"#f87171":"#4b7a62",marginBottom:28,transition:"color 0.2s"}}>{err?"PIN incorrecto. Intenta de nuevo.":"Ingresa tu PIN"}</div>
          <div style={{display:"flex",gap:16,marginBottom:36}}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{width:13,height:13,borderRadius:"50%",background:pin.length>i?(err?"#ef4444":acc):"rgba(255,255,255,0.12)",transition:"all 0.15s",transform:pin.length>i?"scale(1.2)":"scale(1)",boxShadow:pin.length>i?"0 0 10px "+acc+"80":"none"}}/>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,width:240}}>
            {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i) => (
              <button key={i} onClick={() => k && tap(k)}
                style={{background:k?"rgba(255,255,255,0.06)":"transparent",border:k?"1px solid rgba(255,255,255,0.08)":"none",borderRadius:14,padding:"16px 0",fontSize:k==="del"?18:20,fontWeight:k==="del"?400:600,cursor:k?"pointer":"default",fontFamily:"inherit",color:"#f0fdf4"}}>
                {k==="del"?"⌫":k}
              </button>
            ))}
          </div>
          <div style={{marginTop:20,fontSize:11,color:"rgba(75,122,98,0.4)"}}>{rol==="admin"?"PIN por defecto: 1234":"PIN por defecto: 0000"}</div>
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
  const s = {primary:{background:C.gr,color:"#fff",border:"none"},secondary:{background:C.muted2,color:C.txt,border:"1px solid "+C.border},danger:{background:C.reBg,color:C.re,border:"1px solid #FCA5A5"}};
  return <button onClick={onClick} disabled={disabled} style={{...(s[v||"primary"]),borderRadius:12,padding:sm?"8px 16px":"13px 20px",fontWeight:600,fontSize:sm?12:14,cursor:disabled?"not-allowed":"pointer",fontFamily:"inherit",width:full?"100%":"auto",opacity:disabled?0.5:1}}>{children}</button>;
};
const Sheet = ({children}) => (
  <div style={{position:"fixed",inset:0,background:"rgba(26,26,24,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:100}}>
    <div style={{background:C.card,borderRadius:"24px 24px 0 0",padding:24,width:"100%",maxWidth:420,boxShadow:"0 -8px 32px rgba(0,0,0,0.12)",maxHeight:"92vh",overflowY:"auto"}}>
      <div style={{width:40,height:4,background:C.border,borderRadius:4,margin:"0 auto 20px"}}/>
      {children}
    </div>
  </div>
);

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
      {tipos.length===0 && <div style={{background:C.muted2,borderRadius:12,padding:"14px 16px",marginBottom:12,textAlign:"center",color:C.muted,fontSize:13}}>Sin tipos aún. Agrega uno abajo 👇</div>}
      {tipos.map((t,i) => (
        <div key={t.talla} style={{display:"flex",alignItems:"center",gap:10,background:C.card,border:"1px solid "+C.border,borderRadius:12,padding:"10px 14px",marginBottom:8}}>
          <div style={{flex:1,fontSize:14,fontWeight:700}}>{t.talla}</div>
          <button onClick={() => upd(i,-1)} style={{width:32,height:32,borderRadius:8,background:C.muted2,border:"1px solid "+C.border,fontSize:18,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
          <div style={{width:36,textAlign:"center",fontSize:18,fontWeight:700,color:t.stock>0?C.gr:C.muted}}>{t.stock}</div>
          <button onClick={() => upd(i,+1)} style={{width:32,height:32,borderRadius:8,background:C.gr,border:"none",fontSize:18,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
          <button onClick={() => rem(i)} style={{width:32,height:32,borderRadius:8,background:C.reBg,border:"1px solid #FCA5A5",fontSize:14,cursor:"pointer",fontFamily:"inherit",color:C.re}}>✕</button>
        </div>
      ))}
      <div style={{display:"flex",gap:8,marginTop:4}}>
        <input value={newTipo} onChange={e => setNewTipo(e.target.value.toUpperCase())}
          onKeyDown={e => (e.key==="Enter"||e.key===",") && (e.preventDefault(), add())}
          placeholder="Ej: 38, 39, S, M, Rojo..."
          style={{flex:1,background:C.card,border:"1.5px solid "+C.border,borderRadius:10,padding:"11px 14px",color:C.txt,fontSize:14,outline:"none",fontFamily:"inherit"}}/>
        <button onClick={add} style={{background:C.gr,color:"#fff",border:"none",borderRadius:10,padding:"11px 18px",fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar</button>
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
      <div style={{background:C.grBg,borderRadius:12,padding:"10px 14px",marginBottom:18}}>
        <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{vm.prod.sku} · T{talla.talla} · {vm.prod.sede}</div>
        <div style={{fontSize:15,fontWeight:700}}>{vm.prod.nombre}</div>
      </div>
      <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>Cantidad</div>
      <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:18,background:C.muted2,borderRadius:16,padding:"8px 12px"}}>
        <button onClick={() => setCant(Math.max(1,cant-1))} style={{width:40,height:40,borderRadius:12,background:C.card,border:"1px solid "+C.border,fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
        <div style={{fontSize:28,fontWeight:700,flex:1,textAlign:"center"}}>{cant}</div>
        <button onClick={() => setCant(Math.min(talla.stock,cant+1))} style={{width:40,height:40,borderRadius:12,background:C.gr,border:"none",fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
      </div>
      <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:6}}>Precio de venta S/ <span style={{color:C.gr,fontSize:11}}>(ajustable)</span></div>
      <input type="number" value={vm.precioFinal} onChange={e => vm.onChange(e.target.value)} style={{...IS,fontSize:24,fontWeight:700,marginBottom:6}}/>
      {precio !== vm.prod.venta && <div style={{fontSize:12,color:precio>vm.prod.venta?C.gr:C.or,marginBottom:4}}>{precio>vm.prod.venta?"↑ Por encima":"↓ Por debajo"} del ref. S/{vm.prod.venta}</div>}
      {isAdmin && precio < vm.prod.compra && <div style={{fontSize:12,color:C.re,marginBottom:4}}>⚠ Debajo del costo</div>}
      <div style={{display:"flex",justifyContent:"space-between",background:C.muted2,borderRadius:12,padding:"10px 14px",marginBottom:18,marginTop:8}}>
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
          <button onClick={() => setConfDel(true)} style={{background:C.reBg,border:"1px solid #FCA5A5",color:C.re,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>🗑 Eliminar</button>
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
          <div style={{fontSize:11,color:C.or,marginBottom:8,background:C.orBg,borderRadius:8,padding:"6px 10px"}}>⚠ El stock solo se modifica desde Reponer o Ajuste para mantener trazabilidad.</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
            {editF.tallas.map(t => (
              <div key={t.talla} style={{background:C.grBg,border:"1px solid "+C.grLt,borderRadius:10,padding:"8px 14px",textAlign:"center"}}>
                <div style={{fontSize:13,fontWeight:700,color:C.gr}}>T{t.talla}</div>
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
              style={{background:C.gr,color:"#fff",border:"none",borderRadius:10,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar</button>
          </div>
          <div style={{fontSize:11,color:C.muted,marginTop:4}}>Solo puedes agregar tipos nuevos (arrancan en 0 unidades).</div>
        </div>
        <div style={{display:"flex",gap:10}}><Btn onClick={onClose} v="secondary">Cancelar</Btn><Btn onClick={onSave} full>Guardar cambios</Btn></div>
      </div>
    ) : (
      <div style={{textAlign:"center",padding:"8px 0"}}>
        <div style={{fontSize:36,marginBottom:12}}>⚠️</div>
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
        <div style={{fontSize:12,color:C.muted,marginTop:2}}>📍{src.sede} · {src.tallas.map(t=>"T"+t.talla+" "+t.stock+"u").join(" · ")}</div>
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
            style={{width:"100%",background:C.card,border:"1.5px solid "+C.gr,borderRadius:10,padding:"11px 14px",color:C.txt,fontSize:14,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
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
                  <div style={{fontSize:14,fontWeight:700}}>T{t.talla}</div>
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
                  <span>T{talla}</span>
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
            <div><div style={{fontSize:13,fontWeight:600}}>{d.nombre}</div><div style={{fontSize:11,color:C.muted}}>T{d.talla} · {d.unidades}u</div></div>
          </div>
          <div style={{textAlign:"right"}}><div style={{fontSize:10,color:C.muted,marginBottom:2}}>Ganancia</div><div style={{fontSize:14,color:C.gr,fontWeight:700}}>S/{(d.ganancia||0).toFixed(0)}</div></div>
        </div>
      ))}
    </div>
  );
}

function HoyView({ventasHoy, hist, isAdmin, planActivo, expExcel, doAnular}) {
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

  const VentaCard = ({v}) => (
    <div key={v.id} style={{background:v.anulada?C.muted2:C.card,border:"1px solid "+(v.anulada?C.border:C.border),borderRadius:14,padding:"14px 16px",marginBottom:10,opacity:v.anulada?0.6:1}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
        <div>
          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
            <div style={{fontSize:11,color:C.muted}}>{v.sku} · T{v.talla} · {v.sede}</div>
            {v.anulada && <span style={{background:C.reBg,color:C.re,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>ANULADA</span>}
          </div>
          <div style={{fontSize:14,fontWeight:600,textDecoration:v.anulada?"line-through":"none",color:v.anulada?C.muted:C.txt}}>{v.producto}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:15,color:v.anulada?C.muted:C.gr,fontWeight:700,textDecoration:v.anulada?"line-through":"none"}}>S/{(v.total||0).toFixed(0)}</div>
          {isAdmin && !v.anulada && v.precioVenta!==v.precioOriginal && <div style={{fontSize:11,color:v.precioVenta>v.precioOriginal?C.gr:C.or}}>{v.precioVenta>v.precioOriginal?"↑":"↓"} S/{v.precioVenta} (ref. S/{v.precioOriginal})</div>}
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",fontSize:12,color:C.muted}}>
        <span>{v.cantidad}u × S/{v.precioVenta} · {fmtHora(v.fecha)}{isAdmin && !v.anulada ? " · Gan: S/"+(v.ganancia||0).toFixed(0) : ""}</span>
        {!v.anulada && diaOffset===0 && (
          <button onClick={() => doAnular(v.id)}
            style={{background:C.reBg,border:"1px solid #FCA5A5",color:C.re,borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
            ↩ Anular
          </button>
        )}
        {v.anulada && v.fechaAnulacion && <span style={{fontSize:10,color:C.muted}}>Anulada {new Date(v.fechaAnulacion).toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"})}</span>}
      </div>
    </div>
  );

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
        {isAdmin && diaOffset===0 && <button onClick={() => expExcel("dia")} style={{background:planActivo?C.grBg:C.muted2,border:"1.5px solid "+(planActivo?C.gr:C.border),color:planActivo?C.gr:C.muted,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{planActivo?"↓":"🔒"} Excel</button>}
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
        <Card label="Ventas" value={activas.length}/>
        <Card label="Ingresos" value={"S/"+activas.reduce((a,v)=>a+(v.total||0),0).toFixed(0)}/>
        {isAdmin && <Card label="Ganancia" value={"S/"+activas.reduce((a,v)=>a+(v.ganancia||0),0).toFixed(0)} color={C.gr}/>}
      </div>

      {/* Sales list */}
      {ventasDia.length===0
        ? <div style={{background:C.card,borderRadius:16,padding:"40px 20px",textAlign:"center",border:"1px solid "+C.border}}><div style={{fontSize:32,marginBottom:8}}>🛍️</div><div style={{fontSize:14,color:C.muted}}>Sin ventas {diaOffset===0?"hoy":"este día"}.</div></div>
        : [...ventasDia].reverse().map(v => <VentaCard key={v.id} v={v}/>)
      }

      {anuladas.length>0 && (
        <div style={{fontSize:11,color:C.muted,textAlign:"center",marginTop:8}}>{anuladas.length} venta{anuladas.length!==1?"s":""} anulada{anuladas.length!==1?"s":""} este día</div>
      )}
    </div>
  );
}

function HistorialView({hist, isAdmin, planActivo, expExcel}) {
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
  const top = (() => { const ag={}; vMActivas.forEach(v => { const k=v.sku+"-T"+v.talla; if(!ag[k])ag[k]={nombre:v.producto,talla:v.talla,ganancia:0,unidades:0}; ag[k].ganancia+=(v.ganancia||0); ag[k].unidades+=(v.cantidad||0); }); return Object.entries(ag).sort((a,b)=>b[1].unidades-a[1].unidades).slice(0,5); })();
  const vD        = hDia ? vM.filter(v => new Date(v.fecha).getDate()===hDia) : [];
  const vDVentas  = vD.filter(v => v.tipo!=="ajuste" && !v.anulada);

  if (hDia) return (
    <div>
      <button onClick={() => setHDia(null)} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:20,fontWeight:500}}>← {MESES[hMes]} {hAnio}</button>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:20,fontWeight:800,marginBottom:20,letterSpacing:-0.5}}>{hDia} de {MESES[hMes]}</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
        <Card label="Ventas" value={vDVentas.length}/>
        <Card label="Ingresos" value={"S/"+vDVentas.reduce((a,v)=>a+(v.total||0),0).toFixed(0)}/>
        {isAdmin && <Card label="Ganancia" value={"S/"+vDVentas.reduce((a,v)=>a+(v.ganancia||0),0).toFixed(0)} color={C.gr}/>}
      </div>
      {vD.length===0
        ? <div style={{background:C.card,borderRadius:16,padding:"30px 20px",textAlign:"center",border:"1px solid "+C.border,color:C.muted,fontSize:14}}>Sin ventas este día.</div>
        : vD.map(v => (
          <div key={v.id} style={{background:v.anulada?C.muted2:v.tipo==="ajuste"?C.puBg:C.card,border:"1px solid "+(v.tipo==="ajuste"?C.pu:C.border),borderRadius:14,padding:"14px 16px",marginBottom:10,opacity:v.anulada?0.6:1}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <div>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:2}}>
                  <div style={{fontSize:11,color:C.muted}}>{v.sku} · T{v.talla}</div>
                  {v.anulada && <span style={{background:C.reBg,color:C.re,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>ANULADA</span>}
                  {v.tipo==="ajuste" && <span style={{background:C.puBg,color:C.pu,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:700}}>AJUSTE</span>}
                </div>
                <div style={{fontSize:14,fontWeight:600,textDecoration:v.anulada?"line-through":"none",color:v.anulada?C.muted:C.txt}}>{v.producto}</div>
              </div>
              <div style={{textAlign:"right"}}>
                {v.tipo==="ajuste"
                  ? <div style={{fontSize:13,color:C.pu,fontWeight:700}}>{v.cantidad>0?"+":""}{v.cantidad}u</div>
                  : <div style={{fontSize:15,color:v.anulada?C.muted:C.gr,fontWeight:700,textDecoration:v.anulada?"line-through":"none"}}>S/{(v.total||0).toFixed(0)}</div>
                }
              </div>
            </div>
            {v.tipo==="ajuste"
              ? <div style={{fontSize:12,color:C.pu}}>Ajuste: {v.cantidad>0?"+":""}{v.cantidad}u · {v.motivo} · {fmtHora(v.fecha)} · Stock: {v.stockAntes}→{v.stockDespues}u</div>
              : <div style={{fontSize:12,color:C.muted}}>{v.cantidad}u × S/{v.precioVenta} · {fmtHora(v.fecha)}{isAdmin && !v.anulada ? " · Gan: S/"+(v.ganancia||0).toFixed(0) : ""}</div>
            }
          </div>
        ))
      }
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
      {isAdmin && <button onClick={() => expExcel("mes",hMes,hAnio)} style={{background:planActivo?C.grBg:C.muted2,border:"1.5px solid "+(planActivo?C.gr:C.border),color:planActivo?C.gr:C.muted,borderRadius:10,padding:"8px 14px",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:20}}>{planActivo?"↓":"🔒"} Excel {MESES[hMes]}</button>}
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
      {/* Movimientos / audit trail */}
      {(() => {
        const movs = hist.filter(v => {
          const d=new Date(v.fecha);
          return d.getMonth()===hMes && d.getFullYear()===hAnio && (v.tipo==="ajuste" || v.anulada);
        });
        if(!movs.length) return null;
        return (
          <div style={{marginBottom:20}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Movimientos especiales</div>
            <div style={{background:C.card,borderRadius:16,border:"1px solid "+C.border,overflow:"hidden"}}>
              {[...movs].reverse().slice(0,10).map((v,i,arr) => (
                <div key={v.id} style={{padding:"12px 16px",borderBottom:i<arr.length-1?"1px solid "+C.border:"none",background:v.tipo==="ajuste"?C.puBg+"40":C.reBg+"40"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <div>
                      <span style={{fontSize:10,fontWeight:700,color:v.tipo==="ajuste"?C.pu:C.re,background:v.tipo==="ajuste"?C.puBg:C.reBg,borderRadius:6,padding:"1px 7px",marginRight:6}}>
                        {v.tipo==="ajuste"?"AJUSTE":"ANULADA"}
                      </span>
                      <span style={{fontSize:13,fontWeight:600}}>{v.producto}</span>
                    </div>
                    <span style={{fontSize:11,color:C.muted}}>{fmtFecha(v.fecha).split(" ").slice(0,2).join(" ")} {fmtHora(v.fecha)}</span>
                  </div>
                  <div style={{fontSize:12,color:C.muted,marginTop:4}}>
                    {v.tipo==="ajuste"
                      ? "T"+v.talla+" · "+(v.cantidad>0?"+":"")+v.cantidad+"u · "+v.motivo+" ("+v.stockAntes+"→"+v.stockDespues+"u)"
                      : "T"+v.talla+" · S/"+v.total.toFixed(0)+" anulada"
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Top del mes</div>
      <TopList data={top}/>
    </div>
  );
}

function DashboardView({activos, ventasMes, alertas, topMesData, planActivo, expInv, hist}) {
  const [showAlertas, setShowAlertas] = useState(false);

  const agotados  = activos.filter(p => totalStock(p)===0);
  const bajStock  = activos.filter(p => p.tallas.some(t=>t.stock>0&&t.stock<=STOCK_BAJO));
  const totalAlerts = agotados.length + bajStock.length;

  // Last 7 days revenue
  const semana = Array.from({length:7}, (_,i) => {
    const d = new Date(HOY);
    d.setDate(d.getDate() - (6-i));
    const vs = hist.filter(v => {
      const dv=new Date(v.fecha);
      return !v.anulada && v.tipo!=="ajuste" &&
        dv.getDate()===d.getDate()&&dv.getMonth()===d.getMonth()&&dv.getFullYear()===d.getFullYear();
    });
    return {
      label: i===6?"Hoy":d.toLocaleDateString("es-PE",{weekday:"short"}),
      total: vs.reduce((a,v)=>a+(v.total||0),0),
      isHoy: i===6,
    };
  });
  const maxSem = Math.max(...semana.map(d=>d.total),1);

  return (
    <div>
      <div style={{fontSize:13,color:C.muted,fontWeight:500,marginBottom:4}}>{HOY.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long"})}</div>
      <div style={{fontFamily:"'Syne',sans-serif",fontSize:22,fontWeight:800,marginBottom:20,letterSpacing:-0.5}}>Buen día 👑</div>

      {activos.length===0 && (
        <div style={{background:C.grBg,border:"1px solid "+C.grLt,borderRadius:16,padding:"20px 16px",marginBottom:20,textAlign:"center"}}>
          <div style={{fontSize:28,marginBottom:8}}>🚀</div>
          <div style={{fontSize:14,fontWeight:600,color:C.gr,marginBottom:4}}>¡Bienvenido a BerroStock!</div>
          <div style={{fontSize:13,color:C.muted}}>Ve a Stock → Agregar para ingresar tus primeros productos.</div>
        </div>
      )}

      {/* KPI cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
        <Card label="Invertido en stock" value={"S/"+activos.reduce((a,p)=>a+(p.compra||0)*totalStock(p),0).toFixed(0)} icon="💰"/>
        <Card label="Ganancia del mes"   value={"S/"+ventasMes.reduce((a,v)=>a+(v.ganancia||0),0).toFixed(0)} color={C.gr} icon="📈"/>
      </div>

      {/* Compact alerts row — tappable */}
      {totalAlerts>0 && (
        <button onClick={() => setShowAlertas(!showAlertas)}
          style={{width:"100%",background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"12px 16px",cursor:"pointer",fontFamily:"inherit",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,textAlign:"left"}}>
          <div style={{display:"flex",gap:12,alignItems:"center"}}>
            {agotados.length>0 && <span style={{background:C.reBg,color:C.re,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>🔴 {agotados.length} agotado{agotados.length!==1?"s":""}</span>}
            {bajStock.length>0 && <span style={{background:C.yeBg,color:C.ye,borderRadius:20,padding:"3px 10px",fontSize:12,fontWeight:600}}>⚠️ {bajStock.length} bajo stock</span>}
          </div>
          <span style={{color:C.muted,fontSize:14}}>{showAlertas?"▲":"▼"}</span>
        </button>
      )}
      {showAlertas && alertas.map(p => (
        <div key={p.id} style={{background:C.card,border:"1px solid "+C.border,borderLeft:"4px solid "+C.or,borderRadius:12,padding:"12px 14px",marginBottom:8}}>
          <div style={{fontSize:11,color:C.muted,marginBottom:2}}>{p.sku} · {p.sede}</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:8}}>{p.nombre}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {p.tallas.filter(t=>t.stock<=STOCK_BAJO).map(t=><Pill key={t.talla} color={t.stock===0?"re":"ye"}>T{t.talla}: {t.stock===0?"agotado":t.stock+"u"}</Pill>)}
          </div>
        </div>
      ))}

      {/* Weekly chart */}
      <div style={{background:C.card,borderRadius:16,padding:"16px 16px 12px",border:"1px solid "+C.border,marginBottom:16}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:14}}>Ingresos últimos 7 días</div>
        <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
          {semana.map((d,i) => {
            const h = Math.max((d.total/maxSem)*64, d.total>0?4:0);
            return (
              <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
                {d.total>0 && <div style={{fontSize:8,color:d.isHoy?C.gr:C.muted,fontWeight:700}}>S/{d.total>=1000?(d.total/1000).toFixed(1)+"k":d.total.toFixed(0)}</div>}
                <div style={{width:"100%",height:h,borderRadius:4,background:d.isHoy?C.gr:d.total>0?C.grLt:C.muted2}}/>
                <div style={{fontSize:9,color:d.isHoy?C.gr:C.muted,fontWeight:d.isHoy?700:400,textTransform:"capitalize"}}>{d.label}</div>
              </div>
            );
          })}
        </div>
        <div style={{fontSize:11,color:C.muted,marginTop:10,textAlign:"right"}}>Total semana: <b style={{color:C.txt}}>S/{semana.reduce((a,d)=>a+d.total,0).toFixed(0)}</b></div>
      </div>

      {/* Top del mes */}
      <div style={{fontSize:13,fontWeight:700,marginBottom:12}}>Top del mes</div>
      <TopList data={topMesData}/>
      <div style={{marginTop:20}}><Btn onClick={expInv} full v={planActivo?"primary":"secondary"}>{planActivo?"↓ ":"🔒 "}Exportar inventario (.xlsx)</Btn></div>
    </div>
  );
}

// ── APP ──
export default function App() {
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
  const [editM,  setEditM]    = useState(null);
  const [editF,  setEditF]    = useState({sku:"",nombre:"",compra:"",venta:"",sede:"",tallas:[]});
  const [confDel,setConfDel]  = useState(false);
  const [transferM,setTransferM] = useState(null);
  const [restockM, setRestockM]  = useState(null); // {prod, cantidades:{talla:""}, nuevoPrecio:""}
  const [masOpcM,  setMasOpcM]   = useState(null); // prod for "···" menu
  const [ajusteM,  setAjusteM]   = useState(null); // {prod, tallaIdx, delta:"", motivo:""}
  const fileRef = useRef();

  useEffect(() => { LS.set("bs_prods", prods); }, [prods]);
  useEffect(() => { LS.set("bs_hist",  hist);  }, [hist]);
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
  const sedes     = ["Todas",...new Set(activos.map(p => p.sede).filter(Boolean))];
  const alertas   = activos.filter(p => p.tallas.some(t => t.stock <= STOCK_BAJO));
  const filtrados = activos.filter(p => {
    const ms = p.nombre.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase());
    return ms && (sedeFil==="Todas" || p.sede===sedeFil);
  });
  const topMesData = (() => {
    const ag = {};
    ventasMes.forEach(v => { const k=v.sku+"-T"+v.talla; if(!ag[k])ag[k]={nombre:v.producto,talla:v.talla,ganancia:0,unidades:0}; ag[k].ganancia+=(v.ganancia||0); ag[k].unidades+=(v.cantidad||0); });
    return Object.entries(ag).sort((a,b) => b[1].unidades-a[1].unidades).slice(0,5);
  })();

  const addProd = () => {
    if (!form.nombre||!form.compra||!form.venta) return t_("Completa nombre, compra y venta","error");
    // Clean sede: __nueva__ means they clicked "Nueva" but didn't type yet
    const sedeReal = form.sede==="__nueva__" ? "" : form.sede;
    if (!sedeReal) { setForm(ff=>({...ff,sede:""})); }
    if (form.sku) {
      const dupe = prods.find(p => p.sku.toLowerCase()===form.sku.toLowerCase() && (p.sede||"Principal").toLowerCase()===(sedeReal||"Principal").toLowerCase());
      if (dupe) { setSkuErr("Este código ya existe en esta sede."); setSkuDupe(dupe); return; }
    }
    if (limited) return setUpModal(true);
    setSkuErr(""); setSkuDupe(null);
    const tFinal = form.tallas.length>0 ? form.tallas : [{talla:"ÚNICA",stock:0}];
    setProds([...prods, {id:Date.now(), sku:form.sku.toUpperCase()||("SKU-"+Date.now()), nombre:form.nombre, compra:parseFloat(form.compra), venta:parseFloat(form.venta), archivado:false, sede:sedeReal||"Principal", tallas:tFinal, fechaIngreso:new Date().toISOString()}]);
    setForm({sku:"",nombre:"",compra:"",venta:"",sede:"",tallas:[]});
    t_("Producto agregado ✓"); setVista("productos");
  };

  const doVenta = () => {
    const precio = parseFloat(vm.precioFinal) || vm.prod.venta;
    const talla  = vm.prod.tallas[vm.ti];
    if (cant > talla.stock) return t_("Stock insuficiente","error");
    setProds(prods.map(p => p.id!==vm.prod.id ? p : {...p, tallas:p.tallas.map((t,i) => i===vm.ti ? {...t,stock:t.stock-cant} : t)}));
    setHist([...hist, {id:Date.now(), producto:vm.prod.nombre, sku:vm.prod.sku, talla:talla.talla, sede:vm.prod.sede, cantidad:cant, precioVenta:precio, precioOriginal:vm.prod.venta, precioCompra:vm.prod.compra, total:precio*cant, ganancia:((precio-(vm.prod.compra||0))*cant), fecha:new Date().toISOString()}]);
    t_("Venta registrada ✓"); setVm(null); setCant(1);
  };

  const doAnular = (ventaId) => {
    const venta = hist.find(v => v.id === ventaId);
    if (!venta || venta.anulada) return;
    // Restore stock
    setProds(prods.map(p => {
      if (p.sku !== venta.sku || p.sede !== venta.sede) return p;
      return {...p, tallas: p.tallas.map(t => t.talla===venta.talla ? {...t, stock:t.stock+venta.cantidad} : t)};
    }));
    // Mark as anulada (keep in history)
    setHist(hist.map(v => v.id===ventaId ? {...v, anulada:true, fechaAnulacion:new Date().toISOString()} : v));
    t_("Venta anulada — stock repuesto ✓");
  };

  const doArch = (id) => {
    const p = prods.find(x => x.id===id);
    if (!p.archivado && totalStock(p)>0) return t_("Solo puedes archivar modelos sin stock","error");
    if (p.archivado && limited) return setUpModal(true);
    setProds(prods.map(x => x.id===id ? {...x,archivado:!x.archivado} : x));
    t_(p.archivado?"Restaurado ✓":"Archivado ✓");
  };

  const openEdit = (p) => { setEditF({sku:p.sku, nombre:p.nombre, compra:String(p.compra), venta:String(p.venta), sede:p.sede||"", tallas:[...p.tallas]}); setConfDel(false); setEditM(p); };
  const saveEdit = () => {
    if (!editF.nombre||!editF.compra||!editF.venta) return t_("Faltan campos","error");
    if (prods.some(p => p.sku.toLowerCase()===editF.sku.toLowerCase() && p.id!==editM.id && (p.sede||"Principal").toLowerCase()===(editF.sede||"Principal").toLowerCase())) return t_("Código ya existe en esta sede","error");
    setProds(prods.map(p => p.id!==editM.id ? p : {...p, sku:editF.sku.toUpperCase()||p.sku, nombre:editF.nombre, compra:parseFloat(editF.compra), venta:parseFloat(editF.venta), sede:editF.sede||p.sede, tallas:editF.tallas.length>0?editF.tallas:p.tallas}));
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
      tipo: "ajuste",
      producto: liveProd.nombre,
      sku: liveProd.sku,
      talla: talla.talla,
      sede: liveProd.sede,
      cantidad: delta,
      motivo: ajusteM.motivo,
      stockAntes: talla.stock,
      stockDespues: nuevoStock,
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
        compra: precioNuevo>0 ? precioNuevo : p.compra,
        venta:  ventaNueva>0  ? ventaNueva  : p.venta,
        fechaIngreso: new Date().toISOString()
      };
    }));
    setHist([...hist, {
      id: Date.now(), tipo:"ajuste",
      producto: liveProd.nombre, sku: liveProd.sku, sede: liveProd.sede,
      talla: "varios", cantidad: totalExistentes+totalNuevas,
      motivo: "Restock"+(precioNuevo>0?" · nuevo precio S/"+precioNuevo:""),
      stockAntes: totalStock(liveProd),
      stockDespues: totalStock(liveProd)+totalExistentes+totalNuevas,
      fecha: new Date().toISOString(),
    }]);
    setRestockM(null);
    t_("Restock registrado — +"+(totalExistentes+totalNuevas)+"u ✓");
  };

  const expExcel = (tipo, mes=MES, anio=ANIO) => {
    if (!pro) return setUpModal(true);
    const datos = tipo==="dia" ? ventasHoy : hist.filter(v => { const d=new Date(v.fecha); return d.getMonth()===mes&&d.getFullYear()===anio; });
    const tit   = tipo==="dia" ? ("Ventas_"+HOY.toLocaleDateString("es-PE").replace(/\//g,"-")) : ("Ventas_"+MESES[mes]+"_"+anio);
    const rows  = datos.map(v => ({"Código":v.sku,"Producto":v.producto,"Talla":v.talla,"Sede":v.sede||"—","Fecha":new Date(v.fecha).toLocaleDateString("es-PE"),"Cant":v.cantidad,"P.Orig":v.precioOriginal,"P.Venta":v.precioVenta,"Total":v.total,"Ganancia":v.ganancia.toFixed(2)}));
    rows.push({},{"Producto":"TOTAL","Cant":datos.reduce((a,v)=>a+(v.cantidad||0),0),"Total":datos.reduce((a,v)=>a+(v.total||0),0).toFixed(2),"Ganancia":datos.reduce((a,v)=>a+(v.ganancia||0),0).toFixed(2)});
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Ventas"); XLSX.writeFile(wb,tit+".xlsx");
    t_("Excel descargado ✓");
  };

  const expInv = () => {
    if (!pro) return setUpModal(true);
    const rows = [];
    activos.forEach(p => p.tallas.forEach(t => rows.push({"Código":p.sku,"Producto":p.nombre,"Sede":p.sede||"—","Talla":t.talla,"Stock":t.stock,"Compra":p.compra,"Venta":p.venta,"Margen%":mg(p.compra,p.venta),"Fecha Ingreso":fmtFecha(p.fechaIngreso)})));
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
      setImpMod({rows:rawRows, headers, modoImport:"sumar", reemplazar:false, colMap:{sku:det(["sku","codigo","cod","ref"]), nombre:det(["nombre","producto","name"]), talla:det(["talla","size","talle"]), stock:det(["stock","cantidad","qty"]), compra:det(["compra","costo","cost"]), venta:det(["venta","precio","price","pvp"]), sede:det(["sede","tienda","local","ubicacion"])}});
    };
    const r = new FileReader();
    if (ext==="csv") { r.onload=(ev)=>{ const lines=ev.target.result.trim().split("\n"); const hds=lines[0].split(",").map(h=>h.trim().replace(/"/g,"")); const rows=lines.slice(1).map(l=>{const v=l.split(",").map(x=>x.trim().replace(/"/g,""));const o={};hds.forEach((h,i)=>o[h]=v[i]||"");return o;}).filter(rw=>Object.values(rw).some(x=>x)); proc(rows); }; r.readAsText(file); }
    else { r.onload=(ev)=>{ const wb=XLSX.read(ev.target.result,{type:"array"}); proc(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""})); }; r.readAsArrayBuffer(file); }
    e.target.value = "";
  };

  const doImport = () => {
    const {rows, colMap, modoImport} = impMod;
    const reemplazar = modoImport === "reemplazar";
    const sumar      = modoImport === "sumar";
    if (!colMap.nombre) return t_("Necesitas columna nombre","error");
    const mapa = {};
    rows.forEach((r,i) => {
      const sku  = (r[colMap.sku]||"").toString().trim().toUpperCase()||("IMP-"+(Date.now()+i));
      const sede = (colMap.sede&&r[colMap.sede]) ? r[colMap.sede].toString().trim() : "Principal";
      const talla= (r[colMap.talla]||"UNICA").toString().trim().toUpperCase();
      const key  = sku+"||"+sede;
      if (!mapa[key]) mapa[key] = {id:Date.now()+i, sku, nombre:String(r[colMap.nombre]||"").trim(), compra:parseFloat(r[colMap.compra])||0, venta:parseFloat(r[colMap.venta])||0, archivado:false, sede, tallas:[], fechaIngreso:new Date().toISOString()};
      mapa[key].tallas.push({talla, stock:parseInt(r[colMap.stock])||0});
    });
    const nuevos = Object.values(mapa).filter(p => p.nombre);
    const dupes  = nuevos.filter(p => prods.some(x => x.sku===p.sku && x.sede===p.sede));
    const fresh  = nuevos.filter(p => !prods.some(x => x.sku===p.sku && x.sede===p.sede));
    if (sumar) {
      let u = [...prods];
      dupes.forEach(np => {
        const idx = u.findIndex(x => x.sku===np.sku && x.sede===np.sede);
        if (idx >= 0) {
          const ex = u[idx];
          const newTallas = [...ex.tallas];
          np.tallas.forEach(nt => {
            const ti = newTallas.findIndex(t => t.talla===nt.talla);
            if (ti >= 0) newTallas[ti] = {...newTallas[ti], stock: newTallas[ti].stock + nt.stock};
            else newTallas.push(nt);
          });
          u[idx] = {...ex, tallas:newTallas,
            compra: np.compra>0 ? np.compra : ex.compra,
            venta:  np.venta>0  ? np.venta  : ex.venta,
            fechaIngreso: new Date().toISOString()
          };
        }
      });
      setProds([...u, ...fresh.slice(0, pro?Infinity:Math.max(0,PLAN_MAX-activos.length))]);
    } else if (reemplazar) {
      let u=[...prods];
      dupes.forEach(np => { const idx=u.findIndex(x=>x.sku===np.sku&&x.sede===np.sede); if(idx>=0) u[idx]={...u[idx],...np,fechaIngreso:new Date().toISOString()}; });
      setProds([...u,...fresh.slice(0,pro?Infinity:Math.max(0,PLAN_MAX-activos.length))]);
    } else {
      setProds([...prods,...fresh.slice(0,pro?Infinity:Math.max(0,PLAN_MAX-activos.length))]);
    }
    setImpMod(null);
    const accion = sumar?"sumados":reemplazar?"reemplazados":"omitidos";
    t_(fresh.length+" nuevos"+(dupes.length>0?", "+dupes.length+" "+accion:""));
    setVista("productos");
  };

  const navAdmin = [{id:"dashboard",icon:"⊞",label:"Inicio"},{id:"productos",icon:"◫",label:"Stock"},{id:"ventas-hoy",icon:"○",label:"Hoy"},{id:"historial",icon:"◷",label:"Historial"},{id:"agregar",icon:"+",label:"Agregar"}];
  const navVend  = [{id:"productos",icon:"◫",label:"Stock"},{id:"ventas-hoy",icon:"○",label:"Mis ventas"}];
  const navItems = isAdmin ? navAdmin : navVend;

  if (!sesion) return <LoginScreen onLogin={handleLogin} pines={pines}/>;

  return (
    <div style={{background:C.bg,minHeight:"100vh",maxWidth:420,margin:"0 auto",fontFamily:"'DM Sans',system-ui,sans-serif",color:C.txt,paddingBottom:88}}>
      <style>{"@import url('https://fonts.googleapis.com/css2?family=Syne:wght@800&family=DM+Sans:wght@400;500;600;700&display=swap'); *{-webkit-tap-highlight-color:transparent} @keyframes toastIn{from{opacity:0;transform:translateX(-50%) scale(0.95)}to{opacity:1;transform:translateX(-50%) scale(1)}} input:focus{outline:none;border-color:"+C.gr+"!important;box-shadow:0 0 0 3px "+C.grBg+";}"}</style>

      {/* HEADER */}
      <div style={{background:C.card,padding:"14px 20px",borderBottom:"1px solid "+C.border,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,background:C.gr,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>📦</div>
          <div>
            <div style={{fontFamily:"'Syne',sans-serif",fontSize:18,fontWeight:800,letterSpacing:-0.5,lineHeight:1}}>BerroStock</div>
            <div style={{fontSize:10,color:C.muted,fontWeight:500}}>{isAdmin?"👑 Dueña":"🛍️ Vendedora"}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {isAdmin && <button onClick={() => setPinsMod(true)} style={{background:C.muted2,border:"1px solid "+C.border,borderRadius:8,padding:"5px 10px",fontSize:16,cursor:"pointer"}}>⚙️</button>}
          {isAdmin && <button onClick={() => setUpModal(true)} style={{background:plan==="pro"?C.puBg:plan==="trial"?C.grBg:C.muted2,border:"1.5px solid "+(plan==="pro"?C.pu:plan==="trial"?C.gr:C.border),color:plan==="pro"?C.pu:plan==="trial"?C.gr:C.muted,borderRadius:20,padding:"5px 12px",fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{plan==="pro"?"✦ PRO":plan==="trial"?"▷ TRIAL":"FREE"}</button>}
          <button onClick={() => setSesion(null)} style={{background:C.muted2,border:"1px solid "+C.border,borderRadius:8,padding:"5px 10px",fontSize:12,color:C.muted,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>Salir</button>
        </div>
      </div>

      {/* TOAST */}
      {toast && <div style={{position:"fixed",top:76,left:"50%",transform:"translateX(-50%)",background:toast.tipo==="error"?C.re:C.gr,color:"#fff",padding:"10px 20px",borderRadius:24,fontSize:13,fontWeight:600,zIndex:999,whiteSpace:"nowrap",boxShadow:shMd,animation:"toastIn 0.2s ease"}}>{toast.tipo==="error"?"✕ ":"✓ "}{toast.msg}</div>}

      {/* MODALS */}
      {vm         && <VentaModal vm={vm} cant={cant} setCant={setCant} isAdmin={isAdmin} onConfirm={doVenta} onClose={() => { setVm(null); setCant(1); }}/>}
      {editM      && <EditModal  editM={editM} editF={editF} setEditF={setEditF} confDel={confDel} setConfDel={setConfDel} onSave={saveEdit} onDelete={delProd} onClose={() => setEditM(null)}/>}
      {transferM  && <TransferModal transferM={transferM} setTransferM={setTransferM} prods={prods} onTransfer={doTransfer}/>}

      {/* AJUSTE MODAL */}
      {/* RESTOCK MODAL */}
      {restockM && (
        <Sheet>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>✚ Restock</div>
          <div style={{fontSize:12,color:C.muted,marginBottom:4}}>📅 {HOY.toLocaleDateString("es-PE",{day:"numeric",month:"long",year:"numeric"})} · {restockM.prod.nombre}</div>
          <div style={{fontSize:11,color:C.gr,marginBottom:16}}>Se registra automáticamente con la fecha de hoy.</div>

          <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:10}}>¿Cuántas unidades llegaron por tipo?</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {restockM.prod.tallas.map(t => (
              <div key={t.talla} style={{display:"flex",alignItems:"center",gap:12,background:C.muted2,borderRadius:12,padding:"12px 14px"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700}}>T{t.talla}</div>
                  <div style={{fontSize:11,color:C.muted}}>Stock actual: {t.stock}u</div>
                </div>
                <button onClick={() => setRestockM({...restockM, cantidades:{...restockM.cantidades,[t.talla]:String(Math.max(0,(parseInt(restockM.cantidades[t.talla])||0)-1))}})}
                  style={{width:36,height:36,borderRadius:10,background:C.card,border:"1px solid "+C.border,fontSize:18,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
                <div style={{width:36,textAlign:"center",fontSize:20,fontWeight:700,color:(parseInt(restockM.cantidades[t.talla])||0)>0?C.gr:C.muted}}>
                  {restockM.cantidades[t.talla]||"0"}
                </div>
                <button onClick={() => setRestockM({...restockM, cantidades:{...restockM.cantidades,[t.talla]:String((parseInt(restockM.cantidades[t.talla])||0)+1)}})}
                  style={{width:36,height:36,borderRadius:10,background:C.gr,border:"none",fontSize:18,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
              </div>
            ))}
          </div>

          {/* New tallas */}
          <div style={{marginBottom:16}}>
            <div style={{fontSize:12,color:C.muted,fontWeight:600,marginBottom:8}}>¿Llegan tallas nuevas? <span style={{fontWeight:400}}>(opcional)</span></div>
            {restockM.nuevasTallas.map((t,i) => (
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,background:C.muted2,borderRadius:10,padding:"8px 12px",marginBottom:8}}>
                <div style={{width:80,fontSize:13,fontWeight:700,color:C.gr}}>T{t.talla}</div>
                <button onClick={() => setRestockM({...restockM,nuevasTallas:restockM.nuevasTallas.map((x,j)=>j===i?{...x,stock:Math.max(0,x.stock-1)}:x)})}
                  style={{width:32,height:32,borderRadius:8,background:C.card,border:"1px solid "+C.border,fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>−</button>
                <div style={{width:32,textAlign:"center",fontSize:18,fontWeight:700,color:t.stock>0?C.gr:C.muted}}>{t.stock}</div>
                <button onClick={() => setRestockM({...restockM,nuevasTallas:restockM.nuevasTallas.map((x,j)=>j===i?{...x,stock:x.stock+1}:x)})}
                  style={{width:32,height:32,borderRadius:8,background:C.gr,border:"none",fontSize:16,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
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
              }} style={{background:C.gr,color:"#fff",border:"none",borderRadius:10,padding:"9px 14px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>+ Agregar</button>
            </div>
          </div>

          {/* Precios */}
          <div style={{display:"flex",gap:10,marginBottom:20}}>
            {[{label:"Precio de compra",key:"nuevoPrecio",prev:restockM.prod.compra},{label:"Precio de venta ref.",key:"nuevaVenta",prev:restockM.prod.venta}].map(f => (
              <div key={f.key} style={{flex:1}}>
                <div style={{fontSize:11,color:C.muted,fontWeight:600,marginBottom:6}}>{f.label} <span style={{fontWeight:400}}>(opcional)</span></div>
                <div style={{background:C.muted2,borderRadius:10,padding:"8px 12px",display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:12,color:C.muted}}>S/</span>
                  <input type="number" placeholder={String(f.prev)} value={restockM[f.key]}
                    onChange={e => setRestockM({...restockM,[f.key]:e.target.value})}
                    style={{flex:1,background:"transparent",border:"none",color:C.txt,fontSize:15,fontWeight:600,outline:"none",fontFamily:"inherit"}}/>
                </div>
                {restockM[f.key] && parseFloat(restockM[f.key])!==f.prev && (
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
              <div style={{width:40,height:40,background:C.muted2,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>✏️</div>
              <div><div style={{fontSize:14,fontWeight:600}}>Editar</div><div style={{fontSize:12,color:C.muted,marginTop:1}}>Cambiar nombre, precio de venta o precio de compra</div></div>
            </button>
            <button onClick={() => { setAjusteM({prod:masOpcM, tallaIdx:masOpcM.tallas.reduce((mi,t,i,arr)=>t.stock<arr[mi].stock?i:mi,0), delta:"", motivo:""}); setMasOpcM(null); }}
              style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:40,height:40,background:C.muted2,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📋</div>
              <div><div style={{fontSize:14,fontWeight:600}}>Corrección de conteo</div><div style={{fontSize:12,color:C.muted,marginTop:1}}>El número físico no coincide con el sistema</div></div>
            </button>
            <button onClick={() => { setTransferM({srcProd:masOpcM}); setMasOpcM(null); }}
              style={{background:C.card,border:"1px solid "+C.border,borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:40,height:40,background:C.muted2,borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>↔️</div>
              <div><div style={{fontSize:14,fontWeight:600}}>Trasladar</div><div style={{fontSize:12,color:C.muted,marginTop:1}}>Mover unidades de otra ubicación a esta</div></div>
            </button>
            {totalStock(masOpcM)===0 && (
              <button onClick={() => { doArch(masOpcM.id); setMasOpcM(null); }}
                style={{background:C.reBg,border:"1px solid #FCA5A5",borderRadius:14,padding:"16px 18px",cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:40,height:40,background:"#FEE2E2",borderRadius:12,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20}}>📦</div>
                <div><div style={{fontSize:14,fontWeight:600,color:C.re}}>Archivar</div><div style={{fontSize:12,color:C.re,opacity:0.7,marginTop:1}}>Ocultar producto sin stock</div></div>
              </button>
            )}
          </div>
          <button onClick={() => setMasOpcM(null)} style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:"12px 0",marginTop:8}}>Cancelar</button>
        </Sheet>
      )}

      {ajusteM && (
        <Sheet>
          <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>📋 Ajuste de inventario</div>
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
                  <div style={{fontSize:14,fontWeight:700,color:ajusteM.tallaIdx===i?C.gr:C.txt}}>T{t.talla}</div>
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
                style={{width:40,height:40,borderRadius:10,background:C.gr,border:"none",fontSize:20,cursor:"pointer",fontFamily:"inherit",fontWeight:600,color:"#fff"}}>+</button>
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

      {/* IMPORT MODAL */}
      {impMod && (
        <Sheet>
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
          {/* Duplicate detection */}
          {(() => {
            const seen = {};
            impMod.rows.forEach((r,i) => {
              const sku  = (r[impMod.colMap.sku]||"").toString().trim().toUpperCase()||("IMP-"+i);
              const sede = (impMod.colMap.sede&&r[impMod.colMap.sede]) ? r[impMod.colMap.sede].toString().trim() : "Principal";
              seen[sku+"||"+sede] = {sku, sede};
            });
            const dupes = Object.values(seen).filter(p => prods.some(x => x.sku===p.sku && x.sede===p.sede));
            if (!dupes.length) return null;
            return (
              <div style={{background:C.yeBg,border:"1px solid "+C.orLt,borderRadius:10,padding:"12px 14px",marginTop:14}}>
                <div style={{fontSize:12,color:C.ye,fontWeight:600,marginBottom:4}}>⚠ {dupes.length} producto(s) ya existen en el sistema</div>
                <div style={{fontSize:11,color:C.muted,marginBottom:10}}>{dupes.map(d => d.sku+" ("+d.sede+")").join(", ")}</div>
                <div style={{marginTop:4}}>
                  <div style={{fontSize:13,color:C.txt,fontWeight:500,marginBottom:12}}>¿Qué hago con el stock que trae el archivo?</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {[
                      {v:"sumar",  label:"Añadir al stock que ya tengo",  sub:"Suma las unidades y agrega tallas nuevas", icon:"✚"},
                      {v:"omitir", label:"Ignorar los que ya existen",     sub:"Solo entra lo completamente nuevo",        icon:"→"},
                    ].map(op => (
                      <button key={op.v} onClick={() => setImpMod({...impMod, modoImport:op.v})}
                        style={{padding:"14px 16px",borderRadius:12,border:"2px solid "+(impMod.modoImport===op.v?C.gr:C.border),background:impMod.modoImport===op.v?C.grBg:C.card,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:12,transition:"all 0.15s"}}>
                        <div style={{width:36,height:36,borderRadius:10,background:impMod.modoImport===op.v?C.gr:"rgba(0,0,0,0.04)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0,color:impMod.modoImport===op.v?"#fff":C.muted}}>{op.icon}</div>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:impMod.modoImport===op.v?C.gr:C.txt}}>{op.label}</div>
                          <div style={{fontSize:11,color:C.muted,marginTop:2}}>{op.sub}</div>
                        </div>
                        {impMod.modoImport===op.v && <div style={{marginLeft:"auto",color:C.gr,fontSize:20}}>✓</div>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
          {!pro && <div style={{fontSize:12,color:C.or,margin:"12px 0"}}>Plan Free: máx. {Math.max(0,PLAN_MAX-activos.length)} SKUs importables.</div>}
          <div style={{display:"flex",gap:10,marginTop:16}}><Btn onClick={() => setImpMod(null)} v="secondary">Cancelar</Btn><Btn onClick={doImport} full>Importar</Btn></div>
        </Sheet>
      )}

      {/* SETTINGS MODAL */}
      {pinsMod && (
        <Sheet>
          <div style={{fontSize:16,fontWeight:700,marginBottom:20}}>⚙️ PINs de acceso</div>
          {["admin","vendedora"].map(rol => (
            <div key={rol} style={{marginBottom:16}}>
              <div style={{fontSize:12,color:C.muted,marginBottom:6,fontWeight:500}}>{rol==="admin"?"PIN Dueña / Admin":"PIN Vendedora"}</div>
              <input type="tel" inputMode="numeric" pattern="[0-9]*" value={pines[rol]} onChange={e => setPines(p => ({...p,[rol]:e.target.value.slice(0,4)}))} style={{...IS,fontSize:22,fontWeight:700,letterSpacing:8}}/>
            </div>
          ))}
          <div style={{background:C.yeBg,border:"1px solid "+C.orLt,borderRadius:10,padding:"10px 14px",marginBottom:16,fontSize:12,color:C.ye}}>Guarda los PINs en un lugar seguro.</div>
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
              <button onClick={() => { setPlan("trial"); setUpModal(false); t_("Trial activado — 14 días gratis ✓"); }} style={{flex:1,padding:"14px 0",borderRadius:14,background:C.grBg,border:"1.5px solid "+C.gr,color:C.gr,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>Probar gratis<br/><span style={{fontSize:11,fontWeight:400,color:C.muted}}>14 días</span></button>
              <button onClick={() => { setPlan("pro"); setUpModal(false); t_("¡Bienvenido a PRO! ✦"); }} style={{flex:1,padding:"14px 0",borderRadius:14,background:C.pu,border:"none",color:"#fff",fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit",lineHeight:1.5}}>Activar PRO<br/><span style={{fontSize:11,fontWeight:400,opacity:0.8}}>S/ 15/mes</span></button>
            </div>
            <button onClick={() => setUpModal(false)} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",width:"100%",padding:"6px 0"}}>Continuar con Free</button>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{display:"none"}} onChange={handleFile}/>

      {/* VIEWS */}
      <div style={{padding:"20px 16px 0"}}>
        {vista==="dashboard"  && isAdmin && <DashboardView activos={activos} ventasMes={ventasMes} alertas={alertas} topMesData={topMesData} planActivo={pro} expInv={expInv} hist={hist}/>}
        {vista==="ventas-hoy" && <HoyView ventasHoy={ventasHoy} hist={hist} isAdmin={isAdmin} planActivo={pro} expExcel={expExcel} doAnular={doAnular}/>}
        {vista==="historial"  && isAdmin && <HistorialView hist={hist} isAdmin={isAdmin} planActivo={pro} expExcel={expExcel}/>}

        {vista==="productos" && (
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
                <div style={{fontSize:32,marginBottom:12}}>📦</div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>Sin productos aún</div>
                <div style={{fontSize:13,color:C.muted,marginBottom:20}}>Agrega tu primer producto o importa desde Excel.</div>
                {isAdmin && <Btn onClick={() => setVista("agregar")} sm>+ Agregar producto</Btn>}
              </div>
            )}
            {filtrados.map(p => {
              const tot = totalStock(p);
              return (
                <div key={p.id} style={{background:C.card,border:"1px solid "+(tot===0?C.orLt:C.border),borderRadius:16,padding:16,marginBottom:12,boxShadow:sh}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
                    <div>
                      <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}>
                        <span style={{fontSize:11,color:C.muted,fontWeight:500}}>{p.sku}</span>
                        {p.sede && <span style={{background:C.muted2,color:C.muted,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:600}}>📍{p.sede}</span>}
                        {isAdmin && p.fechaIngreso && <span style={{background:C.grBg,color:C.gr,borderRadius:6,padding:"1px 7px",fontSize:10,fontWeight:500}}>📅 {fmtFecha(p.fechaIngreso)}</span>}
                      </div>
                      <div style={{fontSize:15,fontWeight:700}}>{p.nombre}</div>
                    </div>
                    <Pill color={tot===0?"re":tot<=STOCK_BAJO?"ye":"gr"}>{tot===0?"Agotado":tot+"u"}</Pill>
                  </div>
                  <div style={{fontSize:12,color:C.muted,fontWeight:500,marginBottom:8}}>Toca un tipo para vender:</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:isAdmin?14:8}}>
                    {p.tallas.map((t,ti) => (
                      <button key={t.talla} disabled={t.stock===0} onClick={() => { setVm({prod:p, ti, precioFinal:String(p.venta), onChange:(v)=>setVm(x=>({...x,precioFinal:v}))}); setCant(1); }}
                        style={{background:t.stock===0?C.muted2:t.stock<=STOCK_BAJO?C.yeBg:C.grBg,border:"1.5px solid "+(t.stock===0?C.border:t.stock<=STOCK_BAJO?"#FCD34D":C.grLt),borderRadius:10,padding:"8px 14px",cursor:t.stock===0?"default":"pointer",fontFamily:"inherit",opacity:t.stock===0?0.5:1,minWidth:52,textAlign:"center"}}>
                        <div style={{fontSize:13,fontWeight:700,color:t.stock===0?C.muted:t.stock<=STOCK_BAJO?C.ye:C.gr}}>T{t.talla}</div>
                        <div style={{fontSize:10,color:C.muted,marginTop:1}}>{t.stock}u</div>
                      </button>
                    ))}
                  </div>
                  {isAdmin && (
                    <div>
                      <div style={{display:"flex",background:C.muted2,borderRadius:10,padding:"10px 14px",marginBottom:10}}>
                        {[["Compra","S/"+p.compra],["Venta ref.","S/"+p.venta],["Margen",mg(p.compra,p.venta)+"%"]].map(([l,val],i) => (
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

        {vista==="agregar" && isAdmin && (
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
                        <button key={s} onClick={() => setForm(ff=>({...ff,sede:s}))}
                          style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(form.sede===s?C.gr:C.border),background:form.sede===s?C.gr:C.card,color:form.sede===s?"#fff":C.txt,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:600}}>
                          {s}
                        </button>
                      ))}
                      <button onClick={() => setForm(ff=>({...ff,sede:"__nueva__"}))}
                        style={{padding:"8px 16px",borderRadius:20,border:"1.5px solid "+(form.sede==="__nueva__"||!sedes.filter(s=>s!=="Todas").includes(form.sede)&&form.sede&&form.sede!=="__nueva__"?C.gr:C.border),background:"transparent",color:C.muted,cursor:"pointer",fontFamily:"inherit",fontSize:13,fontWeight:500}}>
                        + Nueva
                      </button>
                    </div>
                    {(form.sede==="__nueva__" || (form.sede && !sedes.filter(s=>s!=="Todas").includes(form.sede))) && (
                      <input autoFocus value={form.sede==="__nueva__"?"":form.sede} placeholder="Ej: Tienda Centro, Depósito B..."
                        onChange={e => setForm(ff=>({...ff,sede:e.target.value}))}
                        style={{width:"100%",background:C.card,border:"1.5px solid "+C.gr,borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",marginTop:4}}/>
                    )}
                    <div style={{fontSize:11,color:C.muted,marginTop:4}}>Selecciona una existente o crea una nueva.</div>
                  </div>
                ) : (
                  <input type={f.t} value={form[f.k]} placeholder={f.ph}
                    onChange={e => { const v=f.k==="sku"?e.target.value.toUpperCase():e.target.value; setForm(ff=>({...ff,[f.k]:v})); if(f.k==="sku"||f.k==="sede"){setSkuErr("");setSkuDupe(null);} }}
                    style={{width:"100%",background:C.card,border:"1.5px solid "+(f.k==="sku"&&skuErr?C.re:C.border),borderRadius:12,padding:"12px 14px",color:C.txt,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
                )}
                {f.k==="sku" && skuErr && (
                  <div style={{background:C.yeBg,border:"1px solid "+C.orLt,borderRadius:10,padding:"12px 14px",marginTop:8}}>
                    <div style={{fontSize:12,color:C.ye,fontWeight:600,marginBottom:6}}>⚠ {skuErr}</div>
                    <div style={{fontSize:12,color:C.muted,marginBottom:10}}>Para <b>nueva temporada</b> con distinto precio: edita el producto. Para <b>agregar stock</b>: usa ↔ Trasladar en Stock.</div>
                    {skuDupe && (
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        <button onClick={() => {
                          if(form.tallas.length>0){
                            const p=skuDupe;
                            const newTallas=[...p.tallas];
                            form.tallas.forEach(nt=>{const ti=newTallas.findIndex(t=>t.talla===nt.talla);if(ti>=0)newTallas[ti]={...newTallas[ti],stock:newTallas[ti].stock+nt.stock};else newTallas.push(nt);});
                            const compraNew=parseFloat(form.compra)||0;
                            const ventaNew=parseFloat(form.venta)||0;
                            setProds(prods.map(x=>x.id!==p.id?x:{...x,tallas:newTallas,compra:compraNew>0?compraNew:x.compra,venta:ventaNew>0?ventaNew:x.venta,fechaIngreso:new Date().toISOString()}));
                            setForm({sku:"",nombre:"",compra:"",venta:"",sede:"",tallas:[]});
                            setSkuErr("");setSkuDupe(null);
                            t_("Stock sumado a "+p.nombre+" ✓");setVista("productos");
                          } else { t_("Agrega al menos un tipo y cantidad","error"); }
                        }} style={{background:C.gr,color:"#fff",border:"none",borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>✚ Sumar stock a este producto</button>
                        <button onClick={() => { openEdit(skuDupe); setSkuErr(""); setSkuDupe(null); setVista("productos"); }} style={{background:C.muted2,color:C.txt,border:"1px solid "+C.border,borderRadius:8,padding:"9px 16px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:"inherit",width:"100%"}}>✏ Solo editar precio / tallas</button>
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
                <div style={{fontSize:11,color:C.gr,fontWeight:600,marginBottom:2}}>📅 Fecha de ingreso</div>
                <div style={{fontSize:14,fontWeight:700,color:C.txt}}>{HOY.toLocaleDateString("es-PE",{day:"numeric",month:"long",year:"numeric"})}</div>
              </div>
              <div style={{fontSize:11,color:C.gr,opacity:0.7}}>Se registra automáticamente</div>
            </div>
            <Btn onClick={addProd} full>Agregar producto</Btn>
          </div>
        )}
      </div>

      {/* NAV */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:420,background:C.card,borderTop:"1px solid "+C.border,display:"flex",padding:"8px 8px 12px",gap:4,boxShadow:"0 -4px 16px rgba(0,0,0,0.06)"}}>
        {navItems.map(({id,icon,label}) => (
          <button key={id} onClick={() => setVista(id)} style={{flex:1,background:vista===id?C.grBg:"transparent",border:"none",cursor:"pointer",padding:"8px 4px",borderRadius:12,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
            <span style={{fontSize:18,lineHeight:1}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:vista===id?700:500,color:vista===id?C.gr:C.muted,letterSpacing:0.3,textTransform:"uppercase"}}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
