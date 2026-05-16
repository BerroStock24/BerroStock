# BerroStock 📦

Control de inventario para tiendas — simple, rápido, sin complicaciones.

## Estructura del proyecto

```
berrostock/
├── index.html
├── package.json
├── vite.config.js
├── .gitignore
├── README.md
└── src/
    ├── main.jsx
    └── App.jsx        ← archivo principal (inventario-app.jsx renombrado)
```

## Cómo desplegar en Vercel (paso a paso)

### 1. Preparar archivos localmente
- Crea una carpeta llamada `berrostock` en tu computadora
- Copia todos estos archivos dentro
- Renombra `inventario-app.jsx` → `src/App.jsx`

### 2. Subir a GitHub
1. Ve a [github.com](https://github.com) y crea una cuenta
2. Click en **New repository**
3. Nombre: `berrostock` → Create repository
4. Sube todos los archivos (arrastra y suelta en la página)

### 3. Desplegar en Vercel
1. Ve a [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. Click **New Project** → selecciona el repositorio `berrostock`
3. Vercel detecta Vite automáticamente
4. Click **Deploy** — listo en ~2 minutos

Tu app estará en: `berrostock.vercel.app`

### 4. Dominio propio (opcional)
- Compra `berrostock.pe` en [namecheap.com](https://namecheap.com) (~S/30/año)
- En Vercel: Settings → Domains → agrega tu dominio

## Desarrollo local
```bash
npm install
npm run dev
```

## PINs por defecto
- **Dueña / Admin:** `1234`
- **Vendedora:** `0000`

Cámbialos desde ⚙️ → Configuración de PINs dentro de la app.

---
Desarrollado con React + Vite. Los datos se guardan localmente en cada dispositivo (localStorage).
