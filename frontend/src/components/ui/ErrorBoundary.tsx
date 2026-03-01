import { Component, ReactNode, ErrorInfo } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center gap-4 px-6">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-center">Что-то пошло не так</h1>
          <p className="text-sm text-slate-400 text-center max-w-sm">
            {this.state.error?.message ?? 'Произошла неизвестная ошибка'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 py-3 px-8 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition-colors"
          >
            Перезагрузить
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
