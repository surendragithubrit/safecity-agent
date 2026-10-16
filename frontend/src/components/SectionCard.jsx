export default function SectionCard({ id, title, subtitle, children }) {
  return (
    <section id={id} className="card">
      <div className="card-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}
