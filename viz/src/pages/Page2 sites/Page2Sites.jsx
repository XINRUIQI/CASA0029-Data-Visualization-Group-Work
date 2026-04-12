import { useState, useEffect } from 'react';
import { publicDataUrl } from '../../config';
import './Page2Sites.css';

export default function Page2Sites() {
  const [sites, setSites] = useState([]);

  useEffect(() => {
    fetch(publicDataUrl('data/page2_sites.json'))
      .then(r => r.json())
      .then(setSites)
      .catch(() => {});
  }, []);

  return (
    <section id="page-2" className="page page-2-sites">
      <div className="p2s-placeholder">
        <p className="p2s-kicker">Chapter 2</p>
        <h1>现状点位总览</h1>
        <p className="p2s-desc">
          深圳现有 <strong>{sites.length}</strong> 个无人机起降点位，
          覆盖餐饮外卖、快递物流、医疗急送、公园景区、跨境运输五大场景。
        </p>
        <p className="p2s-hint">页面建设中 — 场景卡片、覆盖率分析、空白区地图即将接入</p>
      </div>
    </section>
  );
}
