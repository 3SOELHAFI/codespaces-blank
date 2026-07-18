import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCacheBustUrl } from '../refresh.js';

test('buildCacheBustUrl adds a fresh timestamp query parameter', () => {
  const url = buildCacheBustUrl('https://example.com/app?page=2');
  assert.match(url, /^\/app\?page=2&t=\d+$/);
});
