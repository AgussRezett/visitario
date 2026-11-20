import { Component, type ReactNode } from 'react'
import { ErrorScreen } from '@/features/errors/components/ErrorScreen'

/** The last net: a crash outside any screen (the router itself, a provider) still shows the error screen. */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  override state: { error: unknown } = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  override render() {
    return this.state.error ? <ErrorScreen error={this.state.error} /> : this.props.children
  }
}
