import { Palette } from 'lucide-react';
import { PageHeader } from '../../../components/ui/page-header';
import { ThemeSelector } from '../components/theme-selector';
import { useTheme } from '../components/theme-provider';
export function AppearancePage() {
  const { mode, resolved } = useTheme();
  return <><PageHeader eyebrow="MAKE IT YOURS" title="Appearance" description="Choose how your workspace feels, day or night." />
    <section className="panel appearance-panel"><span className="empty-icon"><Palette size={26} /></span><h2>Your workspace theme</h2><p className="muted">Choose Light, Dark, or System to follow your device automatically.</p><ThemeSelector />
    <p className="theme-status" role="status">{mode === 'system' ? `Following your device · ${resolved} theme` : `${mode === 'dark' ? 'Dark' : 'Light'} theme selected`}</p><p className="muted text-small">Your preference is saved in this browser and follows you across web pages. It does not change your phone’s theme.</p></section>
    <section className="panel theme-preview"><div className="section-heading"><h2>A preview of your everyday</h2><span className="pill">{resolved === 'dark' ? 'DARK' : 'LIGHT'}</span></div><div className="theme-preview-content"><div><span className="muted">Sample expense</span><h3>Morning coffee</h3><span className="payment-tag">Food · UPI</span></div><strong>₹120.00</strong></div><p className="muted text-small">Preview only. This sample is not saved as an expense.</p></section>
  </>;
}
