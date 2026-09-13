const fs = require('fs');
const path = require('path');

// Simple, robust CSV parser for standard CSV files with quoted strings
function parseCSV(text) {
  const clean = text.replace(/^\uFEFF/, '').trim();
  const rows = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const next = clean[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(current.trim());
      current = '';
      if (row.length > 0 && row.some(col => col.length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      current += char;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map(h => h.trim());
  const data = [];

  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = rows[r][idx] || '';
    });
    data.push(obj);
  }
  return data;
}

const dir = path.join(__dirname, 'data');

const rawPantry3 = fs.readFileSync(path.join(dir, 'lista_compra_aldi_3dias.csv'), 'utf8');
const rawPantry5 = fs.readFileSync(path.join(dir, 'lista_compra_aldi_5dias.csv'), 'utf8');
const rawWorkout3 = fs.readFileSync(path.join(dir, 'plan_mensual_3dias_entrenamiento.csv'), 'utf8');
const rawWorkout5 = fs.readFileSync(path.join(dir, 'plan_mensual_5dias_entrenamiento.csv'), 'utf8');
const rawNutri3 = fs.readFileSync(path.join(dir, 'plan_mensual_3dias_nutricion.csv'), 'utf8');
const rawNutri5 = fs.readFileSync(path.join(dir, 'plan_mensual_5dias_nutricion.csv'), 'utf8');

const pantry3 = parseCSV(rawPantry3).map((r, i) => ({
  id: 'p3_' + i,
  categoria: r['Categoría'] || 'General',
  producto: r['Producto'] || '',
  marca: r['Marca Aldi'] || '-',
  formato: r['Formato Comercial'] || '',
  cantidadSemanal: r['Cantidad Semanal'] || '',
  cantidadMensual: r['Cantidad Mensual (x4)'] || '',
  aptoCeliaco: r['Apto Celíaco'] || '',
  notas: r['Notas / Ubicación'] || '',
  status: i % 4 === 1 ? 'tobuy' : 'athome' // Mark some items as tobuy initially
}));

const pantry5 = parseCSV(rawPantry5).map((r, i) => ({
  id: 'p5_' + i,
  categoria: r['Categoría'] || 'General',
  producto: r['Producto'] || '',
  marca: r['Marca Aldi'] || '-',
  formato: r['Formato Comercial'] || '',
  cantidadSemanal: r['Cantidad Semanal'] || '',
  cantidadMensual: r['Cantidad Mensual (x4)'] || '',
  aptoCeliaco: r['Apto Celíaco'] || '',
  notas: r['Notas / Ubicación'] || '',
  status: i % 4 === 1 ? 'tobuy' : 'athome'
}));

const workout3 = parseCSV(rawWorkout3).map((r, i) => {
  const semanaNum = parseInt((r['Semana'] || '1').replace(/\D/g, ''), 10) || 1;
  const orden = parseInt(r['Orden'] || (i + 1), 10) || (i + 1);
  return {
    id: `w3_s${semanaNum}_ord${orden}_${i}`,
    semana: semanaNum,
    dia: r['Día / Sesión'] || 'Día 1',
    orden: orden,
    patron: r['Patrón Motor / Ejercicio'] || '',
    varianteGym: r['Variante Gym'] || '',
    varianteCasa: r['Variante Casa (Banco Romano/Mancuernas)'] || '',
    series: parseInt(r['Series'] || '3', 10) || 3,
    reps: r['Reps Objetivo'] || '10',
    rir: r['RIR / Esfuerzo'] || '2',
    descanso: parseInt((r['Descanso (seg)'] || '90').toString().replace(/\D/g, ''), 10) || 90,
    tempo: r['Tempo (Exc-Iso-Conc)'] || '2-0-1-0',
    notas: r['Sobrecarga Progresiva / Notas Biomecánicas'] || ''
  };
});

const workout5 = parseCSV(rawWorkout5).map((r, i) => {
  const semanaNum = parseInt((r['Semana'] || '1').replace(/\D/g, ''), 10) || 1;
  const orden = parseInt(r['Orden'] || (i + 1), 10) || (i + 1);
  return {
    id: `w5_s${semanaNum}_ord${orden}_${i}`,
    semana: semanaNum,
    dia: r['Día / Sesión'] || 'Día 1',
    orden: orden,
    patron: r['Patrón Motor / Ejercicio'] || '',
    varianteGym: r['Variante Gym'] || '',
    varianteCasa: r['Variante Casa (Banco Romano/Mancuernas)'] || '',
    series: parseInt(r['Series'] || '3', 10) || 3,
    reps: r['Reps Objetivo'] || '10',
    rir: r['RIR / Esfuerzo'] || '2',
    descanso: parseInt((r['Descanso (seg)'] || '90').toString().replace(/\D/g, ''), 10) || 90,
    tempo: r['Tempo (Exc-Iso-Conc)'] || '2-0-1-0',
    notas: r['Sobrecarga Progresiva / Notas Biomecánicas'] || ''
  };
});

const nutri3 = parseCSV(rawNutri3).map((r, i) => {
  const semanaNum = parseInt((r['Semana'] || '1').replace(/\D/g, ''), 10) || 1;
  return {
    id: `n3_s${semanaNum}_${i}`,
    semana: semanaNum,
    diaTipo: r['Día Tipo / Ciclo'] || 'Día 1',
    comida: r['Comida'] || 'Comida',
    horario: r['Horario Recomendado'] || '',
    plato: r['Plato / Receta (100% Sin Gluten)'] || '',
    ingredientes: r['Ingredientes y Gramajes Exactos (Pesados en Crudo)'] || '',
    proteina: parseFloat(r['Proteína (g)']) || 0,
    carbohidratos: parseFloat(r['Carbohidratos (g)']) || 0,
    grasas: parseFloat(r['Grasas (g)']) || 0,
    calorias: parseFloat(r['Calorías (kcal)']) || 0,
    fibra: parseFloat(r['Fibra (g)']) || 0,
    micronutrientes: r['Micronutrientes Críticos / Indicaciones Clínicas'] || ''
  };
});

const nutri5 = parseCSV(rawNutri5).map((r, i) => {
  const semanaNum = parseInt((r['Semana'] || '1').replace(/\D/g, ''), 10) || 1;
  return {
    id: `n5_s${semanaNum}_${i}`,
    semana: semanaNum,
    diaTipo: r['Día Tipo / Ciclo'] || 'Día 1',
    comida: r['Comida'] || 'Comida',
    horario: r['Horario Recomendado'] || '',
    plato: r['Plato / Receta (100% Sin Gluten)'] || '',
    ingredientes: r['Ingredientes y Gramajes Exactos (Pesados en Crudo)'] || '',
    proteina: parseFloat(r['Proteína (g)']) || 0,
    carbohidratos: parseFloat(r['Carbohidratos (g)']) || 0,
    grasas: parseFloat(r['Grasas (g)']) || 0,
    calorias: parseFloat(r['Calorías (kcal)']) || 0,
    fibra: parseFloat(r['Fibra (g)']) || 0,
    micronutrientes: r['Micronutrientes Críticos / Indicaciones Clínicas'] || ''
  };
});

const outputJs = `// FitPantry PRO - Pre-parsed Bundled Real Datasets (Zero Runtime Overhead)

window.FIT_PRESETS = {
  plan3dias: {
    name: 'Plan 3 Días (Full Body)',
    pantry: ${JSON.stringify(pantry3, null, 2)},
    workout: ${JSON.stringify(workout3, null, 2)},
    nutrition: ${JSON.stringify(nutri3, null, 2)}
  },
  plan5dias: {
    name: 'Plan 5 Días (Torso / Pierna / Hipertrofia)',
    pantry: ${JSON.stringify(pantry5, null, 2)},
    workout: ${JSON.stringify(workout5, null, 2)},
    nutrition: ${JSON.stringify(nutri5, null, 2)}
  }
};
`;

fs.writeFileSync(path.join(__dirname, 'data_presets.js'), outputJs, 'utf8');
console.log('✅ Generated data_presets.js successfully!');
console.log('pantry3 items:', pantry3.length);
console.log('pantry5 items:', pantry5.length);
console.log('workout3 items:', workout3.length);
console.log('workout5 items:', workout5.length);
console.log('nutri3 items:', nutri3.length);
console.log('nutri5 items:', nutri5.length);
