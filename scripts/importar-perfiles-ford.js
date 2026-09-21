#!/usr/bin/env node
// Importa perfiles de puesto desde el Excel ampliado (64 columnas) a la tabla
// perfiles_puesto de Supabase. Por defecto corre en modo dry-run: valida y
// muestra qué se importaría, pero no escribe nada. Usa --commit para escribir.
//
// Uso:
//   node importar-perfiles-ford.js <archivo.xlsx>              (dry-run)
//   node importar-perfiles-ford.js <archivo.xlsx> --commit     (escribe de verdad)
//   node importar-perfiles-ford.js <archivo.xlsx> --empresa-id=otro_id --commit
//
// Requiere las variables de entorno SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
// (puede ponerlas en un archivo scripts/.env, que ya está excluido de git).
// La service role key da acceso total a la base de datos — nunca la pegues
// en el código ni la subas a git.

const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const FORD_EMPRESA_ID = 'msf4718wkocka';

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const APLICA_VALUES = new Set(['Aplica', 'No aplica']);
const SI_NO_VALUES = new Set(['Sí', 'No']);
const SEXO_VALUES = new Set(['Masculino', 'Femenino', 'Indistinto']);
const ESCOLARIDAD_VALUES = new Set(['Secundaria', 'Preparatoria / Bachillerato', 'Técnico / Tecnólogo', 'Carrera técnica', 'Licenciatura', 'Ingeniería', 'Maestría', 'Doctorado', 'Indistinto']);

// Columnas del Excel, en el orden de la plantilla, con la llave del campo
// destino en `data` (mismo nombre que usa savePerfilPuesto() en la app).
const COLS = [
  { label: 'Nombre del puesto', key: 'nombre_puesto', required: true },
  { label: 'Proyecto', key: 'proyecto' },
  { label: 'Departamento', key: 'departamento' },
  { label: 'Lugar de trabajo', key: 'lugar_trabajo' },
  { label: 'Ubicación geográfica', key: 'ubicacion_geografica' },
  { label: 'Sexo', key: 'sexo', oneOf: SEXO_VALUES },
  { label: 'Edad mínima', key: 'edad_ini' },
  { label: 'Edad máxima', key: 'edad_fin' },
  { label: 'Escolaridad', key: 'escolaridad', oneOf: ESCOLARIDAD_VALUES },
  { label: 'Experiencia previa', key: 'experiencia_previa' },
  { label: 'Elaboró', key: 'elaboro' },
  { label: 'Fecha elaboración', key: 'fecha_elaboracion', dateFmt: true },
  { label: 'Fecha revisión', key: 'fecha_revision', dateFmt: true },
  { label: 'No. revisión', key: 'no_revision' },
  { label: 'Actividades esenciales', key: 'actividades_esenciales', pipes: true },
  { label: 'Idiomas', key: 'idiomas' },
  { label: 'Conocimientos técnicos', key: 'conocimientos_tecnicos', pipes: true },
  { label: 'Habilidades', key: 'habilidades', pipes: true },
  { label: 'Actitudes', key: 'actitudes', pipes: true },
  { label: 'Nivel Inicial - Puesto', plan: [0, 'puesto'] },
  { label: 'Nivel Inicial - Salario', plan: [0, 'salario'] },
  { label: 'Nivel Inicial - Tipo', plan: [0, 'tipo_sueldo'] },
  { label: 'Nivel Inicial - Frecuencia', plan: [0, 'frecuencia'] },
  { label: 'Nivel Inicial - Extras', plan: [0, 'extras'] },
  { label: 'Nivel Inicial - Tiempo', plan: [0, 'tiempo'] },
  { label: 'Nivel Intermedio - Puesto', plan: [1, 'puesto'] },
  { label: 'Nivel Intermedio - Salario', plan: [1, 'salario'] },
  { label: 'Nivel Intermedio - Tipo', plan: [1, 'tipo_sueldo'] },
  { label: 'Nivel Intermedio - Frecuencia', plan: [1, 'frecuencia'] },
  { label: 'Nivel Intermedio - Extras', plan: [1, 'extras'] },
  { label: 'Nivel Intermedio - Tiempo', plan: [1, 'tiempo'] },
  { label: 'Nivel Final - Puesto', plan: [2, 'puesto'] },
  { label: 'Nivel Final - Salario', plan: [2, 'salario'] },
  { label: 'Nivel Final - Tipo', plan: [2, 'tipo_sueldo'] },
  { label: 'Nivel Final - Frecuencia', plan: [2, 'frecuencia'] },
  { label: 'Nivel Final - Extras', plan: [2, 'extras'] },
  { label: 'Nivel Final - Tiempo', plan: [2, 'tiempo'] },
  { label: 'Disponibilidad para viajar', key: 'disponibilidad_viajar', oneOf: SI_NO_VALUES },
  { label: 'Tipo de trabajo', key: '_tipo_trabajo_tipo' },
  { label: '% Tipo de trabajo', key: '_tipo_trabajo_pct' },
  { label: 'Horario de trabajo', key: 'horario_trabajo' },
  { label: 'Tipo de contratación', key: 'tipo_contratacion' },
  { label: 'Prestaciones', key: 'prestaciones' },
  { label: 'Acompañamiento - Capacitación', key: 'acompanamiento_capacitacion', pipes: true },
  { label: 'Efectivo o token institucional', key: 'resp_efectivo', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Cheques al portador', key: 'resp_cheques', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Formas valoradas', key: 'resp_formas_valoradas', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Mobiliario', key: 'resp_mobiliario', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Equipo de cómputo', key: 'resp_equipo_computo', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Automóvil utilitario', key: 'resp_automovil', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Telefonía', key: 'resp_telefonia', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Documentos e información', key: 'resp_documentos', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Otros', key: 'resp_otros', oneOf: APLICA_VALUES, aplica: true },
  { label: 'EPP / Uniforme', key: 'resp_uniforme', oneOf: APLICA_VALUES, aplica: true },
  { label: 'Entregables', key: 'entregables', pipes: true },
  { label: 'KPI 1 - Indicador', kpi: [0, 'indicador'] },
  { label: 'KPI 1 - Fórmula', kpi: [0, 'formula'] },
  { label: 'KPI 1 - Frecuencia', kpi: [0, 'frecuencia'] },
  { label: 'KPI 2 - Indicador', kpi: [1, 'indicador'] },
  { label: 'KPI 2 - Fórmula', kpi: [1, 'formula'] },
  { label: 'KPI 2 - Frecuencia', kpi: [1, 'frecuencia'] },
  { label: 'KPI 3 - Indicador', kpi: [2, 'indicador'] },
  { label: 'KPI 3 - Fórmula', kpi: [2, 'formula'] },
  { label: 'KPI 3 - Frecuencia', kpi: [2, 'frecuencia'] },
];

// "a | b | c" -> <ul><li>a</li><li>b</li><li>c</li></ul> (mismo formato que
// produce el editor de texto enriquecido de la app al usar viñetas).
function pipesToHtml(text) {
  const items = String(text || '').split('|').map(s => s.trim()).filter(Boolean);
  if (!items.length) return '';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return '<ul>' + items.map(i => `<li>${esc(i)}</li>`).join('') + '</ul>';
}

function cellStr(cell) {
  if (cell === null || cell === undefined) return '';
  if (typeof cell === 'object' && cell.text !== undefined) return String(cell.text).trim(); // rich text
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).trim();
}

function planToStr(rows) {
  // igual que _pfTipoToStr en la app
  const pct = rows.pct, tipo = rows.tipo;
  if (!tipo) return '';
  return `${pct ? pct + '% ' : ''}${tipo}`;
}

async function main() {
  loadDotEnv();
  const args = process.argv.slice(2);
  const filePath = args.find(a => !a.startsWith('--'));
  const commit = args.includes('--commit');
  const empresaIdArg = args.find(a => a.startsWith('--empresa-id='));
  const empresaId = empresaIdArg ? empresaIdArg.split('=')[1] : FORD_EMPRESA_ID;
  const sheetArg = args.find(a => a.startsWith('--sheet='));
  const sheetName = sheetArg ? sheetArg.split('=')[1] : 'Perfiles de puesto';

  if (!filePath) {
    console.error('Uso: node importar-perfiles-ford.js <archivo.xlsx> [--commit] [--empresa-id=xxx]');
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error('No se encontró el archivo:', filePath);
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet(sheetName);
  if (!ws) {
    console.error(`No se encontró la hoja "${sheetName}" en el archivo. Hojas disponibles:`, wb.worksheets.map(w => w.name).join(', '));
    process.exit(1);
  }

  const headerRow = ws.getRow(1);
  const headers = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => { headers[colNumber - 1] = cellStr(cell.value); });
  const colIdx = {};
  COLS.forEach(c => {
    const idx = headers.findIndex(h => h === c.label);
    colIdx[c.label] = idx; // -1 si no está en este archivo (ok para plantillas sin KPIs, por ejemplo)
  });
  const missing = COLS.filter(c => c.required && colIdx[c.label] === -1);
  if (missing.length) {
    console.error('Faltan columnas requeridas en el archivo:', missing.map(c => c.label).join(', '));
    process.exit(1);
  }

  const results = [];
  const lastRow = ws.actualRowCount;
  for (let r = 2; r <= lastRow; r++) {
    const row = ws.getRow(r);
    if (row.actualCellCount === 0) continue;
    const get = label => {
      const idx = colIdx[label];
      if (idx === -1) return '';
      return cellStr(row.getCell(idx + 1).value);
    };
    const errors = [];
    const raw = {};
    COLS.forEach(c => { raw[c.label] = get(c.label); });

    if (!raw['Nombre del puesto']) errors.push('Nombre del puesto vacío');
    COLS.forEach(c => {
      const v = raw[c.label];
      if (v && c.oneOf && !c.oneOf.has(v)) errors.push(`"${c.label}" tiene un valor no válido: "${v}"`);
    });
    ['Fecha elaboración', 'Fecha revisión'].forEach(label => {
      const v = raw[label];
      if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors.push(`"${label}" no tiene formato AAAA-MM-DD: "${v}"`);
    });

    const plan = [0, 1, 2].map(() => ({ nivel: '', puesto: '', salario: '', tipo_sueldo: 'Bruto', frecuencia: 'Mensual', extras: '', tiempo: '' }));
    plan[0].nivel = 'Inicial'; plan[1].nivel = 'Intermedio'; plan[2].nivel = 'Final';
    const kpis = [0, 1, 2].map(() => ({ indicador: '', formula: '', frecuencia: '' }));

    COLS.forEach(c => {
      const v = raw[c.label];
      if (c.plan) { const [i, f] = c.plan; if (v) plan[i][f] = v; }
      if (c.kpi) { const [i, f] = c.kpi; kpis[i][f] = v; }
    });
    plan.forEach(p => { if (p.tipo_sueldo && !['Neto', 'Bruto'].includes(p.tipo_sueldo)) errors.push(`Tipo de sueldo inválido en plan "${p.nivel}": "${p.tipo_sueldo}" (debe ser Neto o Bruto)`); });
    plan.forEach(p => { if (p.frecuencia && !['Semanal', 'Quincenal', 'Mensual'].includes(p.frecuencia)) errors.push(`Frecuencia inválida en plan "${p.nivel}": "${p.frecuencia}" (debe ser Semanal, Quincenal o Mensual)`); });

    const aplicaDefault = label => APLICA_VALUES.has(raw[label]) ? raw[label] : 'No aplica';

    const data = {
      nombre_puesto: raw['Nombre del puesto'],
      lugar_trabajo: raw['Lugar de trabajo'],
      ubicacion_geografica: raw['Ubicación geográfica'],
      proyecto: raw['Proyecto'],
      departamento: raw['Departamento'],
      fecha_elaboracion: raw['Fecha elaboración'],
      fecha_revision: raw['Fecha revisión'],
      no_revision: raw['No. revisión'] || '1',
      actividades_esenciales: pipesToHtml(raw['Actividades esenciales']),
      sexo: raw['Sexo'],
      edad_ini: raw['Edad mínima'],
      edad_fin: raw['Edad máxima'],
      escolaridad: raw['Escolaridad'],
      experiencia_previa: raw['Experiencia previa'],
      idiomas: raw['Idiomas'],
      conocimientos_tecnicos: pipesToHtml(raw['Conocimientos técnicos']),
      habilidades: pipesToHtml(raw['Habilidades']),
      habilidades_modo: 'texto',
      habilidades_dic: [],
      actitudes: pipesToHtml(raw['Actitudes']),
      plan_carrera: plan,
      disponibilidad_viajar: raw['Disponibilidad para viajar'],
      tipo_trabajo_rows: raw['Tipo de trabajo'] ? [{ pct: raw['% Tipo de trabajo'] || '', tipo: raw['Tipo de trabajo'] }] : [],
      tipo_trabajo: planToStr({ pct: raw['% Tipo de trabajo'], tipo: raw['Tipo de trabajo'] }),
      horario_trabajo: raw['Horario de trabajo'],
      tipo_contratacion: raw['Tipo de contratación'],
      prestaciones: raw['Prestaciones'],
      acompanamiento_capacitacion: pipesToHtml(raw['Acompañamiento - Capacitación']),
      resp_efectivo: aplicaDefault('Efectivo o token institucional'),
      resp_cheques: aplicaDefault('Cheques al portador'),
      resp_formas_valoradas: aplicaDefault('Formas valoradas'),
      resp_mobiliario: aplicaDefault('Mobiliario'),
      resp_equipo_computo: aplicaDefault('Equipo de cómputo'),
      resp_automovil: aplicaDefault('Automóvil utilitario'),
      resp_telefonia: aplicaDefault('Telefonía'),
      resp_documentos: aplicaDefault('Documentos e información'),
      resp_otros: aplicaDefault('Otros'),
      resp_uniforme: aplicaDefault('EPP / Uniforme'),
      entregables: pipesToHtml(raw['Entregables']),
      elaboro: raw['Elaboró'],
      kpis_puesto: kpis.filter(k => k.indicador || k.formula || k.frecuencia),
      coordinadores_ids: [],
      updated_at: new Date().toISOString(),
    };
    const id = `perfil-${Date.now()}${r}-${Math.random().toString(36).slice(2, 8)}`;
    results.push({ row: r, errors, data, id, empresa_id: empresaId });
  }

  const valid = results.filter(r => r.errors.length === 0);
  const invalid = results.filter(r => r.errors.length > 0);

  console.log(`\nArchivo: ${filePath}`);
  console.log(`Empresa destino: ${empresaId}${empresaId === FORD_EMPRESA_ID ? ' (Ford)' : ''}`);
  console.log(`Filas leídas: ${results.length} — válidas: ${valid.length}, con errores: ${invalid.length}\n`);

  if (invalid.length) {
    console.log('── Filas con errores (no se importarán) ──');
    invalid.forEach(r => console.log(`  Fila ${r.row}: ${r.errors.join('; ')}`));
    console.log('');
  }

  console.log('── Filas válidas ──');
  valid.forEach(r => console.log(`  Fila ${r.row}: "${r.data.nombre_puesto}" — ${r.data.proyecto || '(sin proyecto)'} / ${r.data.departamento || '(sin departamento)'} — ${r.data.kpis_puesto.length} KPI(s)`));

  if (args.includes('--dump-json')) {
    console.log('\n── data completo por fila (--dump-json) ──');
    valid.forEach(r => { console.log(`\nFila ${r.row}:`); console.log(JSON.stringify(r.data, null, 2)); });
  }

  if (!valid.length) {
    console.log('\nNada que importar.');
    return;
  }

  if (!commit) {
    console.log(`\n[DRY-RUN] No se escribió nada en la base de datos. Revisa lo anterior y vuelve a correr con --commit para importar ${valid.length} perfil(es) de verdad.`);
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || 'https://opvqdknqfjiolkldmnrn.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SERVICE_KEY) {
    console.error('\nFalta SUPABASE_SERVICE_ROLE_KEY (variable de entorno o scripts/.env). No se puede escribir sin ella.');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log(`\n[COMMIT] Importando ${valid.length} perfil(es)...`);
  let ok = 0, fail = 0;
  for (const r of valid) {
    const { error } = await supabase.from('perfiles_puesto').upsert({
      id: r.id, empresa_id: r.empresa_id, data: r.data, updated_at: r.data.updated_at, coordinadores_ids: [],
    });
    if (error) { fail++; console.error(`  ✗ Fila ${r.row} ("${r.data.nombre_puesto}"): ${error.message}`); }
    else { ok++; console.log(`  ✓ Fila ${r.row} ("${r.data.nombre_puesto}") importada — id ${r.id}`); }
  }
  console.log(`\nListo. ${ok} importado(s), ${fail} con error.`);
}

main().catch(e => { console.error(e); process.exit(1); });
