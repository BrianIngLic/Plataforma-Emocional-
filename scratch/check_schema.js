const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'db', 'schema.sql');
const schemaContent = fs.readFileSync(schemaPath, 'utf8');

const tablesToFind = [
  'campos_formulario',
  'consultas_nutricion',
  'session_evaluations',
  'internal_meta_conversations',
  'internal_meta_chats',
  'webhook_logs',
  'diary_entries',
  'food_diary_entries',
  'achievements',
  'user_achievements',
  'student_clinical_records'
];

console.log('--- Buscando tablas en schema.sql ---');
tablesToFind.forEach(table => {
  const regex = new RegExp(`CREATE TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?${table}\\b`, 'i');
  const exists = regex.test(schemaContent);
  console.log(`Tabla "${table}": ${exists ? '✅ ENCONTRADA' : '❌ NO ENCONTRADA'}`);
});
