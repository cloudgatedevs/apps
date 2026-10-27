import assert from 'node:assert/strict';
import test from 'node:test';
import { toCents, fromCents } from '../src/shared/lib/money.js';
import { generateVariants, parseOptionValues } from '../src/admin/lib/product-variants.js';

test('prices accept decimal commas without multiplying the intended amount by 100', () => {
  for (const [input, cents] of [['349,00', 34900], ['349.00', 34900], ['0,99', 99], ['1.01', 101],
    ['1 234,56', 123456], ['1\u00a0234,56', 123456], ['1,234.56', 123456], ['1.234,56', 123456],
    [12.3, 1230], ['0', 0], ['-10,25', -1025]]) assert.equal(toCents(input), cents, String(input));
  for (const cents of [0, 1, 101, 34900, 2147483647]) assert.equal(toCents(fromCents(cents)), cents);
});

test('invalid, ambiguous and excessive-precision prices cannot silently become another amount', () => {
  for (const input of ['', ' ', null, undefined, 'abc', '1e3', '12oops34', '1,234', '1.234', '1.005',
    '12,34.56', '1 23,45', '1,2,3', '--1', Infinity, '99999999999999999']) assert.equal(toCents(input), null, String(input));
});

test('option values parse partial typed lists and ignore repeated combinations', () => {
  assert.deepEqual(parseOptionValues('S,'), ['S']);
  assert.deepEqual(parseOptionValues('S, M'), ['S', 'M']);
  assert.deepEqual(parseOptionValues('S, M, S, ,'), ['S', 'M']);
});

const sizes = values => [{ name: 'Size', values }];
test('adding a variant before an existing selected default preserves one default and its SKU data', () => {
  const existing = generateVariants(sizes(['S', 'M']), []).map(row => ({ ...row, isDefault: row.title === 'M', id: row.title, stockQty: 7, sku: `SKU-${row.title}` }));
  const updated = generateVariants(sizes(['L', 'S', 'M']), existing);
  assert.deepEqual(updated.filter(row => row.isDefault).map(row => row.title), ['M']);
  assert.equal(updated[2].id, 'M'); assert.equal(updated[2].stockQty, 7); assert.equal(updated[2].sku, 'SKU-M');
});

test('removing the default or the final option leaves a usable single default', () => {
  const existing = generateVariants(sizes(['S', 'M']), []);
  assert.equal(generateVariants(sizes(['M']), existing)[0].isDefault, true);
  const selected = existing.map(row => ({ ...row, id: row.title, isDefault: row.title === 'M', stockQty: 8 }));
  const collapsed = generateVariants([], selected);
  assert.equal(collapsed.length, 1); assert.equal(collapsed[0].title, 'Default');
  assert.deepEqual(collapsed[0].options, {}); assert.equal(collapsed[0].id, 'M'); assert.equal(collapsed[0].stockQty, 8);
  assert.equal(collapsed[0].isDefault, true);
});
