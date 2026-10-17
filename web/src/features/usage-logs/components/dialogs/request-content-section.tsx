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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'

import { getLogRequestContent } from '../../api'
import { DetailSection } from './log-detail-layout'

/**
 * The client request body archived for one log row. Keeping the archive is the
 * operator's choice, so a row without an entry shows the server's own message
 * instead of an error. The body is fetched only when asked for: it can be large
 * and most rows are never inspected.
 */
export function RequestContentSection(props: { requestId: string }) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [message, setMessage] = useState('')

  const load = () => {
    setContent('')
    setMessage('')
    getLogRequestContent(props.requestId)
      .then((body) => {
        if (body) {
          setContent(body)
        } else {
          setMessage(t('No request content found for this request'))
        }
      })
      .catch((error: unknown) => {
        setMessage(
          error instanceof Error && error.message
            ? error.message
            : t('No request content found for this request')
        )
      })
  }

  const display = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      // A truncated or non-JSON body is shown exactly as archived.
      return content
    }
  }, [content])

  return (
    <DetailSection label={t('Request Content')}>
      {!content && (
        <Button variant='outline' size='sm' onClick={load}>
          {t('Show request content')}
        </Button>
      )}
      {message && <p className='text-muted-foreground text-xs'>{message}</p>}
      {content && (
        <>
          <div className='flex justify-end'>
            <CopyButton value={content} />
          </div>
          <pre className='bg-background/60 max-h-64 overflow-y-auto rounded border p-2 font-mono text-[11px] leading-relaxed wrap-break-word whitespace-pre-wrap'>
            {display}
          </pre>
        </>
      )}
    </DetailSection>
  )
}
