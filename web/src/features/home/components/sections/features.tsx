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
import {
  Boxes,
  CircleDollarSign,
  Code,
  KeyRound,
  MoonStar,
  Route,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

interface FeaturesProps {
  className?: string
}

export function Features(_props: FeaturesProps) {
  const { t } = useTranslation()

  const features = [
    {
      id: 'deepseek',
      num: '01',
      title: t('Only DeepSeek'),
      desc: t(
        'We serve the DeepSeek model family and nothing else, so a request never lands on a model you did not ask for.'
      ),
      span: 'md:col-span-2',
      icon: <Boxes className='size-4 text-blue-500' />,
      visual: (
        <div className='mt-4 flex flex-wrap items-center gap-2'>
          <span className='rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 font-mono text-xs text-blue-600 dark:text-blue-400'>
            deepseek-v4.1-flash
          </span>
          {['gpt-4o', 'claude-sonnet', 'gemini-2.5-pro'].map((name) => (
            <span
              key={name}
              className='text-muted-foreground/40 rounded-lg border border-dashed px-3 py-1.5 font-mono text-xs line-through'
            >
              {name}
            </span>
          ))}
        </div>
      ),
    },
    {
      id: 'price',
      num: '02',
      title: t('0.3× the official price'),
      desc: t(
        'Input, output and cache reads are billed at 0.3× the price DeepSeek publishes. No subscription, no minimum spend.'
      ),
      span: 'md:col-span-1',
      icon: <Wallet className='size-4 text-sky-500' />,
      visual: (
        <div className='mt-4 space-y-2.5'>
          <div className='flex items-center gap-3'>
            <span className='text-muted-foreground w-20 shrink-0 text-xs'>
              DeepSeek
            </span>
            <span className='bg-muted h-2.5 flex-1 overflow-hidden rounded-full'>
              <span className='bg-foreground/25 block h-full w-full' />
            </span>
            <span className='text-muted-foreground w-10 shrink-0 text-right font-mono text-xs'>
              1×
            </span>
          </div>
          <div className='flex items-center gap-3'>
            <span className='w-20 shrink-0 text-xs font-medium'>Blue API</span>
            <span className='bg-muted h-2.5 flex-1 overflow-hidden rounded-full'>
              <span className='block h-full w-[30%] rounded-full bg-gradient-to-r from-blue-600 to-cyan-400' />
            </span>
            <span className='w-10 shrink-0 text-right font-mono text-xs font-semibold text-blue-600 dark:text-blue-400'>
              0.3×
            </span>
          </div>
        </div>
      ),
    },
    {
      id: 'offpeak',
      num: '03',
      title: t('Half price when it is quiet'),
      desc: t(
        'Off-peak hours cost half of peak hours, so a job left running overnight costs a quarter of the official price.'
      ),
      span: 'md:col-span-1',
      icon: <MoonStar className='size-4 text-cyan-500' />,
      visual: (
        <div className='mt-4 space-y-2'>
          {[
            { label: t('Peak'), width: 'w-full', tone: 'bg-blue-500/70' },
            { label: t('Off-peak'), width: 'w-1/2', tone: 'bg-cyan-400/70' },
          ].map((row) => (
            <div key={row.label} className='flex items-center gap-3'>
              <span className='text-muted-foreground w-16 shrink-0 text-xs'>
                {row.label}
              </span>
              <span className='bg-muted h-2.5 flex-1 overflow-hidden rounded-full'>
                <span
                  className={`block h-full rounded-full ${row.width} ${row.tone}`}
                />
              </span>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: 'api',
      num: '04',
      title: t('Drop-in OpenAI API'),
      desc: t(
        'Point any OpenAI-compatible client at our Base URL. No SDK change, no protocol rewrite.'
      ),
      span: 'md:col-span-2',
      icon: <Code className='size-4 text-indigo-500' />,
      visual: (
        <div className='mt-4 flex items-center gap-3'>
          <div className='flex -space-x-2'>
            {['API', 'SDK', 'CLI', 'Docs'].map((n) => (
              <div
                key={n}
                className='border-background from-muted to-muted/60 text-muted-foreground flex size-8 items-center justify-center rounded-full border-2 bg-gradient-to-br text-[9px] font-bold'
              >
                {n}
              </div>
            ))}
          </div>
          <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
            <Code className='size-3.5 text-blue-500' />
            {t('OpenAI Compatible')}
          </div>
        </div>
      ),
    },
  ]

  const additionalFeatures = [
    {
      icon: <KeyRound className='size-5' strokeWidth={1.5} />,
      title: t('Per-key quotas'),
      desc: t(
        'Every API key carries its own quota and concurrency limit, so one runaway script cannot drain the account.'
      ),
    },
    {
      icon: <Route className='size-5' strokeWidth={1.5} />,
      title: t('Stable per key'),
      desc: t(
        'A key keeps talking to the same upstream account, so replies stay consistent instead of hopping between them.'
      ),
    },
    {
      icon: <Wallet className='size-5' strokeWidth={1.5} />,
      title: t('Prepaid credits'),
      desc: t(
        'Top up and pay per token. Nothing is charged while you are not calling the API.'
      ),
    },
    {
      icon: <CircleDollarSign className='size-5' strokeWidth={1.5} />,
      title: t('Transparent Billing'),
      desc: t('Pay-as-you-go with real-time usage monitoring'),
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-lg'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Why Blue API')}
          </p>
          <h2 className='text-3xl leading-tight font-bold tracking-[-0.02em] md:text-4xl'>
            {t('One model,')}
            <br />
            {t('one honest price')}
          </h2>
        </AnimateInView>

        {/* Bento grid */}
        <div className='border-border/40 bg-border/40 grid gap-px overflow-hidden rounded-xl border md:grid-cols-3'>
          {features.map((f, i) => (
            <AnimateInView
              key={f.id}
              delay={i * 100}
              animation='scale-in'
              className={`bg-background group hover:bg-muted/20 p-7 transition-colors duration-300 md:p-8 ${f.span}`}
            >
              <div className='mb-3 flex items-center gap-3'>
                <span className='border-border/40 bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums'>
                  {f.num}
                </span>
                <h3 className='text-sm font-semibold'>{f.title}</h3>
              </div>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {f.desc}
              </p>
              {f.visual}
            </AnimateInView>
          ))}
        </div>

        {/* Additional features row */}
        <div className='mt-12 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12'>
          {additionalFeatures.map((f, i) => (
            <AnimateInView
              key={f.title}
              delay={i * 100}
              animation='fade-up'
              className='flex flex-col items-center text-center'
            >
              <div className='text-muted-foreground border-border/50 bg-muted/30 group-hover:text-foreground mb-3 flex size-12 items-center justify-center rounded-xl border transition-colors'>
                {f.icon}
              </div>
              <h3 className='mb-1.5 text-sm font-semibold'>{f.title}</h3>
              <p className='text-muted-foreground max-w-[200px] text-xs leading-relaxed'>
                {f.desc}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
