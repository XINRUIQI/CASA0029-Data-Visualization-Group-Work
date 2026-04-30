"""
Compute all derived datasets needed for Page2 — using canonical notebook outputs.

Data sources (from the notebook pipeline):
  - Data/08 POI Demand/data_out/sz_demand_grid.gpkg       — H3 hex (2754), POI + demand_pressure
  - Data/09 Population/data_out/sz_population_grid.gpkg    — H3 hex (2754), pop_count etc.
  - Data/11 Composite Analysis/data_out/sz_gap_grid.gpkg   — square grid (7392), gap_index + covered_by_10
  - Data/11 Composite Analysis/data_out/sz_strategy_coverage.gpkg — coverage at 3/5/10/20/50 sites
  - viz/public/data/vertiport_sites.json                   — 206 drone sites (34 existing)
  - viz/public/data/od_analysis.json                       — 1818 OD pairs

Outputs (→ viz/public/data/):
  1. page2_sites.json            — existing sites + scenario classification + nearby POI
  2. page2_scenario_radar.json   — radar data per scenario (6 dimensions)
  3. page2_scenario_cards.json   — scenario detail cards
  4. page2_coverage.json         — coverage summary (from notebook + fresh buffer calculation)
  5. page2_gap_zones.json        — high-demand uncovered grids (GeoJSON)
  6. page2_zone_summary.json     — functional zone distribution
"""

import json, math, os
from collections import Counter, defaultdict
from pathlib import Path

import geopandas as gpd
import numpy as np

# ──────────────────────────────────────────
# Paths
# ──────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
NB_DATA = ROOT / "Data"
VIZ_DATA = ROOT / "viz" / "public" / "data"

def load_json(name):
    with open(VIZ_DATA / name, encoding="utf-8") as f:
        return json.load(f)

def save_json(name, obj):
    with open(VIZ_DATA / name, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    kb = os.path.getsize(VIZ_DATA / name) / 1024
    print(f"  ✓ saved {name}  ({kb:.1f} KB)")


# ──────────────────────────────────────────
# Haversine (metres)
# ──────────────────────────────────────────
def haversine(lon1, lat1, lon2, lat2):
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi, dlam = math.radians(lat2 - lat1), math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ══════════════════════════════════════════
# LOAD DATA
# ══════════════════════════════════════════
print("Loading data …")

# Notebook outputs (gpkg)
hex_demand = gpd.read_file(NB_DATA / "08 POI Demand" / "data_out" / "sz_demand_grid.gpkg")
hex_pop    = gpd.read_file(NB_DATA / "09 Population" / "data_out" / "sz_population_grid.gpkg")
gap_grid   = gpd.read_file(NB_DATA / "11 Composite Analysis" / "data_out" / "sz_gap_grid.gpkg")
strat_cov  = gpd.read_file(NB_DATA / "11 Composite Analysis" / "data_out" / "sz_strategy_coverage.gpkg")

# viz JSON
sites_raw = load_json("vertiport_sites.json")
od_data   = load_json("od_analysis.json")

existing_sites = [s for s in sites_raw if s["status"] == "existing"]
print(f"  H3 demand grid: {len(hex_demand)} hexagons")
print(f"  Square gap grid: {len(gap_grid)} cells")
print(f"  Existing sites: {len(existing_sites)}")

# Pre-compute hex centroids
hex_demand_centroids = list(zip(
    hex_demand.geometry.centroid.x, hex_demand.geometry.centroid.y
))

# ══════════════════════════════════════════
# 1. SCENARIO CLASSIFICATION
# ══════════════════════════════════════════
print("\n── Step 1: Scenario classification ──")

BORDER_POINTS = [
    (114.0568, 22.5137),   # 福田口岸
    (114.1134, 22.5380),   # 罗湖口岸
    (114.0680, 22.5200),   # 皇岗口岸
    (113.9380, 22.4920),   # 深圳湾口岸
]

def nearest_hex_pois(lon, lat):
    best_d, best = float("inf"), {}
    for i, (gx, gy) in enumerate(hex_demand_centroids):
        d = haversine(lon, lat, gx, gy)
        if d < best_d:
            best_d = d
            best = hex_demand.iloc[i]
    return best

def classify_scenario(site, hex_row):
    lon, lat = site["lon"], site["lat"]
    ct = site.get("compound_type", "")
    total = max(hex_row.get("poi_total", 1), 1)

    for blon, blat in BORDER_POINTS:
        if haversine(lon, lat, blon, blat) < 4000:
            return "cross_border"

    med = hex_row.get("medical_count", 0)
    if med >= 40 or (ct == "campus" and med > 5):
        return "medical"

    if ct == "park":
        return "park"

    food_r = hex_row.get("food_count", 0) / total
    retail_r = hex_row.get("retail_count", 0) / total

    if ct in ("commercial", "residential") and food_r > 0.25:
        return "meal_delivery"
    if ct in ("industrial", "campus") or retail_r > 0.3:
        return "parcel_delivery"
    return "meal_delivery" if food_r >= retail_r else "parcel_delivery"


page2_sites = []
for s in existing_sites:
    hr = nearest_hex_pois(s["lon"], s["lat"])
    scenario = classify_scenario(s, hr)
    page2_sites.append({
        "lon": s["lon"],
        "lat": s["lat"],
        "name": s.get("nearest_compound", ""),
        "zone_type": s.get("zone_type", ""),
        "compound_type": s.get("compound_type", ""),
        "scenario": scenario,
        "distance_m": s.get("distance_m", 0),
        "nearby_food": float(hr.get("food_count", 0)),
        "nearby_medical": float(hr.get("medical_count", 0)),
        "nearby_retail": float(hr.get("retail_count", 0)),
        "nearby_poi_total": float(hr.get("poi_total", 0)),
        "demand_pressure": float(hr.get("demand_pressure", 0)),
    })

scenario_counts = Counter(s["scenario"] for s in page2_sites)
print(f"  Scenario distribution: {dict(scenario_counts)}")
save_json("page2_sites.json", page2_sites)


# ══════════════════════════════════════════
# 2. SCENARIO RADAR DATA
# ══════════════════════════════════════════
print("\n── Step 2: Scenario radar ──")

SCENARIO_META = {
    "meal_delivery": {
        "label": "餐饮外卖", "label_en": "Meal Delivery", "color": "#ff6b35", "icon": "🍔",
        "avg_distance_km": 3.2, "avg_time_min": 18, "daily_frequency": 45,
        "peak_ratio": 2.8, "weight_kg": 2.5, "time_sensitivity": 0.95,
        "description": "覆盖商圈与住宅区，高峰期集中在午晚餐时段",
    },
    "parcel_delivery": {
        "label": "快递物流", "label_en": "Parcel Delivery", "color": "#4ecdc4", "icon": "📦",
        "avg_distance_km": 5.8, "avg_time_min": 35, "daily_frequency": 120,
        "peak_ratio": 1.5, "weight_kg": 5.0, "time_sensitivity": 0.55,
        "description": "产业园区、物流枢纽间中短途运输，全天候运营",
    },
    "medical": {
        "label": "医疗急送", "label_en": "Medical", "color": "#e63946", "icon": "🏥",
        "avg_distance_km": 8.5, "avg_time_min": 12, "daily_frequency": 8,
        "peak_ratio": 1.2, "weight_kg": 1.0, "time_sensitivity": 1.0,
        "description": "医院间血液/检验样本/药品紧急配送，时效要求最高",
    },
    "park": {
        "label": "公园景区", "label_en": "Park & Scenic", "color": "#2ec4b6", "icon": "🌳",
        "avg_distance_km": 2.0, "avg_time_min": 8, "daily_frequency": 25,
        "peak_ratio": 2.2, "weight_kg": 1.5, "time_sensitivity": 0.6,
        "description": "景区内餐饮/物资配送，周末与节假日为高峰",
    },
    "cross_border": {
        "label": "跨境运输", "label_en": "Cross-border", "color": "#9b5de5", "icon": "🌐",
        "avg_distance_km": 12.0, "avg_time_min": 25, "daily_frequency": 15,
        "peak_ratio": 1.8, "weight_kg": 3.0, "time_sensitivity": 0.75,
        "description": "深港口岸间高价值物品快速通关配送",
    },
}

scenarios = list(SCENARIO_META.keys())
dims = ["frequency", "distance", "timeliness", "weight_capacity", "peak_intensity", "time_sensitivity"]

raw_vals = {
    "frequency":       {s: SCENARIO_META[s]["daily_frequency"] for s in scenarios},
    "distance":        {s: SCENARIO_META[s]["avg_distance_km"] for s in scenarios},
    "timeliness":      {s: 60 / max(SCENARIO_META[s]["avg_time_min"], 1) for s in scenarios},
    "weight_capacity": {s: SCENARIO_META[s]["weight_kg"] for s in scenarios},
    "peak_intensity":  {s: SCENARIO_META[s]["peak_ratio"] for s in scenarios},
    "time_sensitivity":{s: SCENARIO_META[s]["time_sensitivity"] for s in scenarios},
}

radar_data = {}
for s in scenarios:
    radar_data[s] = []
    for dim in dims:
        vals = list(raw_vals[dim].values())
        mn, mx = min(vals), max(vals)
        norm = (raw_vals[dim][s] - mn) / (mx - mn) if mx > mn else 0.5
        norm = round(0.15 + 0.85 * norm, 2)
        radar_data[s].append({
            "axis": dim.replace("_", " ").title(),
            "value": norm,
            "raw": round(raw_vals[dim][s], 2),
        })

radar_output = {
    "scenarios": {
        s: {
            **SCENARIO_META[s],
            "site_count": scenario_counts.get(s, 0),
            "radar": radar_data[s],
        }
        for s in scenarios
    },
    "dimensions": [d.replace("_", " ").title() for d in dims],
}
save_json("page2_scenario_radar.json", radar_output)


# ══════════════════════════════════════════
# 3. SCENARIO CARDS
# ══════════════════════════════════════════
print("\n── Step 3: Scenario cards ──")

od_feats = od_data["features"]

def nearest_site_scenario(lon, lat):
    best_d, best_sc = float("inf"), "parcel_delivery"
    for s in page2_sites:
        d = haversine(lon, lat, s["lon"], s["lat"])
        if d < best_d:
            best_d, best_sc = d, s["scenario"]
    return best_sc, best_d

scenario_ods = defaultdict(list)
for f in od_feats:
    p = f["properties"]
    sc_o, d_o = nearest_site_scenario(p["o_lon"], p["o_lat"])
    sc_d, d_d = nearest_site_scenario(p["d_lon"], p["d_lat"])
    scenario_ods[sc_o if d_o < d_d else sc_d].append(p)

scenario_cards = []
for sc in scenarios:
    meta = SCENARIO_META[sc]
    ods = scenario_ods.get(sc, [])

    if ods:
        avg_net        = float(np.mean([o["net_m"] for o in ods]))
        avg_fly        = float(np.mean([o["fly_m"] for o in ods]))
        avg_detour     = float(np.mean([o["detour_ratio"] for o in ods]))
        avg_friction   = float(np.mean([o["ground_friction"] for o in ods]))
        avg_congestion = float(np.mean([o["congestion_amplifier"] for o in ods]))
        avg_barriers   = float(np.mean([o["n_barrier_total"] for o in ods]))
        pct_water      = float(np.mean([1 if o["crosses_water"] else 0 for o in ods]) * 100)
    else:
        avg_net, avg_fly = meta["avg_distance_km"] * 1000, meta["avg_distance_km"] * 700
        avg_detour, avg_friction, avg_congestion, avg_barriers, pct_water = 1.5, 0.4, 1.8, 5, 50

    rep_sites = [
        {"name": s["name"], "lon": s["lon"], "lat": s["lat"]}
        for s in page2_sites if s["scenario"] == sc
    ][:5]

    scenario_cards.append({
        "scenario": sc,
        "label": meta["label"],
        "label_en": meta["label_en"],
        "color": meta["color"],
        "icon": meta["icon"],
        "description": meta["description"],
        "site_count": scenario_counts.get(sc, 0),
        "representative_sites": rep_sites,
        "params": {
            "avg_distance_km": round(meta["avg_distance_km"], 1),
            "avg_time_min": meta["avg_time_min"],
            "daily_frequency": meta["daily_frequency"],
            "weight_kg": meta["weight_kg"],
            "peak_ratio": meta["peak_ratio"],
            "time_sensitivity": meta["time_sensitivity"],
        },
        "od_stats": {
            "avg_ground_distance_m": round(avg_net),
            "avg_fly_distance_m": round(avg_fly),
            "avg_detour_ratio": round(avg_detour, 2),
            "avg_ground_friction": round(avg_friction, 3),
            "avg_congestion_amplifier": round(avg_congestion, 2),
            "avg_barrier_crossings": round(avg_barriers, 1),
            "pct_crosses_water": round(pct_water, 1),
            "od_pairs_count": len(ods),
        },
    })

save_json("page2_scenario_cards.json", scenario_cards)


# ══════════════════════════════════════════
# 4. COVERAGE ANALYSIS — use H3 hex grid + notebook strategy data
# ══════════════════════════════════════════
print("\n── Step 4: Coverage analysis ──")

# Use H3 hex grid for coverage (canonical analysis grid)
hex_pop_centroids = list(zip(
    hex_pop.geometry.centroid.x, hex_pop.geometry.centroid.y
))

total_pop_hex = float(hex_pop["pop_count"].sum())
total_poi_hex = float(hex_demand["poi_total"].sum())
print(f"  H3 grid total population: {total_pop_hex:,.0f}")
print(f"  H3 grid total POI: {total_poi_hex:,.0f}")

RADII = [3000, 5000]
coverage_results = {}

for radius in RADII:
    covered_pop, covered_poi = 0.0, 0.0
    covered_pop_cells, covered_poi_cells = 0, 0

    # Population coverage (hex grid)
    for i, (gx, gy) in enumerate(hex_pop_centroids):
        for s in existing_sites:
            if haversine(s["lon"], s["lat"], gx, gy) <= radius:
                covered_pop += float(hex_pop.iloc[i]["pop_count"])
                covered_pop_cells += 1
                break

    # POI coverage (hex grid)
    for i, (gx, gy) in enumerate(hex_demand_centroids):
        for s in existing_sites:
            if haversine(s["lon"], s["lat"], gx, gy) <= radius:
                covered_poi += float(hex_demand.iloc[i]["poi_total"])
                covered_poi_cells += 1
                break

    pop_pct = covered_pop / total_pop_hex * 100 if total_pop_hex > 0 else 0
    poi_pct = covered_poi / total_poi_hex * 100 if total_poi_hex > 0 else 0
    label = f"{radius // 1000}km"

    coverage_results[label] = {
        "radius_m": radius,
        "covered_population": round(covered_pop),
        "total_population": round(total_pop_hex),
        "population_coverage_pct": round(pop_pct, 1),
        "covered_poi": round(covered_poi),
        "total_poi": round(total_poi_hex),
        "poi_coverage_pct": round(poi_pct, 1),
        "covered_hex_count": covered_pop_cells,
        "total_hex_count": len(hex_pop),
    }
    print(f"  {label}: pop {pop_pct:.1f}%  POI {poi_pct:.1f}%  ({covered_pop_cells}/{len(hex_pop)} hexagons)")

# Include notebook 11 strategy coverage for comparison
nb_coverage = []
for _, row in strat_cov.iterrows():
    nb_coverage.append({
        "n_sites": int(row["n_sites"]),
        "coverage_area_pct": round(float(row["coverage_area_pct"]), 1),
        "demand_coverage_pct": round(float(row["demand_coverage_pct"]), 1),
        "pop_coverage_pct": round(float(row["pop_coverage_pct"]), 1),
    })

coverage_output = {
    "site_count": len(existing_sites),
    "grid_type": "H3 hex res8",
    "grid_count": len(hex_pop),
    "radii": coverage_results,
    "strategy_comparison": nb_coverage,
    "summary_text": (
        f"现有 {len(existing_sites)} 个站点在 3km 半径内覆盖了 "
        f"{coverage_results['3km']['population_coverage_pct']}% 的人口和 "
        f"{coverage_results['3km']['poi_coverage_pct']}% 的 POI；"
        f"5km 半径覆盖 {coverage_results['5km']['population_coverage_pct']}% 人口和 "
        f"{coverage_results['5km']['poi_coverage_pct']}% POI。"
        f"超过一半区域仍为服务空白。"
    ),
}
save_json("page2_coverage.json", coverage_output)


# ══════════════════════════════════════════
# 5. GAP ZONES — use h3_gap data (already converted to H3)
# ══════════════════════════════════════════
print("\n── Step 5: Gap zones (H3) ──")

# Load the H3 gap data we just generated
h3_gap_data = load_json("h3_gap.json")

# Filter: high gap_index AND not covered by existing sites within 5 km
nonzero_gaps = [g for g in h3_gap_data if g.get("gap_index", 0) > 0]
if nonzero_gaps:
    gap_vals = sorted(g["gap_index"] for g in nonzero_gaps)
    threshold = gap_vals[len(gap_vals) // 2]
else:
    threshold = 0
print(f"  Gap index threshold (P50 of nonzero): {threshold:.6f}")

# Get hex centroids from the hex demand grid
hex_centroids = {}
for _, row in hex_demand.iterrows():
    c = row.geometry.centroid
    hex_centroids[row["h3_id"]] = (c.x, c.y)

gap_h3_records = []
for g in h3_gap_data:
    if g.get("gap_index", 0) < threshold:
        continue
    h3id = g["h3"]
    cx, cy = hex_centroids.get(h3id, (0, 0))
    if cx == 0:
        continue
    covered = any(
        haversine(s["lon"], s["lat"], cx, cy) <= 5000
        for s in existing_sites
    )
    if covered:
        continue
    min_d = min(haversine(s["lon"], s["lat"], cx, cy) for s in existing_sites)
    gap_h3_records.append({
        "h3": h3id,
        "dp": round(g.get("demand_pressure", 0), 1),
        "gap": round(g.get("gap_index", 0), 6),
        "dist": round(min_d),
        "food": g.get("food_count", 0),
        "med": g.get("medical_count", 0),
        "retail": g.get("retail_count", 0),
        "pop": g.get("pop_count", 0),
        "fric": round(g.get("avg_friction", 0), 3),
    })

print(f"  {len(gap_h3_records)} H3 gap zones (gap_index ≥ {threshold:.6f}, >5km from existing)")
save_json("page2_gap_zones.json", gap_h3_records)


# ══════════════════════════════════════════
# 6. ZONE SUMMARY
# ══════════════════════════════════════════
print("\n── Step 6: Zone summary ──")

ZONE_LABELS = {
    "residential": {"label": "居住区",   "label_en": "Residential",  "color": "#ffa726"},
    "commercial":  {"label": "商业区",   "label_en": "Commercial",   "color": "#42a5f5"},
    "park":        {"label": "公园景区", "label_en": "Park & Scenic","color": "#66bb6a"},
    "campus":      {"label": "校园/院区","label_en": "Campus",       "color": "#ab47bc"},
    "industrial":  {"label": "产业园区", "label_en": "Industrial",   "color": "#78909c"},
}

zone_summary = defaultdict(lambda: {"count": 0, "sites": []})
for s in page2_sites:
    ct = s["compound_type"]
    zone_summary[ct]["count"] += 1
    zone_summary[ct]["sites"].append(s["name"])

zone_output = []
for ct, info in zone_summary.items():
    meta = ZONE_LABELS.get(ct, {"label": ct, "label_en": ct, "color": "#999"})
    zone_output.append({
        "type": ct,
        "label": meta["label"],
        "label_en": meta["label_en"],
        "color": meta["color"],
        "count": info["count"],
        "sites": info["sites"][:8],
    })
zone_output.sort(key=lambda x: -x["count"])
save_json("page2_zone_summary.json", zone_output)


# ══════════════════════════════════════════
print("\n✅ All Page2 data computed using canonical notebook sources!")
print(f"   H3 hex grid (res 8): {len(hex_demand)} hexagons")
print(f"   Square gap grid: {len(gap_grid)} cells")
print(f"   Output: {VIZ_DATA}")
