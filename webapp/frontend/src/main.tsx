import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/app';
import { ErrorBoundary } from './components/ui/error-boundary';
import './styles/global.css';
import { PairingProvider } from './features/connection/hooks/pairing-provider';
import { ThemeProvider } from './features/appearance/components/theme-provider';
createRoot(document.getElementById('root')!).render(<StrictMode><ErrorBoundary><ThemeProvider><PairingProvider><App /></PairingProvider></ThemeProvider></ErrorBoundary></StrictMode>);
