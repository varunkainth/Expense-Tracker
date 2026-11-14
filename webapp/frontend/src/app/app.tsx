import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { initializeDatabase } from '../lib/database/initialize';
import { usePairing } from '../features/connection/hooks/pairing-provider';
import { PairingScreen } from '../features/connection/components/pairing-screen';
export function App() {
    // Saved credentials must be verified by the backend before opening the paired workspace.
    const [browserOnly, setBrowserOnly] = useState(false);
    const { phase, dismissPending } = usePairing();
    if (!browserOnly && phase !== 'linked') return <PairingScreen onContinueLocal={() => { dismissPending(); setBrowserOnly(true); }} />;
    return <LocalWorkspace />;
}

function LocalWorkspace() {
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(false);
    useEffect(() => {
        let active = true;
        initializeDatabase().then(() => { if (active)
            setReady(true); }).catch(() => { if (active)
            setError(true); });
        return () => { active = false; };
    }, []);
    if (error)
        return <main className="startup"><h1>Local storage is unavailable</h1><p>Use a regular browser window and allow site storage, then reload.</p><button onClick={() => window.location.reload()}>Reload</button></main>;
    if (!ready)
        return <main className="startup" role="status">Opening your workspace…</main>;
    return <RouterProvider router={router}/>;
}
