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

const context = {};
vm.createContext(context);
context.isVehicle = () => false;
vm.runInContext(loadFunction('getPatientKey'), context);
vm.runInContext(loadFunction('getSessionBucket'), context);
vm.runInContext(loadFunction('countSessionPatients'), context);
vm.runInContext(loadFunction('buildAmPmStatsForDate'), context);

const rows = [
  { patient: 'A', regNo: '1', category: 'AM' },
  { patient: 'A', regNo: '1', category: 'PM' },
  { patient: 'B', regNo: '2', category: 'AM' },
  { patient: 'B', regNo: '2', category: 'AM' },
  { patient: 'C', regNo: '3', category: 'PM' },
];

assert.strictEqual(context.countSessionPatients(rows), 4);
assert.strictEqual(context.countSessionPatients([{ patient: 'A', regNo: '1' }, { patient: 'A', regNo: '1' }]), 1);

assert.strictEqual(context.buildAmPmStatsForDate([
  { patient: 'A', regNo: '1', ampm: '오전', code: 'X1' },
  { patient: 'A', regNo: '1', ampm: '오후', code: 'X2' },
  { patient: 'B', regNo: '2', ampm: '오전', code: 'X3' },
  { patient: 'B', regNo: '2', ampm: '오전', code: 'X4' },
  { patient: 'C', regNo: '3', ampm: '오후', code: 'X5' },
], []).inP, 4);
