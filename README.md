# Project Methodology Summary

## Drone Delivery & Urban Ground Burden: A Spatial Analysis of Low-Altitude Logistics in Shenzhen

### 1. Introduction & Research Question

This project investigates how drone-based urban air mobility (UAM) can address ground-level delivery inefficiencies in Shenzhen, China. Shenzhen has emerged as a global pioneer in low-altitude economy development: by the end of 2023, the city had opened 156 drone delivery routes and completed over 600,000 cargo drone flights (Xinhua, 2024). Official planning documents, including the *Shenzhen Comprehensive Transport Management Work Plan for 2023–2024* and the *Shenzhen Low-Altitude Aircraft Take-off and Landing Facilities Layout Plan (2026–2035)*, outline an ambitious programme to deploy over 600 take-off and landing platforms and open 220+ urban drone routes. Against this policy backdrop, the project examines the spatial relationship between delivery demand, ground transport friction, and optimal drone hub placement. The central research question is: **How can drone take-off and landing sites be optimally located in Shenzhen to balance delivery demand, ground-delivery friction, service coverage, and urban spatial constraints?**

The project output is an interactive scrollytelling website built with React, deck.gl, and Mapbox GL, which guides users through the analysis pipeline — from understanding ground-level constraints to evaluating drone site optimisation strategies and simulated post-deployment outcomes.

### 2. Datasets

The project integrates multiple spatial and non-spatial datasets covering Shenzhen's urban environment:

- **Administrative Boundary & Spatial Units:** Shenzhen district-level administrative boundaries from the National Geomatics Centre of China (Tianditu), used to define the study area and support district-level statistics. An Uber H3 hexagonal grid at resolution 8 serves as the unified spatial unit for integrating all analytical layers.

- **Points of Interest (POI):** Over 490,000 POI records categorised into eight types (food, retail, medical, education, office, leisure, scenic, and service), collected via the Baidu Maps Place API. These form the primary demand proxy for delivery services.

- **Population Data:** Gridded population estimates from WorldPop (constrained individual countries, 100 m resolution), aggregated to H3 hexagonal cells to represent residential demand density.

- **Building Footprints & Urban Morphology:** Building footprint, height, and morphology data sourced from the Shenzhen Open Data Platform. Built-up area extent (2020) is used to validate building centroid locations. These provide urban morphology indicators including building count, average height, floor-area ratio, and high-rise constraint flags per grid cell.

- **Transport Network & Ground Barriers:** Road networks, water bodies, waterways, highways, bridges, tunnels, and railways extracted from OpenStreetMap via Geofabrik. These linear and polygonal features serve as physical barriers that increase ground delivery detour distances and travel times. Metro station locations and bus stop/route data from the Shenzhen Open Data Platform are used for public transport accessibility calculations within the friction framework.

- **Traffic Congestion:** Congestion data, contextualised by the *Shenzhen Comprehensive Transport Management Work Plan for 2023–2024*, used as a time-based amplifier within the ground friction model.

- **Parks, Compounds & Land Use:** Parks, campuses, commercial compounds, industrial parks, and residential compounds extracted from OpenStreetMap, used to identify compound-type urban spaces, access constraints, and surrounding land-use context. Residential compound points and Baidu heatmap activity data serve as proxies for residential demand intensity and weekend hotspot patterns.

- **Drone Vertiport Sites:** A dataset of 206 vertiport locations (34 existing and 172 planned), sourced from the *Shenzhen Low-Altitude Aircraft Take-off and Landing Facilities Layout Plan (2026–2035)* and commercial drone operator site data (e.g. Meituan drone delivery routes). Sites are classified by adjacent land-use context into five compound types: residential, commercial, industrial, campus, and park.

- **OD Route Data:** 1,818 origin–destination delivery route pairs with associated ground distances (network distance), straight-line (fly) distances, detour ratios, barrier crossing counts, and congestion amplifiers. Routes were generated using routing APIs over the OSM road network.

- **Real Delivery Order Data:** Real-world order records from the RL-Dispatch Shenzhen dataset and the Meituan delivery platform, used to validate demand proxies and analyse delivery timing, distance distribution, and grid-level order patterns. Food-outlet accessibility metrics at 1 km, 2 km, and 3 km radii are combined with order volumes to construct a takeout demand index.

- **Narrative Context:** Case study cards and a low-altitude economy policy timeline, compiled from official planning documents and news sources — including the *Shenzhen Comprehensive Transport Management Work Plan for 2023–2024*, Xinhua's report on Shenzhen's low-altitude economy development (Xinhua, 7 Jan 2024), and the *Shenzhen Low-Altitude Aircraft Take-off and Landing Facilities Layout Plan (2026–2035)* — used for the opening narrative and policy background sections of the website.

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

### 5. Limitations

This study relies on simplified assumptions: friction is modelled from static network topology and average traffic conditions rather than real-time GPS traces; coverage radii assume uniform circular service areas without accounting for airspace restrictions or building obstructions; and the demand model uses POI density and order counts as proxies rather than true revealed demand. Environmental impact, operational cost, and social acceptance factors are not incorporated.
