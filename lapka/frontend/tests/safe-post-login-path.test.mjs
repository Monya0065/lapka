import test from 'node:test';
import assert from 'node:assert/strict';

test('safePostLoginPath accepts simple internal paths', async () => {
  const { safePostLoginPath } = await import('../lib/constants.js');
  assert.equal(safePostLoginPath('/owner/vpn'), '/owner/vpn');
  assert.equal(safePostLoginPath('/pay/yookassa/chk_abc'), '/pay/yookassa/chk_abc');
});

test('safePostLoginPath trims and rejects open redirects', async () => {
  const { safePostLoginPath } = await import('../lib/constants.js');
  assert.equal(safePostLoginPath('  /owner/dashboard  '), '/owner/dashboard');
  assert.equal(safePostLoginPath(null), null);
  assert.equal(safePostLoginPath(''), null);
  assert.equal(safePostLoginPath('//evil.com'), null);
  assert.equal(safePostLoginPath('https://evil.com/phish'), null);
  assert.equal(safePostLoginPath('owner/vpn'), null);
});
