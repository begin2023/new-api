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
import { render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { expect, test } from 'vitest'

import { ClinePassUsageDetails } from '../clinepass-usage'

async function renderUsage(
  usage: Parameters<typeof ClinePassUsageDetails>[0]['usage']
) {
  const i18n = createInstance()
  await i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources: { en: { translation: {} } },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <ClinePassUsageDetails usage={usage} />
    </I18nextProvider>
  )
}

test('shows what each window has left of its plan cap', async () => {
  await renderUsage({
    windows: [
      { type: 'five_hour', percent_used: 1, resets_at: 0 },
      { type: 'weekly', percent_used: 15, resets_at: 0 },
      { type: 'monthly', percent_used: 100, resets_at: 0 },
    ],
    limits: { five_hour_usd: 10, weekly_usd: 25, monthly_usd: 50 },
    updated_time: 0,
  })

  expect(screen.getByText('$9.9 / $10 left')).toBeVisible()
  expect(screen.getByText('$21.25 / $25 left')).toBeVisible()
  expect(screen.getByText('$0 / $50 left')).toBeVisible()
})

test('leaves the amount out when the plan exposes no cap', async () => {
  await renderUsage({
    windows: [{ type: 'five_hour', percent_used: 1, resets_at: 0 }],
    updated_time: 0,
  })

  expect(screen.getByText('1%')).toBeVisible()
  expect(screen.queryByText(/left$/)).not.toBeInTheDocument()
})
