import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, Wallet, X } from 'lucide-react';
import { navigationGroups } from '../../app/navigation';
import { WorkspaceHeader } from './workspace-header';
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  return <div className="app-shell"><aside className="sidebar"><div className="sidebar-header"><Link className="brand" to="/" onClick={() => setMenuOpen(false)} aria-label="Expense Tracker home"><span className="brand-mark"><Wallet size={23} /></span><span>Expense Tracker<small>YOUR PERSONAL WORKSPACE</small></span></Link>
    <button type="button" className="icon-button mobile-menu-toggle" aria-label={menuOpen ? 'Close feature menu' : 'Open feature menu'} aria-expanded={menuOpen} aria-controls="feature-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div>
    <nav id="feature-navigation" className={`sidebar-navigation ${menuOpen ? 'is-open' : ''}`} aria-label="Main navigation">{navigationGroups.map((group) => <section className="nav-group" key={group.label}><h2 className="nav-heading">{group.label}</h2>{group.items.map(({ path, label, icon: Icon }) => <NavLink end={path === '/'} key={path} to={path} onClick={() => setMenuOpen(false)} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}><Icon size={18} /><span>{label}</span></NavLink>)}</section>)}</nav>
    <div className="sidebar-footer">WEB WORKSPACE <span>v0.1 · Local-first</span></div>
  </aside><div className="workspace"><WorkspaceHeader /><main className="content"><Outlet /></main><footer className="workspace-footer">Made for your everyday.<span>Local-first · No expense cloud database</span></footer></div></div>;
}
