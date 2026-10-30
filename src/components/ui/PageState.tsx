import type { ReactNode } from 'react'
import { usePageLoad } from '@/mock/store'
import { ErrorState, PageSkeleton } from './feedback'

/**
 * Wraps a page body with simulated loading / error states.
 * `children` is a render function so data is only computed once "loaded".
 */
export function PageState({ loadKey, variant = 'list', children }: { loadKey?: string; variant?: 'list' | 'dashboard' | 'detail'; children: (ctx: { empty: boolean }) => ReactNode }) {
  const { state, retry, empty } = usePageLoad(loadKey)
  if (state === 'loading') return <PageSkeleton variant={variant} />
  if (state === 'error') return <ErrorState onRetry={retry} />
  return <>{children({ empty })}</>
}
