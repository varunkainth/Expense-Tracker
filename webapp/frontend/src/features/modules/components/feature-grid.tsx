import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { FeatureLink } from '../../../app/navigation';
export function FeatureGrid({ features }: { features: FeatureLink[] }) {
  return <div className="feature-grid">{features.map(({ path, label, description, icon: Icon, available }) => <Link className="feature-card" key={path} to={path}>
    <div className="feature-card-top"><span className="icon-tile"><Icon size={21} /></span><ArrowUpRight size={17} /></div><h3>{label}</h3><p>{description}</p><span className="module-status">{available ? 'Open workspace' : 'Web module coming next'}</span>
  </Link>)}</div>;
}
