/**
 * useIntegrationPipeline — Mounts the Cadeia de Construção data pipes.
 * Should be called once in AppShell so the pipes are active on every page.
 */
import { useEffect } from 'react'
import { subscribeIntegrationPipeline } from '@/store/integrationPipeline'

export function useIntegrationPipeline() {
  useEffect(() => {
    const unsubscribe = subscribeIntegrationPipeline()
    return unsubscribe
  }, [])
}
