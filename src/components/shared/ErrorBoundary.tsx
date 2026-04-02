import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '32px',
            background: '#333333',
            color: '#f5f5f5',
            fontFamily: 'monospace',
            fontSize: '13px',
            minHeight: '100vh',
            boxSizing: 'border-box',
          }}
        >
          <div style={{ color: '#ef4444', fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>
            ⚠ Erro na Aplicação
          </div>
          {import.meta.env.DEV ? (
            <>
              <div style={{ color: '#fca5a5', marginBottom: '12px', wordBreak: 'break-all' }}>
                {this.state.error.message}
              </div>
              {this.state.error.stack && (
                <pre style={{ color: '#6b6b6b', fontSize: '11px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {this.state.error.stack}
                </pre>
              )}
            </>
          ) : (
            <div style={{ color: '#fca5a5', marginBottom: '12px' }}>
              Ocorreu um erro inesperado. Recarregue a página ou entre em contato com o suporte.
            </div>
          )}
        </div>
      )
    }
    return this.props.children
  }
}
