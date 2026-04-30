import { publicDataUrl } from '../../config';
import './Page8About.css';

const TEAM_MEMBERS = [
  {
    name: 'Peiyao Zhang',
    initials: 'PZ',
    image: 'images/Peiyao.jpeg',
    github: 'https://github.com/PeiyaoPearl',
    email: 'peiyaoz77@gmail.com',
  },
  {
    name: 'Xinrui Qi',
    initials: 'XQ',
    image: 'images/xinrui.png',
    github: 'https://github.com/XINRUIQI',
    email: 'xinruiqi7@gmail.com',
  },
  {
    name: 'Zixuan Deng',
    initials: 'ZD',
    image: 'images/zixuan.png',
    github: 'https://github.com/ZixuanDeng-UCL',
    email: 'ucfnzd0@ucl.ac.uk',
  },
  {
    name: 'Jiayi Jing',
    initials: 'JJ',
    image: 'images/jiayi.png',
    github: 'https://github.com/ChloeJing0616',
    email: 'jiayijing616@gmail.com',
  },
];

const FOOTER_LINKS = [
  {
    label: 'Dataset',
    href: 'https://github.com/XINRUIQI/CASA0029-Data-Visualization-Group-Work/tree/main/Data',
  },
  {
    label: 'GitHub',
    href: 'https://github.com/XINRUIQI/CASA0029-Data-Visualization-Group-Work',
  },
];

function GitHubIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49v-1.72c-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.63.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.71 0 0 .84-.28 2.75 1.05A9.34 9.34 0 0 1 12 6.98c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.4.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.82c0 .27.18.59.69.49A10.16 10.16 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M4.25 5.5h15.5c.69 0 1.25.56 1.25 1.25v10.5c0 .69-.56 1.25-1.25 1.25H4.25C3.56 18.5 3 17.94 3 17.25V6.75c0-.69.56-1.25 1.25-1.25Zm.4 2.1v9.3h14.7V7.6L12 12.74 4.65 7.6Zm1.5-.6L12 11.1 17.85 7H6.15Z" />
    </svg>
  );
}

export default function Page8About() {
  return (
    <section id="page-8" className="page page-about">
      <div className="s8-about-section">
        <div className="about-panel">
          <div className="about-heading">
            <p className="about-eyebrow">About the Team</p>
            <h1>Credits</h1>
          </div>

          <div className="about-team-grid">
            {TEAM_MEMBERS.map((member, index) => (
              <article className="about-member-card" key={member.email} style={{ '--i': index }}>
                <div className="about-avatar" aria-hidden="true">
                  {member.image ? (
                    <img src={publicDataUrl(member.image)} alt="" />
                  ) : (
                    member.initials
                  )}
                </div>
                <h2>{member.name}</h2>
                <p className="about-role">Co-Producer</p>

                <div className="about-links">
                  <a href={member.github} target="_blank" rel="noreferrer">
                    <GitHubIcon />
                    <span>{member.github.replace('https://github.com/', '')}</span>
                  </a>
                  <a href={`mailto:${member.email}`}>
                    <MailIcon />
                    <span>{member.email}</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="about-footer">
          <div className="about-footer-actions" aria-label="Project resources">
            {FOOTER_LINKS.map((link) => (
              <a href={link.href} target="_blank" rel="noreferrer" key={link.label}>
                {link.label}
              </a>
            ))}
          </div>
          <p>
            Copyright Peiyao Zhang, Xinrui Qi, Zixuan Deng, Jiayi Jing from
            University College London.
          </p>
          <p>The Bartlett Centre for Advanced Spatial Analysis</p>
        </footer>
      </div>
    </section>
  );
}
