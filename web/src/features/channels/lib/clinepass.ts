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
import type { AdvancedCustomConfig } from '../types'

export const CLINE_PASS_BASE_URL = 'https://api.cline.bot/api'
// The name users call. Cline serves the same model under a prefixed name, so a
// ClinePass channel maps one to the other and never shows the prefix.
export const CLINE_PASS_MODEL = 'deepseek-v4.1-flash'
export const CLINE_PASS_UPSTREAM_MODEL = 'cline-pass/deepseek-v4.1-flash'
/** Marks the provider-picker entry that preconfigures a ClinePass account. */
export const CLINE_PASS_PRESET = 'clinepass'

export function isClinePassPreset(preset?: string): boolean {
  return preset === CLINE_PASS_PRESET
}

/**
 * A ClinePass account is a channel whose base URL points at Cline's
 * subscription API. The gateway identifies the same accounts by host.
 */
export function isClinePassBaseURL(baseURL?: string | null): boolean {
  if (!baseURL) return false
  try {
    return /(^|\.)cline\.bot$/i.test(new URL(baseURL).hostname)
  } catch {
    return false
  }
}

/**
 * Cline speaks the OpenAI chat protocol, so a new account needs no converter.
 */
export function clinePassAdvancedConfig(): AdvancedCustomConfig {
  return {
    advanced_routes: [
      {
        incoming_path: '/v1/chat/completions',
        upstream_path: '/v1/chat/completions',
        converter: 'none',
      },
    ],
  }
}
