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
import { Gauge, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Dialog } from '@/components/dialog'
import { StatusBadge, type StatusVariant } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import { toIntlLocale } from '@/i18n/languages'
import { formatTimestampRelative } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { createServerError } from '@/lib/server-error-message'
import { cn } from '@/lib/utils'

import {
  getClinePassChannels,
  refreshClinePassChannels,
  type ClinePassChannel,
  type ClinePassWindow,
} from '../../api'
import { CHANNEL_STATUS, CHANNEL_STATUS_CONFIG } from '../../constants'

// clinePassWindows is the window set ClinePass reports, in the order it is
// shown, so an account missing one says so instead of hiding the row.
const CLINE_PASS_WINDOWS = [
  { type: 'five_hour', label: '5-hour window' },
  { type: 'weekly', label: 'Weekly window' },
  { type: 'monthly', label: 'Monthly window' },
] as const

function windowOf(
  usage: ClinePassChannel['usage'],
  type: string
): ClinePassWindow | undefined {
  return usage?.windows?.find((window) => window.type === type)
}

// usageTone keeps the bar readable at a glance: what is close to its limit is
// what an administrator has to act on.
function usageTone(percent: number): { color: string; variant: StatusVariant } {
  if (percent >= 100) return { color: 'text-rose-500', variant: 'danger' }
  if (percent >= 80) return { color: 'text-amber-500', variant: 'warning' }
  return { color: 'text-emerald-500', variant: 'success' }
}

type ClinePassUsageDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ClinePassUsageDialog(props: ClinePassUsageDialogProps) {
  const { t, i18n } = useTranslation()
  const [accounts, setAccounts] = useState<ClinePassChannel[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const locale = toIntlLocale(i18n.resolvedLanguage || i18n.language)
  const percentFormatter = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  })

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await getClinePassChannels()
      if (!res.success) {
        throw createServerError(res, t('Failed to load ClinePass usage'))
      }
      setAccounts(res.data ?? [])
    } catch (error: unknown) {
      handleServerError(error, t('Failed to load ClinePass usage'))
    } finally {
      setIsLoading(false)
    }
  }, [t])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const res = await refreshClinePassChannels()
      if (!res.success) {
        throw createServerError(res, t('Failed to refresh ClinePass usage'))
      }
      setAccounts(res.data ?? [])
      toast.success(t('ClinePass usage refreshed'))
    } catch (error: unknown) {
      handleServerError(error, t('Failed to refresh ClinePass usage'))
    } finally {
      setIsRefreshing(false)
    }
  }, [t])

  useEffect(() => {
    if (!props.open) return
    void load()
  }, [props.open, load])

  let content: React.ReactNode
  if (isLoading) {
    content = (
      <div className='text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm'>
        <Spinner />
        {t('Loading...')}
      </div>
    )
  } else if (accounts.length === 0) {
    content = (
      <Empty className='py-10'>
        <EmptyHeader>
          <Gauge className='text-muted-foreground h-8 w-8' />
          <EmptyTitle>{t('No ClinePass accounts')}</EmptyTitle>
          <EmptyDescription>
            {t(
              'Add a channel whose base URL points at api.cline.bot, then refresh.'
            )}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  } else {
    content = (
      <div className='grid gap-3 sm:grid-cols-2'>
        {accounts.map((account) => (
          <ClinePassAccountCard
            key={account.id}
            account={account}
            percentFormatter={percentFormatter}
            locale={locale}
            t={t}
          />
        ))}
      </div>
    )
  }

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('ClinePass accounts')}
      description={t(
        'Windows of every ClinePass account behind this pool. An account out of window stops receiving traffic until it resets.'
      )}
      contentClassName='sm:max-w-3xl'
      footer={
        <Button onClick={() => void refresh()} disabled={isRefreshing}>
          {isRefreshing ? <Spinner /> : <RefreshCw className='h-4 w-4' />}
          {t('Refresh now')}
        </Button>
      }
    >
      {content}
    </Dialog>
  )
}

type ClinePassAccountCardProps = {
  account: ClinePassChannel
  percentFormatter: Intl.NumberFormat
  locale?: string
  t: ReturnType<typeof useTranslation>['t']
}

function ClinePassAccountCard(props: ClinePassAccountCardProps) {
  const { account, percentFormatter, locale, t } = props
  const status = CHANNEL_STATUS_CONFIG[
    account.status as keyof typeof CHANNEL_STATUS_CONFIG
  ]
  const outOfWindow = account.status === CHANNEL_STATUS.AUTO_DISABLED

  return (
    <div className='flex flex-col gap-3 rounded-lg border p-3'>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>{account.name}</div>
          <div className='text-muted-foreground truncate text-xs'>
            #{account.id} · {account.group || '-'}
          </div>
        </div>
        <StatusBadge
          label={t(status?.label ?? 'Unknown')}
          variant={outOfWindow ? 'warning' : (status?.variant ?? 'neutral')}
        />
      </div>

      <div className='flex flex-col gap-2'>
        {CLINE_PASS_WINDOWS.map((known) => {
          const window = windowOf(account.usage, known.type)
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
          return (
            <div key={known.type} className='flex flex-col gap-1'>
              <div className='flex items-center justify-between gap-2 text-xs'>
                <span className='text-muted-foreground'>{t(known.label)}</span>
                <span className='flex items-center gap-2'>
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
                  <span className={cn('font-medium', tone.color)}>
                    {percentFormatter.format(window.percent_used)}%
                  </span>
                </span>
              </div>
              <Progress
                value={Math.min(100, Math.max(0, window.percent_used))}
                aria-label={t(known.label)}
                className={cn(
                  'w-full [&_[data-slot=progress-indicator]]:bg-current',
                  tone.color
                )}
              />
            </div>
          )
        })}
      </div>

      <div className='text-muted-foreground flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs'>
        <span>
          {t('Balance')}: {account.usage?.balance || '—'}
        </span>
        {account.usage?.updated_time ? (
          <span>
            {t('Updated {{time}}', {
              time: formatTimestampRelative(
                account.usage.updated_time,
                'seconds',
                locale
              ),
            })}
          </span>
        ) : null}
      </div>

      {account.usage?.error ? (
        <p className='text-destructive text-xs break-words'>
          {account.usage.error}
        </p>
      ) : null}
      {!account.usage?.error && account.status_reason ? (
        <p className='text-muted-foreground text-xs break-words'>
          {account.status_reason}
        </p>
      ) : null}
    </div>
  )
}
