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
        <div className="flex min-h-screen items-center justify-center bg-[#2c2c2c] px-4">
          <div className="w-full max-w-md rounded-xl border border-[#525252] bg-[#333333] p-6 text-center shadow-xl">
            <h1 className="text-lg font-semibold text-[#f5f5f5]">Nao foi possivel abrir esta tela.</h1>
            <p className="mt-2 text-sm text-[#a3a3a3]">
              Recarregue a pagina ou volte para o menu lateral. O erro tecnico foi registrado no console.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg border border-[#f97316]/50 px-4 py-2 text-sm font-semibold text-[#f97316] hover:bg-[#f97316]/10"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
