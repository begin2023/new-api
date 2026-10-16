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
import { KeyRound, Terminal, UserPlus } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { CopyButton } from '@/components/copy-button'
import { useStatus } from '@/hooks/use-status'

const MODEL_ID = 'deepseek-v4.1-flash'

export function HowItWorks() {
  const { t } = useTranslation()
  const { status } = useStatus()

  const baseUrl = useMemo(() => {
    const candidate =
      (status as Record<string, unknown> | null)?.server_address ??
      (status as Record<string, unknown> | null)?.serverAddress ??
      (status?.data as Record<string, unknown> | undefined)?.server_address
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.replace(/\/+$/, '')
    }
    return typeof window === 'undefined' ? '' : window.location.origin
  }, [status])

  const endpoint = `${baseUrl}/v1`
  const curl = `curl ${endpoint}/chat/completions \\
  -H "Authorization: Bearer $BLUE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"${MODEL_ID}","messages":[{"role":"user","content":"Hello!"}]}'`

  const steps = [
    {
      num: '1',
      title: t('Register and top up'),
      desc: t(
        'Create an account and add credits. Billing is per token, so nothing is charged until you call the API.'
      ),
      icon: <UserPlus className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '2',
      title: t('Create an API key'),
      desc: t(
        'Create a key in the console and copy it. Every key carries its own quota and concurrency limit.'
      ),
      icon: <KeyRound className='size-6' strokeWidth={1.5} />,
    },
    {
      num: '3',
      title: t('Call the API'),
      desc: t(
        'Point your OpenAI-compatible client at the Base URL below and use the model {{model}}.',
        { model: MODEL_ID }
      ),
      icon: <Terminal className='size-6' strokeWidth={1.5} />,
    },
  ]

  const connection = [
    { label: t('Base URL'), value: endpoint },
    { label: t('Model Name'), value: MODEL_ID },
  ]

  return (
    <section className='border-border/40 relative z-10 border-t px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 text-center md:mb-20'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('How It Works')}
          </p>
          <h2 className='text-3xl font-bold tracking-[-0.02em] md:text-4xl'>
            {t('Three steps to get started')}
          </h2>
        </AnimateInView>

        <div className='grid gap-8 md:grid-cols-3 md:gap-12'>
          {steps.map((step, i) => (
            <AnimateInView
              key={step.num}
              delay={i * 150}
              animation='fade-up'
              className='relative flex flex-col items-center text-center'
            >
              <div className='relative mb-6'>
                <div className='text-muted-foreground border-border/50 bg-muted/30 flex size-16 items-center justify-center rounded-2xl border transition-colors'>
                  {step.icon}
                </div>
                <div className='absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-xs font-bold text-white'>
                  {step.num}
                </div>
              </div>
              <h3 className='mb-2 text-base font-semibold'>{step.title}</h3>
              <p className='text-muted-foreground max-w-[260px] text-sm leading-relaxed'>
                {step.desc}
              </p>
            </AnimateInView>
          ))}
        </div>

        <AnimateInView
          className='mx-auto mt-16 max-w-3xl'
          animation='fade-up'
          delay={200}
        >
          <div className='overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.07] via-transparent to-cyan-400/[0.07]'>
            <div className='divide-border/40 grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0'>
              {connection.map((row) => (
                <div
                  key={row.label}
                  className='flex items-center justify-between gap-3 px-4 py-3.5'
                >
                  <div className='min-w-0'>
                    <div className='text-muted-foreground text-xs'>
                      {row.label}
                    </div>
                    <div className='truncate font-mono text-sm'>
                      {row.value}
                    </div>
                  </div>
                  <CopyButton value={row.value} tooltip={t('Copy')} />
                </div>
              ))}
            </div>
            <div className='border-border/40 bg-background/60 border-t p-4'>
              <div className='mb-2 flex items-center justify-between'>
                <span className='text-muted-foreground text-xs'>
                  {t('Example')}
                </span>
                <CopyButton value={curl} tooltip={t('Copy')} />
              </div>
              <pre className='text-foreground/80 overflow-x-auto font-mono text-xs leading-relaxed'>
                {curl}
              </pre>
            </div>
          </div>
        </AnimateInView>
      </div>
    </section>
  )
}
