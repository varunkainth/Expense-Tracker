import { lazy, Suspense } from 'react';
import type { FeatureLink } from '../../../app/navigation';
const WorkspacePage = lazy(() => import('../../workspace/pages/workspace-page').then((module) => ({ default: module.WorkspacePage })));
export function ModulePage({ feature }: { feature: FeatureLink }) { return <Suspense fallback={<section className="panel" role="status">Opening workspace…</section>}><WorkspacePage feature={feature} /></Suspense>; }
