import Page1Slices from './Page1Slices';
import './Page1Slices.css';
import './Page1.css';

export const COMPOUND_COLORS = {
  residential: { rgb: [255, 107, 107], hex: '#ff6b6b', label: 'Residential' },
  park:        { rgb: [0, 232, 150],   hex: '#00e896', label: 'Park' },
  commercial:  { rgb: [255, 160, 40],  hex: '#ffa028', label: 'Commercial' },
  campus:      { rgb: [200, 100, 255], hex: '#c864ff', label: 'Campus' },
  industrial:  { rgb: [100, 200, 255], hex: '#64c8ff', label: 'Industrial' },
};

export default function Page1Landing() {
  return (
    <section id="page-1" className="page page-1">
      <Page1Slices />
    </section>
  );
}
