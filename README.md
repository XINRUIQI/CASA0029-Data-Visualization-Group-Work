# Project Methodology Summary

## Drone Delivery & Urban Ground Burden: A Spatial Analysis of Low-Altitude Logistics in Shenzhen

### 1. Introduction & Research Question

This project investigates how drone-based urban air mobility (UAM) can address ground-level delivery inefficiencies in Shenzhen, China. Shenzhen has emerged as a global pioneer in low-altitude economy development: by the end of 2023, the city had opened 156 drone delivery routes and completed over 600,000 cargo drone flights (Xinhua, 2024). Official planning documents, including the *Shenzhen Comprehensive Transport Management Work Plan for 2023–2024* and the *Shenzhen Low-Altitude Aircraft Take-off and Landing Facilities Layout Plan (2026–2035)*, outline an ambitious programme to deploy over 600 take-off and landing platforms and open 220+ urban drone routes. Against this policy backdrop, the project examines the spatial relationship between delivery demand, ground transport friction, and optimal drone hub placement. The central research question is: **How can drone take-off and landing sites be optimally located in Shenzhen to balance delivery demand, ground-delivery friction, service coverage, and urban spatial constraints?**

The project output is an interactive scrollytelling website built with React, deck.gl, and Mapbox GL, which guides users through the analysis pipeline — from understanding ground-level constraints to evaluating drone site optimisation strategies and simulated post-deployment outcomes.

### 2. Datasets

The project integrates multiple spatial and non-spatial datasets, unified on an Uber H3 hexagonal grid (resolution 8, 2,754 cells):

| Dataset | Source | Purpose |
|---|---|---|
| Administrative boundaries | [Tianditu (National Geomatics Centre of China)](https://cloudcenter.tianditu.gov.cn/dataSource) | Study area definition |
| H3 hexagonal grid (resolution 8) | [Uber H3](https://h3geo.org/docs/) | Unified spatial unit for all analytical layers |
| POI (490k+ records, 8 types) | [Baidu Maps Place API](https://lbsyun.baidu.com/faq/api?title=webapi/guide/webservice-placeapi) | Delivery demand proxy |
| Population (100 m grid) | [WorldPop](https://hub.worldpop.org/geodata/summary?id=49919) | Residential demand density |
| Building footprints & morphology | [Shenzhen Open Data Platform](https://opendata.sz.gov.cn/data/dataSet/toDataDetails/29200_00300237) | Urban morphology indicators |
| Road network, barriers (water, rail, highway) | [OpenStreetMap via Geofabrik (Guangdong)](https://download.geofabrik.de/asia/china/guangdong.html) | Ground friction & detour modelling |
| Metro stations | [Shenzhen Open Data Platform](https://opendata.sz.gov.cn/data/dataSet/toDataDetails/29200_00403624) | Public transport accessibility |
| Bus stops / routes | [Bus stops](https://opendata.sz.gov.cn/data/dataSet/toDataDetails/29200_00403628); [Route-station relationship](https://opendata.sz.gov.cn/data/dataSet/toDataDetails/29200_00403599) | Public transport accessibility |
| Traffic congestion | [*Shenzhen Comprehensive Transport Management Work Plan 2023–2024*](https://www.news.cn/fortune/20240107/6e78f59f463d4dc78672549da01863eb/c.html) | Congestion amplifier |
| Parks, compounds & land use | [OpenStreetMap via Geofabrik (Guangdong)](https://download.geofabrik.de/asia/china/guangdong.html) | Access constraints & land-use context |
| Vertiport sites (206: 34 existing + 172 planned) | [Shenzhen Low-Altitude Facilities Plan 2026–2035](http://pnr.sz.gov.cn/xxgk/gggs/content/post_12469261.html); Meituan | Site evaluation & optimisation |
| OD routes (1,818 pairs) | OSM road network + routing API | Detour ratio & barrier crossing analysis |
| Real delivery orders | [RL-Dispatch dataset](https://tianchi.aliyun.com/dataset/106807); [Meituan INFORMS TSL Research Challenge](https://github.com/meituan/Meituan-INFORMS-TSL-Research-Challenge) | Demand validation & takeout index |
| Policy timeline & case studies | [*Shenzhen Low-Altitude Facilities Plan 2026–2035*](http://pnr.sz.gov.cn/xxgk/gggs/content/post_12469261.html); [Xinhua (2024)](https://www.news.cn/fortune/20240107/6e78f59f463d4dc78672549da01863eb/c.html) | Narrative context |
| Cover video | [Zipline](https://www.flyzipline.com/) — [`hero video`](https://res.cloudinary.com/flyzipline/video/upload/q_auto:best,f_auto/v1776784625/homepage_hero_desktop_21042026_rw2jvh.mp4) | Landing page background |

### 3. Methodology

#### 3.1 Spatial Grid Framework

All analyses are unified on an **Uber H3 hexagonal grid at resolution 8**, producing 2,754 hexagonal cells covering the Shenzhen administrative area. The H3 system was chosen for its consistent cell area (~0.74 km²), seamless tessellation, and native support in the deck.gl visualisation library. Datasets originally on different grids (e.g., the 7,392-cell square gap grid from the composite analysis) were spatially joined to the H3 master grid using centroid-in-polygon operations and area-weighted aggregation.

#### 3.2 Demand Analysis

Delivery demand is modelled as a composite index per H3 cell, integrating three dimensions: (1) **POI density** — the weighted count of food, retail, and service POIs representing commercial delivery origins; (2) **population density** — WorldPop-derived residential population as a proxy for delivery destinations; and (3) **real order volume** — Meituan takeout order counts where available. The final takeout demand index uses a weighted formula: `0.50 × order_norm + 0.30 × pop_norm + 0.20 × residential_norm`, normalised city-wide using min–max scaling.

#### 3.3 Ground Friction Computation

Ground friction quantifies the difficulty of ground-based delivery relative to aerial alternatives. For each OD pair, friction is calculated as a function of: (a) **detour ratio** — the ratio of network (road) distance to Euclidean (fly) distance, reflecting how road topology forces longer routes; (b) **barrier crossings** — the number of rivers, railways, and expressways a ground route must traverse; and (c) **congestion amplifier** — a time-based penalty derived from peak-hour traffic conditions. Route-level friction values are spatially distributed to H3 cells using a **route-line densification** method: each route polyline is sampled at 200 m intervals, and the friction value is assigned to the H3 cell containing each sample point. For cells with no direct route data, an **inverse-distance-weighted (IDW) neighbourhood interpolation** (k ≤ 3 rings) fills gaps using adjacent hex values.

#### 3.4 Composite Gap Index

A composite gap index identifies areas with the greatest need for drone service by combining normalised demand, friction, and urban intensity layers. The formula used is:

`gap_index = 0.4 × demand_norm × friction_norm + 0.3 × intensity_norm × friction_norm + 0.3 × demand_norm × intensity_norm`

This multiplicative formulation ensures that high gap scores require co-occurrence of multiple stress factors rather than a single extreme value.

#### 3.5 Drone Site Optimisation

Existing vertiport sites are evaluated by their **service coverage** (population and POI covered within 3 km and 5 km radii) and classified into five delivery scenarios — meal delivery, parcel delivery, medical emergency, park/scenic, and cross-border — based on their surrounding POI composition and proximity to border checkpoints. Three site expansion strategies are compared under different budget constraints (20, 50, and 100 new sites): **demand-first** (ranking by demand index), **friction-first** (ranking by ground friction intensity), and **composite** (ranking by the gap index). Each strategy's impact is measured by incremental population coverage, POI coverage, and average friction reduction.

#### 3.6 Post-Deployment Assessment

The post-analysis section simulates what Shenzhen's delivery landscape would look like after deploying optimised drone sites. It recalculates coverage metrics, estimates friction reduction within a 3 km service radius (modelled as a 70% reduction factor), and visualises the before-and-after gap index changes on the H3 grid alongside barrier layers.

### 4. Visualisation & Technology

The front-end is built with **React 19** and **Vite**, using **deck.gl** (H3HexagonLayer, GeoJsonLayer, ArcLayer, ScatterplotLayer) over **Mapbox GL** basemaps for GPU-accelerated geospatial rendering. Statistical charts use **Recharts** (bar, radar, scatter, area, and pie charts). Scroll-driven storytelling is implemented with **Scrollama** and **GSAP** for animation. The cover page features a **Three.js** 3D drone scene. The site uses route-based code-splitting and lazy loading for performance, and is deployed via GitHub Pages.

### 5. Getting Started

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- npm (included with Node.js)

#### Installation & Development

```bash
cd viz
npm install        # install all dependencies (~547 MB, not included in submission)
npm run dev        # start development server at http://localhost:5173
```

#### Production Build

```bash
npm run build      # generates viz/dist/ (not included in submission)
npm run preview    # preview the production build locally
```

### 6. Repository Structure

```
├── viz/                        # Interactive scrollytelling website
│   ├── src/                    # React source code (41 files)
│   ├── public/                 # Static assets: data JSON, images, video
│   ├── scripts/                # Python helpers (H3 conversion, data prep)
│   ├── package.json            # npm dependencies & scripts
│   ├── vite.config.js          # Vite build configuration
│   └── index.html              # Entry HTML
├── Data/                       # Analysis notebooks & datasets
│   ├── 01–14 (numbered dirs)   # Each contains Jupyter notebooks + data
│   └── (see Data Sources below for large files)
├── .github/workflows/          # GitHub Actions CI/CD for GitHub Pages
├── README.md                   # This file
└── Project_Methodology_Summary.md
```

### 7. Files Not Included in Submission

The following files are excluded from the submission archive to comply with size constraints. They can be regenerated or downloaded as described below.

| Excluded item | How to restore |
|---|---|
| `viz/node_modules/` | Run `npm install` inside `viz/` |
| `viz/dist/` | Run `npm run build` inside `viz/` |

#### Large Spatial Datasets

Some raw/intermediate datasets exceed file-transfer limits. Notebooks in `Data/` document how each was obtained.

| Folder | Size | Source |
|---|---|---|
| `Data/04 Transport/` | ~680 MB | [Geofabrik Guangdong OSM extract](https://download.geofabrik.de/asia/china/guangdong.html) |
| `Data/05 Barrier Layers/` | ~23 MB | [Geofabrik Guangdong OSM extract](https://download.geofabrik.de/asia/china/guangdong.html) |
| `Data/06 Buildings/` | ~824 MB | [Shenzhen Open Data Platform — Building footprints](https://opendata.sz.gov.cn/data/dataSet/toDataDetails/29200_00300237) |
| `Data/07 Parks & Compounds/` | ~13 MB | [Geofabrik Guangdong OSM extract](https://download.geofabrik.de/asia/china/guangdong.html) |
| `Data/08 POI Demand/` | ~113 MB | [Baidu Maps Place API](https://lbsyun.baidu.com/faq/api?title=webapi/guide/webservice-placeapi) |
| `Data/09 Population/` | ~661 MB | [WorldPop — China constrained 2020](https://hub.worldpop.org/geodata/summary?id=49919) |
| `Data/10 OD & Ground Friction/` | ~786 MB | Computed from OSM road network + barrier analysis |
| `Data/12 RL-Dispatch/` | ~71 MB | [RL-Dispatch dataset (Shenzhen subset)](https://tianchi.aliyun.com/dataset/106807) |
| `Data/13 Meituan-TSL/` | ~175 MB | [Meituan INFORMS TSL Research Challenge](https://github.com/meituan/Meituan-INFORMS-TSL-Research-Challenge) |

### 8. Online Libraries & Dependencies

All libraries are installed automatically via `npm install`. Key dependencies:

- [deck.gl](https://deck.gl/) — GPU-accelerated geospatial layers
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) / [react-map-gl](https://visgl.github.io/react-map-gl/) — vector basemaps
- [h3-js](https://github.com/uber/h3-js) — H3 hexagonal indexing
- [Turf.js](https://turfjs.org/) — geospatial analysis
- [Three.js](https://threejs.org/) / [@react-three/fiber](https://docs.pmnd.rs/react-three-fiber) / [@react-three/drei](https://github.com/pmndrs/drei) — 3D rendering
- [GSAP](https://gsap.com/) — scroll-driven animation
- [Recharts](https://recharts.org/) — statistical charts
- [Scrollama](https://github.com/russellsamora/scrollama) / [react-scrollama](https://github.com/jsonkao/react-scrollama) — scroll-triggered narrative
- [React](https://react.dev/) 19 / [React Router](https://reactrouter.com/) / [Vite](https://vite.dev/) — framework & build

### 9. Limitations

This study relies on simplified assumptions: friction is modelled from static network topology and average traffic conditions rather than real-time GPS traces; coverage radii assume uniform circular service areas without accounting for airspace restrictions or building obstructions; and the demand model uses POI density and order counts as proxies rather than true revealed demand. Environmental impact, operational cost, and social acceptance factors are not incorporated.
