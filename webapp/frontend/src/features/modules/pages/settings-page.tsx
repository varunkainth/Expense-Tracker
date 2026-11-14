import { navigationGroups } from '../../../app/navigation';
import { PageHeader } from '../../../components/ui/page-header';
import { FeatureGrid } from '../components/feature-grid';
export function SettingsPage() {
  return <><PageHeader eyebrow="YOUR WORKSPACE, YOUR WAY" title="Settings" description="Preferences, planning, privacy, and your local data." />{navigationGroups.filter((group) => group.label !== 'Workspace').map((group) => <section className="settings-group" key={group.label}><h2>{group.label}</h2><FeatureGrid features={group.items.filter((feature) => feature.path !== '/settings')} /></section>)}</>;
}
