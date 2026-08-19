# BerroStock

App de control de inventario y punto de venta para PYMEs peruanas (zapaterías, tiendas de ropa, accesorios, bodegas). Diseñada como **PWA mobile-first** con layout responsivo para desktop.

**Stack:** React 18 + Vite + XLSX. Single-file architecture (`src/App.jsx`).

---

## Setup local

```bash
npm install
npm run dev      # localhost:5173
npm run build    # genera /dist
```

## Deploy

Push a GitHub → Vercel autodespliega en ~2 min.

---

## Arquitectura

**Un solo archivo:** `src/App.jsx` (~2000 líneas) con todos los componentes, estado y handlers. Esta decisión es intencional — facilita iteración rápida en una sola pantalla con Claude.

### Orden de componentes en App.jsx

1. **Imports + constantes** — `HOY`, `MES`, `ANIO`, `STOCK_BAJO=3`, `PLAN_MAX=5`
2. **Helpers** — `totalStock`, `mg` (guard div/zero), `esHoy`, `parseTallas`, `fmtFecha`, `fmtHora`, `LS` (localStorage con try/catch)
3. **Design tokens** — `C{}` (colores), `sh`, `shMd`, `IS`
4. **AnimatedLogo** — SVG isométrico hardcodeado
5. **LoginScreen** — Selector rol Dueña/Vendedora + PIN, responsive (full-screen mobile, tarjeta flotante desktop)
6. **Atoms** — `Pill`, `Card`, `Btn`, `Sheet` (responsive)
7. **Modales** — `TiposEditor`, `VentaModal`, `EditModal`, `TransferModal`
8. **Vistas** — `BarChart`, `TopList`, `HoyView`, `HistorialView`, `TrazaView`, `DashboardView`
9. **App** — componente principal con todo el estado y handlers

### Persistencia

Actualmente **localStorage**:
- `bs_prods` — productos
- `bs_hist` — historial (ventas + movimientos)
- `bs_plan` — free/trial/pro
- `bs_pines` — PINs de admin/vendedora

⚠️ **Próximo paso urgente:** migrar a Firebase Firestore. localStorage tiene 5-10MB y se pierde si el usuario borra caché. Es la deuda técnica #1 antes de lanzar a usuarios reales.

---

## Funcionalidades implementadas

### Autenticación y roles
- Login con PINs configurables por rol (Dueña 1234 / Vendedora 0000 por defecto)
- **Dueña/Admin** ve: dashboard, ganancias, márgenes, precios, exportar, historial completo, agregar productos, trazabilidad
- **Vendedora** ve: solo stock y "Mis ventas" (vista 7 días)

### Inventario
- **Tallas/Tipos** agnóstico de rubro (zapatos, ropa, colores, etc.)
- **Multi-sede** con selector orgánico (chips de sedes existentes + "Nueva sede")
- Importar Excel/CSV con detección de duplicados (sumar o ignorar)
- Exportar inventario y ventas a Excel
- Campo `fechaIngreso` automático al crear/importar/restockear

### Operaciones — todas con trazabilidad completa
- **Venta** — 2 toques, precio editable, registra `responsable`
- **Anular venta** — del día actual, restaura stock, queda tachada con badge ANULADA, guarda `anuladaPor` y `fechaAnulacion`
- **Restock** — modal con +/− por talla existente, agregar tallas nuevas, precios opcionales (compra/venta)
- **Trasladar** — envía desde producto HACIA otra sede (chips + "Nueva sede"). Si destino no tiene el producto, lo crea automáticamente.
- **Corrección de conteo (Ajuste)** — motivo obligatorio
- **Editar** — solo nombre/precios. Stock inmutable por edición (usar Restock o Trasladar)

### Trazabilidad
Cada movimiento guarda datos estructurados:
- **Venta:** `{tipo:"venta", producto, sku, talla, sede, cantidad, precioVenta, total, ganancia, responsable, fecha}`
- **Anulada:** se mantiene la venta + `{anulada:true, anuladaPor, fechaAnulacion}`
- **Restock:** `{tipo:"ajuste", subtipo:"restock", cambios:[{talla, delta, nueva}], precioCompra, precioVenta, ...}`
- **Ajuste:** `{tipo:"ajuste", subtipo:"conteo", cambios:[{talla, delta}], motivo, stockAntes, stockDespues, ...}`
- **Traslado:** `{tipo:"traslado", cambios:[{talla, cantidad}], origen, destino, ...}`
- **Edición:** `{tipo:"edicion", cambiosCampos:[{campo, antes, despues}], ...}`

Vista dedicada `TrazaView` con buscador (producto/código) y filtros por tipo (Restock/Ajustes/Traslados/Ediciones/Anuladas).

### Dashboard "Inicio"
KPIs en 3 bloques (Hoy / Este mes / Inventario) + gráfico ingresos últimos 7 días + alertas colapsables (agotados, stock bajo) + botón directo a trazabilidad.

### Respaldo de datos (temporal, pre-Firebase)
Desde el modal de configuración (⚙️): **Descargar respaldo** exporta todo (`prods`, `hist`, `plan`) a un JSON. **Restaurar** lo reimporta con confirmación previa. Es protección temporal para beta testers mientras se migra a Firestore.

### Plan freemium
- **Free** — 5 SKUs
- **Trial** — 14 días
- **PRO** — S/15/mes (placeholder, configurable)

---

## Layout responsivo

Detecta `window.innerWidth >= 768` y se adapta:

**Mobile (default):**
- Header arriba, navegación tab bar abajo
- Tarjetas en columna única
- Sheets desde abajo

**Desktop:**
- Sidebar fija izquierda 220px con navegación vertical
- 2 columnas para productos, 4 KPI cards en fila
- Modales como dialogs centrados

Hot-swap en vivo: si redimensionas la ventana, se reconfigura.

---

## Validación de código

⚠️ **CRÍTICO al editar `App.jsx`:** validar con Babel real antes de subir. Errores históricos (cierres `}}` dobles, `</div>` adyacentes, TDZ de `dsk`) fueron mal diagnosticados al inspeccionar a ojo.

```bash
# Setup una sola vez
mkdir -p /tmp/babelcheck && cd /tmp/babelcheck
npm install @babel/core @babel/preset-react @babel/traverse

# Script de validación
cat > check.js << 'JS'
const babel = require("@babel/core");
const fs = require("fs");
const code = fs.readFileSync("./src/App.jsx", "utf8");
try {
  babel.transformSync(code, {presets:["@babel/preset-react"], filename:"app.jsx"});
  console.log("✅ NO ERRORS");
} catch (e) {
  console.log("❌", e.message);
}
JS
node check.js
```

---

## Pendientes / Roadmap

### Inmediato (deuda técnica)
- [ ] **Firebase Firestore** — migrar persistencia a la nube
- [ ] Dominio `berrostock.pe`
- [ ] Logo profesional (en espera)

### Corto plazo
- [ ] Pasada completa de identidad visual cuando llegue el logo (tipografía, paleta, reemplazar emojis restantes por SVG)
- [ ] Cobros con Yape (QR + número)
- [ ] Integración Culqi/MercadoPago para upgrades a PRO
- [ ] Ocultar toggle plan PRO/Trial del usuario (control manual)

### Medio plazo
- [ ] Reportes estadísticos tipo Power BI (torta con % y montos por categoría/producto)
- [ ] Reporte mensual al correo
- [ ] Lector de códigos de barras (`html5-qrcode` o `quagga`) — vendible como add-on premium
- [ ] PWA installable + Play Store

### Futuro
- [ ] Vista desktop con tablas para más densidad de datos (post-beta)
- [ ] App multi-usuario con sincronización en tiempo real
- [ ] Reportes exportables a PDF

---

## Decisiones de diseño

- **"Tallas" → "Tipos"** — agnóstico de rubro
- **Trazabilidad total tipo ERP** — stock NO se edita libremente, todo cambio es un movimiento documentado con fecha + hora + motivo + responsable
- **"Reponer" → "Trasladar"** — dirección invertida (envía hacia, crea destino si no existe)
- **Sede no editable en EditModal** — usar Trasladar
- **Sedes orgánicas** vía dropdown — sin onboarding obligatorio
- **Import 2 opciones simples** ("añadir al stock" / "ignorar") en vez de 3 técnicas, para dueñas no-técnicas
- **Layout responsivo Opción A** (un archivo adaptable) — no apps separadas para mobile/desktop
- **Validación con Babel real obligatoria** antes de presentar
