"use client"

import React from "react"
import { AlertTriangleIcon } from "lucide-react"

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] Panel error:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-xl p-6 flex flex-col items-center gap-3 text-center"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }}
        >
          <AlertTriangleIcon className="w-6 h-6" style={{ color: "var(--accent)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
            This panel couldn&apos;t load
          </p>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Refresh the page to try again, or contact support if the problem persists.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-xs underline"
            style={{ color: "var(--accent)" }}
          >
            Refresh
          </button>
        </div>
      )
    }

    return this.props.children
  }
}