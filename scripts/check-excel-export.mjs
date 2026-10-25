import assert from 'node:assert/strict';
import { createOrdersWorkbook } from '../src/orderExport.ts';

const workbook = await createOrdersWorkbook([{
  id: 'test-order',
  created_at: '2026-10-24T23:30:00Z',
  full_name: '=1+1',
  phone: '+cmd',
  city: '-5',
  address: '@SUM(A1)',
  offer: 'one',
  quantity: 1,
  total_dh: 149,
  note: '\tunsafe note',
  status: 'new',
  admin_note: '\runsafe admin note',
}]);

const buffer = await workbook.xlsx.writeBuffer();
const { default: ExcelJS } = await import('exceljs');
const verified = new ExcelJS.Workbook();
await verified.xlsx.load(buffer);
const sheet = verified.getWorksheet('الطلبات');
assert.ok(sheet);

for (const [column, expected] of [
  [2, "'=1+1"],
  [3, "'+cmd"],
  [4, "'-5"],
  [5, "'@SUM(A1)"],
  [9, "'\tunsafe note"],
  [10, "'\nunsafe admin note"],
]) {
  const cell = sheet.getCell(2, column);
  assert.equal(cell.type, ExcelJS.ValueType.String, `column ${column} should be stored as text`);
  assert.equal(cell.value, expected, `column ${column} should be prefixed safely`);
}

assert.equal(sheet.views[0].rightToLeft, true);
assert.equal(sheet.views[0].state, 'frozen');
assert.equal(sheet.views[0].ySplit, 1);
assert.equal(sheet.getCell('K2').value, '2026-10-25 00:30');

console.log('Excel text-safety and worksheet checks passed.');
