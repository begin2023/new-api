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
import { useTranslation } from 'react-i18next'

import { Progress } from '@/components/ui/progress'
import { toIntlLocale } from '@/i18n/languages'
import { formatBillingCurrencyFromUSD } from '@/lib/currency'
import { formatTimestampRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { ClinePassLimits, ClinePassUsage } from '../types'

// The window set ClinePass reports, in the order it is shown, so an account
// missing one says so instead of hiding the row.
const CLINE_PASS_WINDOWS = [
  { type: 'five_hour', label: '5-hour window' },
  { type: 'weekly', label: 'Weekly window' },
  { type: 'monthly', label: 'Monthly window' },
] as const

// What is close to its limit is what an administrator has to act on, so the bar
// and the number carry the same tone.
function usageTone(percent: number): string {
  if (percent >= 100) return 'text-rose-500'
  if (percent >= 80) return 'text-amber-500'
  return 'text-emerald-500'
}

// The plan's cap for a window, so the remaining amount can be shown in USD.
function limitOf(
  limits: ClinePassLimits | null | undefined,
  type: string
): number | undefined {
  if (type === 'five_hour') return limits?.five_hour_usd
  if (type === 'weekly') return limits?.weekly_usd
  return limits?.monthly_usd
}

/**
 * The usage windows and balance of one ClinePass account, shared by the pool
 * dialog and the channel card so both read the same.
 */
export function ClinePassUsageDetails({
  usage,
}: {
  usage?: ClinePassUsage | null
}) {
  const { t, i18n } = useTranslation()
  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const percentFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  })

  return (
    <div className='flex flex-col gap-2'>
      {CLINE_PASS_WINDOWS.map((known) => {
        const window = usage?.windows?.find((item) => item.type === known.type)
        if (!window) {
          return (
            <div key={known.type} className='flex flex-col gap-1'>
              <div className='flex items-center justify-between text-xs'>
                <span className='text-muted-foreground'>{t(known.label)}</span>
                <span className='text-muted-foreground'>
                  {t('Not reported')}
                </span>
              </div>
              <Progress value={0} aria-label={t(known.label)} />
            </div>
          )
        }
        const tone = usageTone(window.percent_used)
        const limit = limitOf(usage?.limits, known.type)
        const remaining =
          limit === undefined
            ? undefined
            : (limit * (100 - window.percent_used)) / 100
        const money = { digitsLarge: 2, digitsSmall: 2, abbreviate: false }
        return (
          <div key={known.type} className='flex flex-col gap-1'>
            <div className='flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs'>
              <span className='text-muted-foreground'>{t(known.label)}</span>
              <span className='flex flex-wrap items-center gap-x-2'>
                {window.resets_at > 0 && (
                  <span className='text-muted-foreground'>
                    {t('Resets {{time}}', {
                      time: formatTimestampRelative(
                        window.resets_at,
                        'seconds',
                        locale
                      ),
                    })}
                  </span>
                )}
                {remaining !== undefined && limit !== undefined && (
                  <span className={cn('font-medium', tone)}>
                    {t('{{remaining}} / {{total}} left', {
                      remaining: formatBillingCurrencyFromUSD(remaining, money),
                      total: formatBillingCurrencyFromUSD(limit, money),
                    })}
                  </span>
                )}
                <span className='text-muted-foreground'>
                  {percentFormatter.format(window.percent_used)}%
                </span>
              </span>
            </div>
            <Progress
              value={Math.min(100, Math.max(0, window.percent_used))}
              aria-label={t(known.label)}
              className={cn(
                'w-full [&_[data-slot=progress-indicator]]:bg-current',
                tone
              )}
            />
          </div>
        )
      })}

      <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs'>
        <span>
          {t('Balance')}: {usage?.balance || '—'}
        </span>
        {usage?.updated_time ? (
          <span>
            {t('Updated {{time}}', {
              time: formatTimestampRelative(
                usage.updated_time,
                'seconds',
                locale
              ),
            })}
          </span>
        ) : null}
      </div>

      {usage?.error ? (
        <p className='text-destructive text-xs break-words'>{usage.error}</p>
      ) : null}
    </div>
  )
}
