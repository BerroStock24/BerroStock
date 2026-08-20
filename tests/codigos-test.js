// Extrae de src/App.jsx la logica REAL de identificacion de productos:
// buscarProd (deteccion de duplicados), esCodigoBarras (a que campo va lo que
// se escanea) y generarSku (codigo interno automatico).
//
// El bug que motivo buscarProd: la busqueda estaba atada a la sede del
// formulario, que al escanear todavia esta vacia. El aviso "este producto ya
// existe" recien aparecia al bajar y elegir la sede, y si el producto estaba en
// otra sede no aparecia nunca.
const fs = require("fs");
const SRC = fs.readFileSync(require("path").join(__dirname,"..","src","App.jsx"),"utf8");

const sacarBloque = (firma) => {
  const i = SRC.indexOf(firma);
  if (i < 0) throw new Error("No se encontro en App.jsx: " + firma);
  const j = SRC.indexOf("\n};", i) + 3;
  return SRC.slice(i + firma.indexOf("=") + 1, j).trim().replace(/;$/,"");
};
const sacarLinea = (firma) => {
  const i = SRC.indexOf(firma);
  if (i < 0) throw new Error("No se encontro en App.jsx: " + firma);
  const l = SRC.slice(i, SRC.indexOf("\n", i));
  return l.slice(l.indexOf("=") + 1).trim().replace(/;$/,"");
};

const buscarProd     = eval("(" + sacarBloque("const buscarProd = (prods, sku, sede, barras) => {") + ")");
const generarSku     = eval("(" + sacarBloque("const generarSku = (nombre, lista) => {") + ")");
const esCodigoBarras = eval("(" + sacarLinea("const esCodigoBarras = (v) =>") + ")");

let fallas = 0;
const chk = (etq, real, esp) => {
  const pasa = JSON.stringify(real) === JSON.stringify(esp);
  if (!pasa) fallas++;
  console.log(`${pasa?"OK  ":"FALLA"} | ${etq}: ${JSON.stringify(real)}${pasa?"":"  (esperado "+JSON.stringify(esp)+")"}`);
};

// Inventario de prueba: el mismo modelo en dos sedes, y uno sin codigo de barras.
const INV = [
  {id:1, sku:"NIK-AIR-042", barras:"7750182001234", nombre:"Zapatilla Nike Air", sede:"Principal"},
  {id:2, sku:"NIK-AIR-042", barras:"7750182001234", nombre:"Zapatilla Nike Air", sede:"Tienda Centro"},
  {id:3, sku:"ADI-RUN-010", barras:"",              nombre:"Adidas Runner",      sede:"Tienda Centro"},
  {id:4, sku:"PUM-CLA-001", barras:"0036000291452", nombre:"Puma Clasica",       sede:"Deposito"},
];

console.log("═══ 1) EL BUG: encontrarlo aunque la sede este vacia ═══");
// Al escanear, form.sede todavia es "". Antes esto devolvia null si el producto
// no estaba en "Principal", y la duena no se enteraba de que ya existia.
chk("escaneo sin sede, producto en Deposito",
    (buscarProd(INV, "", "", "0036000291452")||{}).id, 4);
chk("escaneo sin sede, producto en Tienda Centro",
    (buscarProd(INV, "ADI-RUN-010", "", "")||{}).id, 3);
chk("tecleo sin sede, producto en Deposito",
    (buscarProd(INV, "PUM-CLA-001", "", "")||{}).id, 4);

console.log("\n═══ 2) Si esta en varias sedes prefiere la actual ═══");
// Es la que va a reponer: mostrarle la otra la haria pensar que se equivoco.
chk("estando en Principal devuelve el de Principal",
    (buscarProd(INV, "", "Principal", "7750182001234")||{}).id, 1);
chk("estando en Tienda Centro devuelve el de Tienda Centro",
    (buscarProd(INV, "", "Tienda Centro", "7750182001234")||{}).id, 2);
chk("sin sede cae en Principal por defecto",
    (buscarProd(INV, "", "", "7750182001234")||{}).id, 1);
chk("sede que no existe: devuelve el primero, no null",
    (buscarProd(INV, "", "Sede Nueva", "7750182001234")||{}).id, 1);
chk("sede a medio crear (__nueva__) se trata como vacia",
    (buscarProd(INV, "", "__nueva__", "7750182001234")||{}).id, 1);

console.log("\n═══ 3) Encuentra por cualquiera de los dos codigos ═══");
chk("solo por barras",  (buscarProd(INV, "", "", "7750182001234")||{}).id, 1);
chk("solo por codigo",  (buscarProd(INV, "NIK-AIR-042", "", "")||{}).id, 1);
chk("codigo en minusculas igual lo encuentra",
    (buscarProd(INV, "nik-air-042", "", "")||{}).id, 1);
chk("producto sin barras se encuentra por codigo",
    (buscarProd(INV, "ADI-RUN-010", "", "")||{}).id, 3);

console.log("\n═══ 4) Lo que NO debe encontrar ═══");
chk("codigo inexistente",        buscarProd(INV, "NO-EXISTE", "", ""), null);
chk("barras inexistente",        buscarProd(INV, "", "", "9999999999999"), null);
chk("los dos vacios",            buscarProd(INV, "", "", ""), null);
chk("inventario vacio",          buscarProd([], "NIK-AIR-042", "", ""), null);
// Clave: barras vacio NO debe emparejar con los productos que tampoco tienen.
chk("barras vacio no matchea productos sin barras",
    buscarProd(INV, "", "", ""), null);

console.log("\n═══ 5) A que campo va lo que se escanea ═══");
chk("GTIN-13 es codigo de barras", esCodigoBarras("7750182001234"), true);
chk("EAN-8 es codigo de barras",   esCodigoBarras("96385074"),      true);
chk("UPC-A es codigo de barras",   esCodigoBarras("036000291452"),  true);
chk("codigo propio con letras no", esCodigoBarras("NIK-AIR-042"),   false);
chk("numero corto no",             esCodigoBarras("4042"),          false);
chk("vacio no",                    esCodigoBarras(""),              false);
chk("nulo no revienta",            esCodigoBarras(null),            false);

console.log("\n═══ 6) Codigo interno automatico ═══");
chk("del nombre del producto", generarSku("Zapatilla Nike", []), "ZAP-0001");
chk("evita el que ya existe",  generarSku("Zapatilla Nike", [{sku:"ZAP-0001"}]), "ZAP-0002");
chk("salta varios ocupados",   generarSku("Zapatilla Nike", [{sku:"ZAP-0001"},{sku:"ZAP-0002"}]), "ZAP-0003");
chk("ignora numeros del nombre", generarSku("360 Grados", []), "GRA-0001");
chk("nombre sin letras usa PRD", generarSku("2024", []), "PRD-0001");
chk("nombre vacio usa PRD",      generarSku("", []), "PRD-0001");
chk("no distingue mayusculas",   generarSku("zapatilla", [{sku:"zap-0001"}]), "ZAP-0002");

console.log(fallas === 0 ? "\nTodo OK." : "\n" + fallas + " fallas.");
process.exit(fallas === 0 ? 0 : 1);
