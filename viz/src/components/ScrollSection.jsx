import './ScrollSection.css';

export default function ScrollSection({ id, children, className = '' }) {
  return (
    <section id={id} className={`scroll-section ${className}`}>
      {children}
    </section>
  );
}
