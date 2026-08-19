# Estado de BerroStock — retomar acá

## Qué es
App de inventario y POS para PYMEs peruanas (zapaterías, tiendas, bodegas).
React + Vite, arquitectura de un solo archivo en `src/App.jsx` (~3,240 líneas).
Lee `CLAUDE.md` antes de tocar nada — tiene las reglas críticas de edición.

## Dónde estamos
Pre-beta funcional. La v1 está desplegada en Vercel (los archivos se subieron
a mano a GitHub, sin git local). Acabamos de terminar una tanda grande de
funcionalidades que TODAVÍA NO ESTÁN DESPLEGADAS.

## Lo próximo, en orden
1. **Conectar git y desplegar la actualización.** La carpeta se movió fuera de
   OneDrive (sincronizaba `node_modules` y hacía todo lento). Hay que clonar el
   repo de GitHub acá, copiar los archivos, `npm install`, verificar el build y
   hacer push. Vercel despliega solo con el push.
2. **Migrar a Firebase Firestore.** Es lo más importante del roadmap.

## Lo que se construyó en la última sesión (todo verificado)

**Costeo AVCO** — El bug de fondo: importar con precios distintos subestimaba la
ganancia. Ahora `compra` es el promedio ponderado interno y `ultimoCosto` es el
precio real que tecleó la usuaria. **`ultimoCosto` NUNCA debe mostrar un valor
calculado** — es una restricción explícita del dueño del producto.

**Importación de Excel** — Rehecha: pregunta en lenguaje llano (reemplazar vs
sumar), consolida filas duplicadas del archivo, ventana de conflictos de precio,
aviso previo de qué se actualiza/crea/no está. Preserva `id` y `archivado`.

**Escáner de código de barras** — En el formulario Agregar. `BarcodeDetector`
nativo con ZXing de respaldo, cargado bajo demanda (no está en el chunk inicial).
**PENDIENTE: probarlo en un celular real** — necesita HTTPS, por IP local la
cámara no arranca. Recién se puede probar una vez desplegado en Vercel.

**Gráficos del inicio** — Acumulado mensual con toggle Ingresos/Ganancia y
comparación contra el mismo tramo del mes anterior. Top de productos por
ingresos agrupado por SKU (no por talla).

**Egresos** — Sub-vista desde el inicio. 9 categorías operativas + Otros.
NO incluye compra de mercadería: ese costo ya se descuenta vía AVCO al vender,
registrarlo como egreso lo restaría dos veces. Utilidad real = ganancia − egresos.

**Método de pago** — Efectivo / Yape-Plin / Tarjeta en ventas y egresos.

**Resumen del día** — En la vista Hoy. Sin arqueo (se decidió no pedir que
nadie cuente). La vendedora ve medios de pago y "en caja debería haber";
la dueña ve además ganancia y utilidad del día.

**Devoluciones** — Reembolso y Cambio, en el menú de cada venta. Distinta de
anular (que corrige errores de registro, 7 días). El cambio ofrece primero las
otras tallas del mismo producto y después un buscador; calcula la diferencia sola.

**Aviso de guardado fallido** — `LS.set` devuelve si funcionó. Si el navegador
se queda sin espacio aparece una barra roja que lleva al respaldo. Antes fallaba
en silencio y se perdían ventas sin que nadie se enterara.

**`prodId` en las ventas** — La anulación buscaba el producto por SKU+sede, y si
la dueña editaba el SKU el stock no volvía. Ahora usa `prodId` (identidad
permanente) con respaldo a SKU para ventas viejas. Si la talla fue renombrada,
la recrea en vez de perder el stock.

## Decisiones de arquitectura que hay que respetar

- **`esVentaReal(v)` y `esMovimiento(v)`** son los ÚNICOS criterios de qué cuenta
  como venta y qué va a Trazabilidad. Están centralizados a propósito: antes
  estaban copiados en 11 lugares y bastaba olvidar uno para que dos pantallas
  mostraran números distintos. Si agregás un tipo de movimiento, tocá solo esos.
- **`tallaLbl(t)`** es el único formateador de tallas. Sin prefijo "T": chocaba
  con el símbolo ™ y las tallas con punto (40.5) o espacio (8 1/2) quedaban
  inconsistentes.
- **`reponerStock(lista, venta)`** lo usan anular y devoluciones. No dupliques
  esa lógica.
- **El respaldo va en versión 2** (incluye egresos). Los v1 se restauran igual.

## Cómo se valida acá

1. **Siempre Babel real antes de presentar cambios** (ver `CLAUDE.md`). El archivo
   es grande y los errores de sintaxis son difíciles de diagnosticar a ojo.
2. **Pruebas de lógica extrayendo las funciones reales del archivo**, no
   reimplementándolas — así el test cambia con el código. Se hicieron 5 suites
   (AVCO, importación, gráficos, reposición de stock, devoluciones).
3. **Verificación en el navegador** con datos sembrados, probando los dos roles.

## Dos advertencias para producción

1. **El escáner necesita HTTPS.** Por IP local (`192.168.x.x`) la cámara no
   arranca. Vercel lo resuelve.
2. **"MULTI-SEDE" en el login promete algo que hoy no existe.** Todo vive en
   `localStorage`: cada navegador es una isla, la dueña y la vendedora no
   comparten datos. Hasta Firebase, o se aclara ese texto o se apura la migración.

## En pausa (por decisión del dueño del producto)

- **Fotos de producto** — Después de Firebase, y por producto (catálogo), no por
  venta. Por venta reventaría `localStorage`: ~85 fotos llenan todo el espacio.
- **KPIs de vendedora** — Necesita multi-usuario primero. Hoy solo hay dos roles
  fijos (admin/vendedora) con PIN compartido, no usuarias individuales. Falta
  definir los límites por plan (básico 1 tienda/1 usuario, pro 3/5, negocio
  ilimitado — tentativo).
- **`useMemo`** — Descartado a propósito: Firebase resuelve el problema de raíz
  (no cargar 40,000 ventas en memoria). Optimizar ahora sería trabajo tirado.
- **Facturación electrónica** — Producto aparte de Berro, no va en BerroStock.

## Tono de trabajo
Álvaro es ingeniero mecánico. Prefiere respuestas concisas y al grano, cambios
verificados en vez de descripciones especulativas, y que se pruebe la lógica de
negocio cuando hay cálculos de por medio. No le digas que algo es "complejo" si
no lo es, pero tampoco le des código sin probar.
