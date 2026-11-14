import { Component, type ErrorInfo, type ReactNode } from 'react';
export class ErrorBoundary extends Component<{
    children: ReactNode;
}, {
    failed: boolean;
}> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: Error, info: ErrorInfo) { console.error('Workspace error', error, info.componentStack); }
    render() {
        if (this.state.failed)
            return <main className="startup"><h1>Unable to open your workspace</h1><p>Browser storage may be unavailable. Try a regular browser window and allow site storage.</p><button onClick={() => window.location.reload()}>Try again</button></main>;
        return this.props.children;
    }
}
