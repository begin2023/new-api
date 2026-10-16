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
/**
 * What the vendor charges for the models this gateway resells, in USD per
 * million tokens, so a model page can show the same tokens priced both ways.
 *
 * The prices are the vendor's published ones and the multiplier is what this
 * gateway bills on top of them. Both are written here beside the billing
 * expression they describe: change the expression and this together, and check
 * the vendor's price page when they announce a change.
 */
export type VendorPriceReference = {
  vendor: string
  multiplier: number
  peak: VendorWindowPrice
  offPeak: VendorWindowPrice
}

export type VendorWindowPrice = {
  input: number
  output: number
  cacheRead?: number
}

export const VENDOR_PRICE_REFERENCES: Record<string, VendorPriceReference> = {
  'deepseek-v4.1-flash': {
    vendor: 'DeepSeek',
    multiplier: 0.3,
    peak: { input: 0.3, output: 1.2, cacheRead: 0.006 },
    offPeak: { input: 0.15, output: 0.6, cacheRead: 0.003 },
  },
}
