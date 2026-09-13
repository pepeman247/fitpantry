# FitPantry PRO 📱🥗🏋️🛒
### Gestor Integral de Nutrición Sin Gluten, Despensa Aldi y Entrenamiento (3 y 5 Días)

Single Page Application (SPA / PWA) diseñada bajo principios de **simplicidad radical**, **rendimiento predecible (0ms de carga)** y **cero deuda técnica**. Funciona 100% offline para su uso en sótanos de gimnasios sin conexión.

---

## 📂 Archivos del Sistema

Ubicación del proyecto: `fitness-pantry-app/`

```
fitness-pantry-app/
├── index.html                  # Shell semántico HTML5, PWA meta y estructura de vistas
├── app.js                      # Lógica lineal de estado, timer Web Audio y renders
├── data_presets.js             # Datasets reales precompilados (Plan 3 Días y 5 Días)
├── styles.css                  # Optimizaciones táctiles mobile-first y safe-areas
├── sw.js                       # Service Worker con caché offline total (Cache-First)
├── manifest.json               # Web App Manifest instalable
├── icons/icon.svg              # Icono vectorizado PWA
└── data/                       # Archivos CSV originales del usuario
    ├── lista_compra_aldi_3dias.csv
    ├── lista_compra_aldi_5dias.csv
    ├── plan_mensual_3dias_entrenamiento.csv
    ├── plan_mensual_5dias_entrenamiento.csv
    ├── plan_mensual_3dias_nutricion.csv
    └── plan_mensual_5dias_nutricion.csv
```

---

## ⚡ Principales Funcionalidades Adaptadas

1. **Selector Global 3 Días / 5 Días**:
   - Alterna con 1 solo toque en la cabecera entre el **Plan 3 Días (Full Body)** y el **Plan 5 Días (Torso/Pierna/Hipertrofia)**.
   - La despensa de Aldi, el plan mensual de nutrición y los entrenamientos se sincronizan instantáneamente al programa seleccionado.

2. **Módulo de Nutrición Mensual (100% Sin Gluten)**:
   - Desglose por semanas (1 a 4) y días (Días de Entrenamiento vs Días de Descanso Activo).
   - Resumen de macronutrientes del día: **Calorías (kcal), Proteína, Carbohidratos, Grasas y Fibra**.
   - Tarjetas de comidas con horario, plato, ingredientes y gramajes pesados en crudo, micronutrientes clínicos y check de comida completada.

3. **Módulo de Despensa & Compras Aldi**:
   - Vistas conmutables: **"En Casa"** (inventario) y **"Por Comprar (Aldi)"** (lista activa).
   - Detalle de formato comercial, marca propia de Aldi (*El Mercado, GutBio, Milsani*), cantidades semanales y mensuales.
   - Distintivo verificado **🌾 Apto Celíaco** por producto.
   - Botón de compra rápida *"Comprar Todo"* para reponer inventario en bloque.

4. **Módulo de Entrenamiento en Vivo**:
   - **Selector de Ubicación**: Alterna entre **🏢 Gimnasio** y **🏠 Casa (Banco Romano / Mancuernas)** para mostrar la variante adecuada según dónde estés entrenando.
   - **Sobrecarga Progresiva Automática**: Muestra qué peso y repeticiones hiciste la semana anterior y sugiere el objetivo para superarlo.
   - **Temporizador de Descanso ⏱️**: Auto-iniciado al completar una serie, con campanada sintetizada con **Web Audio API** y vibración háptica.
   - **Modo Foco (Manos Sudorosas)**: Pantalla completa con botones táctiles gigantes (+1.25kg, +2.5kg, +5kg), contador de reps y botón masivo para completar la serie sin fricción.

---

## 🚀 Cómo Ejecutar la Aplicación

- **Doble clic** en `index.html` en cualquier navegador web moderno.
- O mediante servidor local:
  ```powershell
  cd fitness-pantry-app
  python -m http.server 8000
  ```
  Y abrir `http://localhost:8000` en tu móvil o navegador.
