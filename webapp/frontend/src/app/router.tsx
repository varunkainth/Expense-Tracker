import { createBrowserRouter, Link, Navigate } from 'react-router-dom';
import { AppShell } from '../components/layout/app-shell';
import { DashboardPage } from '../features/dashboard/pages/dashboard-page';
import { ExpensesPage } from '../features/expenses/pages/expenses-page';
import { ConnectionPage } from '../features/connection/pages/connection-page';
import { AppearancePage } from '../features/appearance/pages/appearance-page';
import { ModulePage } from '../features/modules/pages/module-page';
import { CompanyPage } from '../features/modules/pages/company-page';
import { SettingsPage } from '../features/modules/pages/settings-page';
import { allFeatures } from './navigation';
export const router = createBrowserRouter([{ element: <AppShell />, children: [
  { index: true, element: <DashboardPage /> },
  { path: 'expenses', element: <ExpensesPage /> },
  { path: 'personal', element: <Navigate to="/expenses" replace /> },
  { path: 'company', element: <CompanyPage /> },
  { path: 'settings', element: <SettingsPage /> },
  { path: 'appearance', element: <AppearancePage /> },
  { path: 'connect', element: <ConnectionPage /> },
  ...allFeatures.filter((feature) => !['/', '/expenses', '/company', '/settings', '/appearance', '/connect'].includes(feature.path)).map((feature) => ({ path: feature.path.slice(1), element: <ModulePage feature={feature} /> })),
  { path: '*', element: <section className="panel empty-state"><h1>Page not found</h1><Link to="/">Back to overview</Link></section> },
] }]);
