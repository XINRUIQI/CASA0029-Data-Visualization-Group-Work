import { useState, useEffect, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import Page5Map from './Page5Map';
import { publicDataUrl } from '../../config';
import './Page5.css';

const TASK_TYPES = [
  {
    id: 'all',
    title: '综合',
    subtitle: '全部任务加权',
    hint: '不筛选任务类型，展示整体缓解脆弱度。',
    vignette: 'layers-all',
  },
  {
    id: 'park',
    title: '公园 / 滨水',
    subtitle: '景观与休闲密集',
    hint: '高 scenic + leisure：末端步行长、点位分散，地面补给弹性弱。',
    vignette: 'layers-park',
  },
  {
    id: 'campus',
    title: '校园 / 封闭园区',
    subtitle: '教育 + 形态封闭',
    hint: '高 education + 用途混合度：内部深度高，适合讨论「最后一公里」替代。',
    vignette: 'layers-campus',
  },
  {
    id: 'mall',
    title: '商场边缘 / 商业簇',
    subtitle: '零售餐饮就业混合',
    hint: '高 retail + food + 商务活动：峰值明显，适合「楼间/屋顶」接驳想象。',
    vignette: 'layers-mall',
  },
  {
    id: 'barrier',
    title: '绕行 / 割裂型城区',
    subtitle: '立体形态与体量',
    hint: '用建筑体量、密度与高层计数代理「割裂感」（非单条 OD，可与 Page3 对照）。',
    vignette: 'layers-barrier',
  },
];

const MODES = [
  {
    id: 'ground',
    title: '地面主导',
    body: '强调可达性修复、公交微枢纽与路权优化；地图色调越绿表示地面越「省力」。',
  },
  {
    id: 'hybrid',
    title: '混合模式',
    body: '地面承担干线，无人机处理跨障/深部片段；配色为需求—摩擦折中。',
  },
  {
    id: 'drone',
    title: '空域友好',
    body: '突出高中断成本区域（高脆弱格网）；适合讨论合规空域与起降密度。',
  },
];

const SUBSTITUTION_MATRIX = [
  { task: '公园/滨水', ground: 22, hybrid: 58, drone: 82 },
  { task: '校园/园区', ground: 18, hybrid: 72, drone: 78 },
  { task: '商场/商簇', ground: 45, hybrid: 68, drone: 52 },
  { task: '绕行/割裂', ground: 28, hybrid: 55, drone: 88 },
];

function minMaxNorm(values) {
  const finite = values.filter(v => Number.isFinite(v));
  if (!finite.length) return values.map(() => 0);
  const lo = Math.min(...finite);
  const hi = Math.max(...finite);
  const span = hi - lo || 1e-9;
  return values.map(v => (Number.isFinite(v) ? (v - lo) / span : 0));
}

function buildMergedCollection(demandFc, popFc, buildFc) {
  if (!demandFc?.features?.length) return null;
  const popById = new Map((popFc?.features || []).map(f => [f.properties.grid_id, f.properties]));
  const buildById = new Map((buildFc?.features || []).map(f => [f.properties.grid_id, f.properties]));

  const rows = demandFc.features.map(f => {
    const id = f.properties.grid_id;
    const d = f.properties || {};
    const p = popById.get(id) || {};
    const b = buildById.get(id) || {};
    return {
      geometry: f.geometry,
      grid_id: id,
      demand_pressure_norm: d.demand_pressure_norm ?? 0,
      demand_pressure: d.demand_pressure ?? 0,
      scenic_count: d.scenic_count ?? 0,
      leisure_count: d.leisure_count ?? 0,
      education_count: d.education_count ?? 0,
      retail_count: d.retail_count ?? 0,
      food_count: d.food_count ?? 0,
      intensity_index: p.intensity_index ?? 0,
      commercial_activity: p.commercial_activity ?? 0,
      employment_proxy: p.employment_proxy ?? 0,
      usage_diversity: b.usage_diversity ?? 0,
      building_density: b.building_density ?? 0,
      volume_density: b.volume_density ?? 0,
      n_tall: b.n_tall ?? 0,
      avg_height: b.avg_height ?? 0,
    };
  });

  const dpN = minMaxNorm(rows.map(r => r.demand_pressure_norm));
  const intN = minMaxNorm(rows.map(r => r.intensity_index));
  const divN = minMaxNorm(rows.map(r => r.usage_diversity));
  const bdnN = minMaxNorm(rows.map(r => r.building_density));
  const scN = minMaxNorm(rows.map(r => r.scenic_count));
  const leN = minMaxNorm(rows.map(r => r.leisure_count));
  const edN = minMaxNorm(rows.map(r => r.education_count));
  const rtN = minMaxNorm(rows.map(r => r.retail_count));
  const fdN = minMaxNorm(rows.map(r => r.food_count));
  const caN = minMaxNorm(rows.map(r => r.commercial_activity));
  const volN = minMaxNorm(rows.map(r => r.volume_density));
  const ntN = minMaxNorm(rows.map(r => r.n_tall));

  const features = rows.map((r, i) => {
    const relief =
      dpN[i] *
      intN[i] *
      (0.45 + 0.55 * divN[i]) *
      (0.55 + 0.45 * bdnN[i]);

    const wPark = 0.5 * scN[i] + 0.5 * leN[i];
    const wCampus = 0.55 * edN[i] + 0.45 * divN[i];
    const wMall = 0.34 * rtN[i] + 0.33 * fdN[i] + 0.33 * caN[i];
    const wBarrier = 0.42 * volN[i] + 0.33 * bdnN[i] + 0.25 * ntN[i];

    const {
      geometry,
      grid_id,
      demand_pressure_norm,
      demand_pressure,
      scenic_count,
      leisure_count,
      education_count,
      retail_count,
      food_count,
      intensity_index,
      commercial_activity,
      employment_proxy,
      usage_diversity,
      building_density,
      volume_density,
      n_tall,
      avg_height,
    } = r;

    return {
      type: 'Feature',
      properties: {
        grid_id,
        demand_pressure_norm,
        demand_pressure,
        scenic_count,
        leisure_count,
        education_count,
        retail_count,
        food_count,
        intensity_index,
        commercial_activity,
        employment_proxy,
        usage_diversity,
        building_density,
        volume_density,
        n_tall,
        avg_height,
        relief_vulnerability: relief,
        w_park: wPark,
        w_campus: wCampus,
        w_mall: wMall,
        w_barrier: wBarrier,
        substitution_potential: relief,
      },
      geometry,
    };
  });

  const pot = minMaxNorm(features.map(f => f.properties.relief_vulnerability));
  features.forEach((f, i) => {
    f.properties.substitution_potential = pot[i];
  });

  return { type: 'FeatureCollection', features };
}

function taskWeightFor(props, taskId) {
  if (taskId === 'all') return 1;
  if (taskId === 'park') return props.w_park ?? 0;
  if (taskId === 'campus') return props.w_campus ?? 0;
  if (taskId === 'mall') return props.w_mall ?? 0;
  if (taskId === 'barrier') return props.w_barrier ?? 0;
  return 1;
}

export default function Page5Strategy() {
  const [demandGrid, setDemandGrid] = useState(null);
  const [popGrid, setPopGrid] = useState(null);
  const [buildGrid, setBuildGrid] = useState(null);
  const [selectedTask, setSelectedTask] = useState('all');
  const [mode, setMode] = useState('hybrid');
  const [highPriorityOnly, setHighPriorityOnly] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [sortByPotential, setSortByPotential] = useState(true);

  useEffect(() => {
    fetch(publicDataUrl('data/demand_grid.json'))
      .then(r => r.json())
      .then(setDemandGrid)
      .catch(() => {});
    fetch(publicDataUrl('data/population_grid.json'))
      .then(r => r.json())
      .then(setPopGrid)
      .catch(() => {});
    fetch(publicDataUrl('data/building_grid.json'))
      .then(r => r.json())
      .then(setBuildGrid)
      .catch(() => {});
  }, []);

  const mergedRaw = useMemo(
    () => buildMergedCollection(demandGrid, popGrid, buildGrid),
    [demandGrid, popGrid, buildGrid]
  );

  const priorityThreshold = useMemo(() => {
    if (!mergedRaw?.features?.length) return 0;
    const vals = mergedRaw.features.map(f => f.properties.relief_vulnerability).sort((a, b) => a - b);
    const idx = Math.floor(vals.length * 0.66);
    return vals[idx] ?? 0;
  }, [mergedRaw]);

  const gridGeoJson = useMemo(() => {
    if (!mergedRaw) return null;
    const features = mergedRaw.features.map(f => {
      const tw = taskWeightFor(f.properties, selectedTask);
      return {
        ...f,
        properties: { ...f.properties, task_weight: tw },
      };
    });
    return { type: 'FeatureCollection', features };
  }, [mergedRaw, selectedTask]);

  const rankedCells = useMemo(() => {
    if (!mergedRaw?.features) return [];
    const list = mergedRaw.features.map(f => {
      const p = f.properties;
      const tw = taskWeightFor(p, selectedTask);
      const potential = p.relief_vulnerability * (selectedTask === 'all' ? 1 : 0.4 + 0.6 * tw);
      return { ...p, _potential: potential };
    });
    list.sort((a, b) => (sortByPotential ? b._potential - a._potential : a.grid_id - b.grid_id));
    return list.slice(0, 14);
  }, [mergedRaw, selectedTask, sortByPotential]);

  const composition = selectedCell
    ? [
        { name: '需求压力', value: selectedCell.demand_pressure_norm ?? 0 },
        { name: '活动强度', value: selectedCell.intensity_index ?? 0 },
        { name: '用途混合', value: selectedCell.usage_diversity ?? 0 },
        { name: '建筑密度', value: selectedCell.building_density ?? 0 },
      ]
    : [];

  const compMax = Math.max(...composition.map(c => c.value), 1e-9);

  return (
    <section id="page-5" className="page page-5">
      <header className="p5-hero">
        <p className="p5-kicker">模块三 · 任务替代模拟</p>
        <h1>无人机到底该替代什么？</h1>
        <p className="p5-lead">
          把<strong>空间</strong>（哪里脆弱）→<strong>任务</strong>（哪类末端更痛）→<strong>模式</strong>（地面 / 混合 /
          空域）串成一条判断链。中央主图是<strong>缓解脆弱度</strong>栅格；右侧点击模式会改变读图语义，而非替换数据。
        </p>
      </header>

      <div className="p5-dashboard">
        <aside className="p5-left">
          <h2>任务类型</h2>
          <p className="p5-aside-hint">点选卡片以过滤地图强调（不是删数据，是重加权）。</p>
          <div className="p5-task-list">
            {TASK_TYPES.map(t => (
              <button
                key={t.id}
                type="button"
                className={`p5-task-card ${selectedTask === t.id ? 'active' : ''}`}
                onClick={() => setSelectedTask(t.id)}
              >
                <div className={`p5-card-vignette ${t.vignette}`} aria-hidden>
                  <span />
                  <span />
                  <span />
                </div>
                <div className="p5-card-text">
                  <div className="p5-card-title">{t.title}</div>
                  <div className="p5-card-sub">{t.subtitle}</div>
                  <p className="p5-card-hint">{t.hint}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="p5-controls-block">
            <label className="p5-check">
              <input
                type="checkbox"
                checked={highPriorityOnly}
                onChange={e => setHighPriorityOnly(e.target.checked)}
              />
              仅高优先级缓解空间（上 1/3 脆弱度）
            </label>
            <label className="p5-check">
              <input
                type="checkbox"
                checked={sortByPotential}
                onChange={e => setSortByPotential(e.target.checked)}
              />
              按替代潜力排序列表
            </label>
          </div>

          <div className="p5-rank-panel">
            <h3>栅格速览</h3>
            <ul>
              {rankedCells.map((c, i) => (
                <li key={c.grid_id}>
                  <button
                    type="button"
                    className={selectedCell?.grid_id === c.grid_id ? 'active' : ''}
                    onClick={() => setSelectedCell(c)}
                  >
                    <span className="p5-rank-i">#{i + 1}</span>
                    <span className="p5-rank-id">grid {c.grid_id}</span>
                    <span className="p5-rank-v">{c._potential.toFixed(3)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="p5-center">
          <div className="p5-map-wrap">
            <Page5Map
              gridGeoJson={gridGeoJson}
              mode={mode}
              selectedTask={selectedTask}
              highPriorityOnly={highPriorityOnly}
              priorityThreshold={priorityThreshold}
              selectedGridId={selectedCell?.grid_id ?? null}
              onPick={obj => setSelectedCell(obj.properties)}
            />
            <div className="p5-map-legend">
              <span className="leg low">低脆弱</span>
              <span className="leg-gradient" />
              <span className="leg high">高脆弱</span>
            </div>
          </div>
        </main>

        <aside className="p5-right">
          <h2>模式适配</h2>
          <p className="p5-aside-hint">切换右侧模式 = 换「读图立场」，同一套栅格。</p>
          <div className="p5-mode-list">
            {MODES.map(m => (
              <button
                key={m.id}
                type="button"
                className={`p5-mode-card ${mode === m.id ? 'active' : ''}`}
                onClick={() => setMode(m.id)}
              >
                <div className="p5-mode-title">{m.title}</div>
                <p>{m.body}</p>
              </button>
            ))}
          </div>

          <div className="p5-detail">
            <h3>点击栅格 · 缓解组成</h3>
            {!selectedCell && <p className="p5-detail-empty">在地图上点击任意格网查看组成条。</p>}
            {selectedCell && (
              <>
                <p className="p5-detail-meta">
                  Grid <strong>{selectedCell.grid_id}</strong> · 脆弱度{' '}
                  <strong>{(selectedCell.relief_vulnerability ?? 0).toFixed(3)}</strong>
                </p>
                <div className="p5-bars">
                  {composition.map(row => (
                    <div key={row.name} className="p5-bar-row">
                      <span>{row.name}</span>
                      <div className="p5-bar-track">
                        <div className="p5-bar-fill" style={{ width: `${(row.value / compMax) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="p5-detail-note">
                  条长为相对强度（同一格网内比较），非全市绝对刻度。
                </p>
              </>
            )}
          </div>
        </aside>
      </div>

      <footer className="p5-bottom">
        <div className="p5-bottom-head">
          <h2>任务 × 模式 · 替代矩阵</h2>
          <p>示意性评分（0–100）：用于答辩叙事，可与 Page2/3/4 的定量结果对照讲故事。</p>
        </div>
        <div className="p5-matrix-chart">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={SUBSTITUTION_MATRIX} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <XAxis dataKey="task" tick={{ fill: '#9aa3b5', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#6f7a90', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#12142a', border: '1px solid #2a3150', borderRadius: 8 }}
                labelStyle={{ color: '#e8ecff' }}
              />
              <Legend />
              <Bar dataKey="ground" name="地面" fill="#5ad4a0" radius={[4, 4, 0, 0]} />
              <Bar dataKey="hybrid" name="混合" fill="#6c8cff" radius={[4, 4, 0, 0]} />
              <Bar dataKey="drone" name="空域" fill="#ff7b9c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </footer>
    </section>
  );
}
