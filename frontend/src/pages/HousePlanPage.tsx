import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import HousePlanEditor from '@/components/plan2d/HousePlanEditor';

export default function HousePlanPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="space-y-5">
      <Link to="/admin/chantiers" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} /> Back to sites
      </Link>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">Site #{id}</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">House floor plan</h1>
      </div>
      <HousePlanEditor />
    </div>
  );
}
