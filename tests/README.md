# Pruebas de lógica de negocio

Cubren los cálculos donde un error pasa desapercibido: el costeo, la importación
de Excel, los gráficos y las devoluciones. Un descuadre en cualquiera de estos
no rompe la app — solo muestra un número equivocado, que es peor.

## Correr todo

```bash
node tests/run-all.js
```

Cada suite también corre sola: `node tests/avco-test.js`

## Cómo están hechas

**Extraen las funciones reales de `src/App.jsx` y las ejecutan.** No
reimplementan las fórmulas: leen el archivo, sacan el código de la función y lo
evalúan. Si cambiás la fórmula en `App.jsx`, la prueba prueba la fórmula nueva.

Una prueba que reimplementa la lógica termina probándose a sí misma y pasa
aunque el producto esté roto.

## Qué cubre cada una

| Suite | Qué protege |
|---|---|
| `avco-test` | Costo promedio ponderado. Incluye el error de medir el stock *después* de sumar, que da un promedio mal. |
| `import-test` | Las dos ramas de importación (reemplazar / sumar), consolidación de filas duplicadas, conflictos de precio, y que `id` y `archivado` no se pisen. |
| `graficos-test` | Acumulado mensual y top por SKU. Bordes de fecha: enero compara contra diciembre del año anterior; marzo no inventa un 30 de febrero. |
| `reponer-test` | Devolución de stock por `prodId` cuando el SKU, la sede o la talla cambiaron después de la venta. |
| `devoluciones-test` | Que reembolsos y cambios salgan de ingresos, ganancia y del resumen de caja. |

## Al agregar funcionalidad

Si tocás `esVentaReal` o `esMovimiento`, corré `devoluciones-test` — esos dos
predicados deciden qué cuenta como venta en toda la app, y un cambio ahí
descuadra varias pantallas a la vez.
