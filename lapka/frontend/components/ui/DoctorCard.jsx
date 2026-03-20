import Badge from '@/components/ui/Badge';

export default function DoctorCard({ name = 'Д-р Елена Иванова', specialty = 'Терапевт', experience = '9 лет', rating = '4.9' }) {
  return (
    <article className="surface-card p-4 transition hover:-translate-y-0.5 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold tracking-tight text-lapka-900">{name}</h3>
          <p className="mt-1 text-sm text-lapka-600">{specialty} · {experience}</p>
        </div>
        <Badge tone="success">★ {rating}</Badge>
      </div>
    </article>
  );
}
