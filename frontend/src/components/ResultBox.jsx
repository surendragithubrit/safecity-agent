export default function ResultBox({ title, children, tone = "neutral" }) {
  return (
    <div className={`result-box ${tone}`}>
      <h3>{title}</h3>
      {children}
    </div>
  );
}
