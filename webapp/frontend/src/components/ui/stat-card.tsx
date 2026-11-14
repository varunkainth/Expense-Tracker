import type { ReactNode } from 'react';
export function StatCard({ label, value, detail, icon }: {
    label: string;
    value: string;
    detail: string;
    icon: ReactNode;
}) {
    return <article className="stat-card"><div className="stat-top"><span>{label}</span><span className="icon-tile">{icon}</span></div><strong>{value}</strong><small>{detail}</small></article>;
}
