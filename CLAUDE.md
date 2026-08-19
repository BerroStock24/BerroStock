# Contexto para Claude Code

Este archivo te da contexto al entrar al repo. Léelo antes de modificar `src/App.jsx`.

## Sobre el proyecto

**BerroStock** — app de inventario y POS para PYMEs peruanas (zapaterías, tiendas, bodegas). React + Vite, single-file architecture en `src/App.jsx`.

**Desarrollador:** Álvaro, ingeniero mecánico. Lima/Ayacucho, Perú.

**Estado:** pre-beta, funcional, próximo a migrar a Firebase. Lee `README.md` para detalles completos de funcionalidades.

## Reglas críticas al editar `src/App.jsx`

### 1. SIEMPRE validar con Babel real antes de presentar cambios

El archivo es ~2000 líneas en JSX. Errores de sintaxis son comunes y difíciles de diagnosticar a ojo. He cometido tres veces el error de arreglar el síntoma (la línea que Babel señalaba) en vez de la causa (un `}` faltante en otra parte). **No vuelvas a hacerlo.**

```bash
mkdir -p /tmp/babelcheck && cd /tmp/babelcheck
[ ! -d node_modules ] && npm install --silent @babel/core @babel/preset-react @babel/traverse

cat > check.js << 'JS'
const babel = require("@babel/core");
const code = require("fs").readFileSync(process.argv[2], "utf8");
try {
  babel.transformSync(code, {presets:["@babel/preset-react"], filename:"a.jsx"});
  console.log("✅ NO ERRORS");
} catch (e) { console.log("❌", e.message); }
JS

node check.js /ruta/a/src/App.jsx
```

Si reporta error, lee las líneas exactas que indica — pero también revisa si la **causa raíz** está más adelante (un cierre faltante hace que el parser señale el inicio del `return`).

### 2. Errores históricos a evitar

- **TDZ (temporal dead zone):** declaraciones `const` no se pueden usar antes de declararse. Si una variable es usada en un objeto de estilo, asegúrate que esté declarada arriba.
- **`undefined` como valor de estilo:** `marginLeft:isDesktop?220:undefined` confunde a Babel. Usa spread: `...(isDesktop?{marginLeft:220}:{})`.
- **Style objects con `{{...}[clave]}`:** Babel los confunde con un object literal. Usa ternarios encadenados.
- **`<div>` adyacentes sin contenedor:** cuando conviertes un elemento a condicional `{flag && <div>...</div>}`, asegúrate de cerrar el `}`. Es la causa más común de "Adjacent JSX elements" en una línea aparentemente correcta.
- **`}}` doble** al cerrar condicionales: solo necesita un `}` después del JSX.

### 3. Trazabilidad: estructura de datos

Cada handler que modifica `hist` debe guardar datos estructurados, NO solo strings:

```js
// Restock
{ tipo:"ajuste", subtipo:"restock",
  cambios:[{talla, delta, nueva:boolean}],
  precioCompra, precioVenta, ... }

// Ajuste/conteo
{ tipo:"ajuste", subtipo:"conteo",
  cambios:[{talla, delta, nueva:false}],
  motivo (obligatorio), stockAntes, stockDespues, ... }

// Traslado
{ tipo:"traslado",
  cambios:[{talla, cantidad}],
  origen, destino, ... }

// Edición de campos
{ tipo:"edicion",
  cambiosCampos:[{campo, antes, despues}], ... }

// Anulada — se mantiene la venta original y se agrega:
{ ...venta, anulada:true, anuladaPor:sesion, fechaAnulacion:ISO }
```

Todos los handlers también guardan `responsable: sesion` (que es `"admin"` o `"vendedora"`). `TrazaView` espera estos campos exactos para renderizar las tarjetas.

### 4. Filtros para reportes

En cualquier cálculo de ingresos/ganancias/top de ventas:
- Excluir `v.anulada`
- Excluir `v.tipo === "ajuste" / "traslado" / "edicion"`
- Solo contar `(!v.tipo || v.tipo === "venta")`

Casos donde se rompió antes: Top del mes contaba restocks como "vendido S/0 ganancia 0".

### 5. Guards numéricos

Productos importados pueden tener `compra` o `venta` undefined. Siempre usa:
- `(v.total||0).toFixed(0)` en displays
- `(v.ganancia||0)` en reduces
- `mg(c,v)` ya tiene guard interno para `c<=0` (retorna `"—"`)

### 6. Estilo de UI

- **Sin emojis decorativos** — usuario quiere look ERP serio. Los emojis actuales se quitan en una pasada visual completa cuando llegue el logo nuevo.
- **Tarjetas estructuradas** sobre líneas largas. Ejemplo bueno: bloque con header (nombre + monto) + sección de detalle + footer con responsable.
- **Borde izquierdo de color** para distinguir tipos (verde=venta/ok, rojo=anulada, morado=ajuste, cian=edición).
- **Iconos minimalistas Unicode** preferidos sobre emojis: `↔` traslado, `✚` agregar, `↩` anular, `···` más opciones.

### 7. Layout responsivo

Variable `isDesktop = window.innerWidth >= 768` con resize listener. Se usa para:
- Mostrar sidebar (`{isDesktop && <Sidebar/>}`) vs header+tab bar móvil (`{!isDesktop && ...}`)
- Grid de productos (2 columnas en desktop)
- Sheets vs dialogs centrados
- Padding más amplio en desktop

En componentes hijo que necesiten el flag, pásalo como prop (`isDesktop={isDesktop}`).

## Tono y estilo de comunicación

Álvaro prefiere:
- Respuestas concisas, al grano
- Cambios concretos verificados, no descripciones especulativas
- Que pruebe lógica de negocio cuando hay cálculos involucrados
- Que valide cualquier cambio con Babel real antes de presentar

Es un ingeniero, no le digas que las cosas son "complejas" si no lo son. Pero tampoco le des código sin testear.

## Pendientes que no se han hecho

Ver sección "Roadmap" en `README.md`. Lo más urgente: migración a Firebase Firestore. Después: rediseño visual completo cuando llegue el logo profesional.
