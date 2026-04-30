import { publicDataUrl } from '../../config';
import './Page7Summary.css';

const CONCLUSION_CARDS = [
  {
    kicker: '01',
    title: 'Conclusions',
    body:
      'This project explores how drone-based urban air mobility (UAM) can reshape ground delivery systems by introducing a three-dimensional logistics network. Through spatial analysis of landing & departure hubs distribution, coverage accessibility, and simulated flight routes, we have demonstrated that drone delivery has the potential to alleviate urban friction and significantly improve the efficiency of delivery services.',
  },
  {
    kicker: '02',
    title: 'Limitations',
    body:
      'This study relies on simplified assumptions and does not consider real-world constraints. The analysis focuses on spatial efficiency, without fully addressing cost, environmental impact, or social acceptance, which are essential for real-world implementation.',
  },
  {
    kicker: '03',
    title: 'Outlook',
    body:
      'Future work could integrate real-time data and demand prediction to improve simulation accuracy. Expanding the framework to include cost, environment, and equity would support more comprehensive planning. The project could also evolve into an interactive decision-support tool, helping planners test different scenarios for the low-altitude economy.',
  },
];

export default function Page7Summary() {
  return (
    <section id="page-7" className="page page-summary">
      <div className="s8-layout" aria-labelledby="s8-title">
        <article className="s8-video-card">
          <video
            className="s8-video"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={publicDataUrl('shenzhen-poster.jpg')}
          >
            <source
              src={publicDataUrl(
                'Delivery_Drone_Footage_A_white_drone_carries_a_brown_package_through_a_4bTItNS5.mp4'
              )}
              type="video/mp4"
            />
          </video>

          <div className="s8-video-overlay" />
          <div className="s8-video-copy">
            <h1 id="s8-title">Delivery, elevated.</h1>
            <p>
              Drone logistics can reduce Shenzhen's ground friction when it is deployed
              around real barriers, demand clusters, and coordinated urban infrastructure.
            </p>
          </div>
        </article>

        <div className="s8-card-grid" aria-label="Conclusion key messages">
          {CONCLUSION_CARDS.map((card) => (
            <article className="s8-text-card" key={card.title}>
              <span>{card.kicker}</span>
              <h2>{card.title}</h2>
              <p>{card.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
