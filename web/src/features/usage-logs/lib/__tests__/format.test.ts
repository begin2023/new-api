/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import assert from 'node:assert/strict'

import { describe, test } from 'vitest'

import { getResponseTimeColor } from '../format'

describe('getResponseTimeColor', () => {
  test('judges a stream by the time it spent writing, not by the wait for its first token', () => {
    // 550 tokens in the 5 s after a 16 s first token: 110 t/s, not 26.
    assert.equal(getResponseTimeColor(21, 550, 16), 'success')
  })

  test('falls back to the whole call when the first token was not timed', () => {
    assert.equal(getResponseTimeColor(21, 550), 'warning')
  })

  test('falls back to the duration when the write window is not usable', () => {
    // The first token arrived with the last one, so no speed can be read.
    assert.equal(getResponseTimeColor(14, 149, 14), 'warning')
  })

  test('reads a short reply that wrote fast after a slow start', () => {
    assert.equal(getResponseTimeColor(3, 164, 1.7), 'success')
  })
})
