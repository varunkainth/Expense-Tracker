import { ChevronRight, HardDrive } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { allFeatures } from '../../app/navigation';
import { ThemeDropdown } from '../../features/appearance/components/theme-dropdown';

export function WorkspaceHeader() {
  const { pathname } = useLocation();
  const feature = allFeatures.find((item) => item.path === pathname);

  return (
    <header className="workspace-header">
      <nav className="workspace-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Workspace</Link>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">{feature?.label ?? 'Page'}</span>
      </nav>
      <div className="workspace-header-actions">
        <span className="device-storage" title="Expense records are stored locally in this browser.">
          <HardDrive size={14} aria-hidden="true" />
          <span>Local storage</span>
        </span>
        <span className="header-divider" aria-hidden="true" />
        <ThemeDropdown />
      </div>
    </header>
  );
}
