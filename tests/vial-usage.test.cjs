const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function loadFunction(name) {
  const start = html.indexOf(`function ${name}(`);
  assert.notStrictEqual(start, -1, `${name} function should exist`);
  const open = html.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < html.length; i++) {
    if (html[i] === '{') depth++;
    if (html[i] === '}') depth--;
    if (depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(`${name} function body not found`);
}

const context = { Math };
vm.createContext(context);
context.isVehicle = (code) => {
  const vehiclePrefixes = ['XD5W', 'XNS', 'XGNS'];
  return vehiclePrefixes.some(p => String(code).startsWith(p));
};
vm.runInContext(loadFunction('extractStrengthMg'), context);
vm.runInContext(loadFunction('getOutpatientDailyQty'), context);
vm.runInContext(loadFunction('getInpatientFracVia'), context);
vm.runInContext(loadFunction('getOutpatientFracVia'), context);
vm.runInContext(loadFunction('accumulateDrugPatients'), context);
vm.runInContext(loadFunction('vialCountFromDrugPatients'), context);
vm.runInContext(loadFunction('buildVialUsageByCode'), context);

// 4.32 via 당일 처방 → 5 via
const outOnly = context.buildVialUsageByCode([], [{
  code: 'X5FU1',
  name: 'Fluorouracil-5 1000mg/20ml inj',
  patient: '홍진길',
  dosePerTime: 4.32,
  freq: 1,
  days: 1,
  totalQty: 5
}]);
assert.strictEqual(outOnly.X5FU1.total, 5, '4.32 via should ceil to 5');
assert.strictEqual(outOnly.X5FU1.outpatient, 5);

// 0.944 via → 1 via
const gemzar = context.buildVialUsageByCode([], [{
  code: 'XGEMCIT1L',
  name: 'Gemzar liquid 1g inj',
  patient: '공화자',
  dosePerTime: 0.944,
  freq: 1,
  days: 1,
  totalQty: 1
}]);
assert.strictEqual(gemzar.XGEMCIT1L.total, 1);

// vial sharing: 0.4 + 0.4 = 0.8 → 1 via (not 2)
const sharing = context.buildVialUsageByCode([], [
  { code: 'XTEST', name: 'Test 100mg inj', patient: 'A', dosePerTime: 0.4, freq: 1, days: 1, totalQty: 1 },
  { code: 'XTEST', name: 'Test 100mg inj', patient: 'B', dosePerTime: 0.4, freq: 1, days: 1, totalQty: 1 }
]);
assert.strictEqual(sharing.XTEST.total, 1, 'shared fractional vials should ceil combined');

// 5일 처방 Erbitux: 당일 4 via (not 8 total)
const erbitux = context.buildVialUsageByCode([], [{
  code: 'XCETUX',
  name: 'Erbitux 100mg inj',
  patient: '김주희',
  dosePerTime: 4,
  freq: 1,
  days: 2,
  totalQty: 8
}]);
assert.strictEqual(erbitux.XCETUX.total, 4, 'multi-day rx should use daily dose not totalQty');

// 입원+외래 합산 ceil
const combined = context.buildVialUsageByCode(
  [{ code: 'XDRUG', name: 'Drug 100mg inj', patient: '입원환자', dose: 0, doseUnit: 'mg', totalQty: 2, category: '정규' }],
  [{ code: 'XDRUG', name: 'Drug 100mg inj', patient: '외래환자', dosePerTime: 0.63, freq: 1, days: 1, totalQty: 1 }]
);
assert.strictEqual(combined.XDRUG.inpatient, 2);
assert.strictEqual(combined.XDRUG.outpatient, 1);
assert.strictEqual(combined.XDRUG.total, 3);

console.log('vial-usage.test.cjs: all passed');