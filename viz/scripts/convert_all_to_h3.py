"""
Convert ALL grid data to unified H3 hex res-8 format.

Inputs:
  - Data/03 Boundary/data_out/sz_hex_grid_res8.gpkg     (2754 H3 hexagons — the master grid)
  - Data/06 Buildings/data_out/sz_building_grid.gpkg     (2754 H3, already aligned)
  - Data/08 POI Demand/data_out/sz_demand_grid.gpkg      (2754 H3, already aligned)
  - Data/09 Population/data_out/sz_population_grid.gpkg  (2754 H3, already aligned)
  - Data/11 Composite Analysis/data_out/sz_gap_grid.gpkg (7392 square → spatial-join to H3)
  - Data/14 Takeout Demand Coverage/data_out/sz_takeout_demand_grid.gpkg (2754 H3, takeout + coverage)

Outputs (→ viz/public/data/):
  - h3_demand.json      — [{h3_id, food_count, medical_count, …, demand_pressure}, …]
  - h3_population.json  — [{h3_id, pop_count, pop_density, …}, …]
  - h3_building.json    — [{h3_id, building_count, avg_height, …}, …]
  - h3_gap.json         — [{h3_id, gap_index, avg_friction, covered_by_10, …}, …]
  - page2_h3_gap.json    — same as h3_gap.json (Page2 / Page7 fetch)
  - h3_takeout.json     — [{h3_id, takeout_demand_index, food_access_1/2/3km, …}, …]

All files: array of objects, keyed by h3_id, NO geometry (deck.gl H3HexagonLayer renders from h3_id).

avg_friction on h3_gap: after square-grid aggregation, if ``page2_od_analysis.json`` exists,
each OD’s ``ground_friction`` is assigned to **both** origin and destination hex (res-8),
then per-hex **mean** replaces the legacy value for those hexes. ``friction_norm`` and
``gap_index`` are recomputed citywide to stay consistent with notebook 11.
"""

import json, os
from pathlib import Path
import geopandas as gpd
import numpy as np
import warnings
warnings.filterwarnings("ignore")

ROOT = Path(__file__).resolve().parents[2]
NB   = ROOT / "Data"
OUT  = ROOT / "viz" / "public" / "data"

def save(name, data):
    path = OUT / name
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  ✓ {name}  ({os.path.getsize(path)/1024:.1f} KB, {len(data)} rows)")


# ══════════════════════════════════════════
# 1. Load H3 master grid
# ══════════════════════════════════════════
print("Loading H3 master grid (res 8) …")
h3_master = gpd.read_file(NB / "03 Boundary" / "data_out" / "sz_hex_grid_res8.gpkg")
h3_master_wgs84 = h3_master[["h3_id", "geometry"]].copy()
if h3_master_wgs84.crs is None:
    h3_master_wgs84.set_crs(4326, inplace=True)
else:
    h3_master_wgs84 = h3_master_wgs84.to_crs(4326)
print(f"  {len(h3_master)} hexagons")


# ══════════════════════════════════════════
# 2. Already-H3 datasets — just drop geometry, export as JSON
# ══════════════════════════════════════════

# --- Demand ---
print("\nExporting h3_demand.json …")
demand = gpd.read_file(NB / "08 POI Demand" / "data_out" / "sz_demand_grid.gpkg")
demand_records = []
for _, r in demand.iterrows():
    demand_records.append({
        "h3": r["h3_id"],
        "edu": round(float(r["education_count"]), 1),
        "food": round(float(r["food_count"]), 1),
        "leisure": round(float(r["leisure_count"]), 1),
        "med": round(float(r["medical_count"]), 1),
        "office": round(float(r["office_count"]), 1),
        "retail": round(float(r["retail_count"]), 1),
        "scenic": round(float(r["scenic_count"]), 1),
        "service": round(float(r["service_count"]), 1),
        "poi": round(float(r["poi_total"]), 1),
        "dp": round(float(r["demand_pressure"]), 2),
        "dpn": round(float(r["demand_pressure_norm"]), 4),
    })
save("h3_demand.json", demand_records)

# --- Population ---
print("\nExporting h3_population.json …")
pop = gpd.read_file(NB / "09 Population" / "data_out" / "sz_population_grid.gpkg")
pop_records = []
for _, r in pop.iterrows():
    rec = {"h3": r["h3_id"]}
    for col in ["pop_count", "pop_density", "residential_count", "residential_volume",
                "residential_avg_height", "demand_pressure", "employment_proxy",
                "commercial_activity", "intensity_index"]:
        rec[col] = round(float(r[col]), 2) if r[col] is not None else 0
    # Extra columns that may exist
    for col in ["xiaoqu_count", "weekend_hotspot_count", "weekend_hotspot_score"]:
        if col in pop.columns:
            rec[col] = round(float(r[col]), 2) if r[col] is not None else 0
    pop_records.append(rec)
save("h3_population.json", pop_records)

# --- Building ---
print("\nExporting h3_building.json …")
bld = gpd.read_file(NB / "06 Buildings" / "data_out" / "sz_building_grid.gpkg")
bld_records = []
bld_cols = [c for c in bld.columns if c not in ("geometry", "h3_id")]
for _, r in bld.iterrows():
    rec = {"h3": r["h3_id"]}
    for col in bld_cols:
        val = r[col]
        if val is None or (isinstance(val, float) and np.isnan(val)):
            rec[col] = 0
        elif isinstance(val, float):
            rec[col] = round(val, 2)
        else:
            rec[col] = val
    bld_records.append(rec)
save("h3_building.json", bld_records)


# ══════════════════════════════════════════
# 3. Gap grid (square 7392) → spatial-join to H3
# ══════════════════════════════════════════
print("\nSpatial-joining gap grid (square) → H3 …")
gap_sq = gpd.read_file(NB / "11 Composite Analysis" / "data_out" / "sz_gap_grid.gpkg")
print(f"  Square gap grid: {len(gap_sq)} cells")

# Ensure same CRS
h3_master = h3_master.to_crs(gap_sq.crs)

# Use centroids of square grids → sjoin to H3 hexagons
gap_sq_c = gap_sq.copy()
gap_sq_c["geometry"] = gap_sq_c.geometry.centroid

joined = gpd.sjoin(gap_sq_c, h3_master[["h3_id", "geometry"]], how="left", predicate="within")
print(f"  Joined rows: {len(joined)}, matched: {joined['h3_id'].notna().sum()}")

# Aggregate: multiple square centroids may fall in same H3 hex → average
gap_cols = ["demand_pressure", "avg_friction", "avg_detour", "avg_congestion",
            "demand_norm", "friction_norm", "intensity_norm", "gap_index",
            "relief_vulnerability"]
count_cols = ["education_count", "food_count", "leisure_count", "medical_count",
              "office_count", "retail_count", "scenic_count", "service_count",
              "pop_count"]

matched = joined[joined["h3_id"].notna()].copy()
agg_dict = {}
for c in gap_cols:
    if c in matched.columns:
        agg_dict[c] = "mean"
for c in count_cols:
    if c in matched.columns:
        agg_dict[c] = "sum"
if "covered_by_10" in matched.columns:
    agg_dict["covered_by_10"] = "max"
if "intensity_index" in matched.columns:
    agg_dict["intensity_index"] = "mean"

grouped = matched.groupby("h3_id").agg(agg_dict).reset_index()
print(f"  H3 hexagons with gap data: {len(grouped)}")

gap_records = []
for _, r in grouped.iterrows():
    rec = {"h3": r["h3_id"]}
    for col in grouped.columns:
        if col == "h3_id":
            continue
        val = r[col]
        if isinstance(val, (bool, np.bool_)):
            rec[col] = bool(val)
        elif val is None or (isinstance(val, float) and np.isnan(val)):
            rec[col] = 0
        elif isinstance(val, float):
            rec[col] = round(val, 4)
        else:
            rec[col] = val
    gap_records.append(rec)

# ── Override avg_friction using route-line densification (every 200 m) ──
# Falls back to OD endpoint (O+D) if route gpkg is unavailable.
from shapely.geometry import Point as _Point
from shapely.ops import transform as _shp_transform
import pyproj as _pyproj

ROUTES_PATH = NB / "10 OD & Ground Friction" / "data_out" / "sz_routes.gpkg"
_SAMPLE_STEP_M = 200

print("\nRoute-line densification → hex friction …")
if ROUTES_PATH.exists():
    _routes = gpd.read_file(ROUTES_PATH)
    print(f"  Loaded {len(_routes)} routes from sz_routes.gpkg")

    _proj_to_m = _pyproj.Transformer.from_crs("EPSG:4326", "EPSG:32650", always_xy=True).transform
    _proj_to_ll = _pyproj.Transformer.from_crs("EPSG:32650", "EPSG:4326", always_xy=True).transform

    _sample_lons, _sample_lats, _sample_gfs = [], [], []
    for _, _row in _routes.iterrows():
        _gf = float(_row.get("ground_friction") or 0)
        _line_m = _shp_transform(_proj_to_m, _row.geometry)
        _length = _line_m.length
        if _length <= 0:
            continue
        _n_pts = max(2, int(_length / _SAMPLE_STEP_M) + 1)
        for _k in range(_n_pts):
            _frac = _k / (_n_pts - 1)
            _pt_m = _line_m.interpolate(_frac, normalized=True)
            _pt_ll = _shp_transform(_proj_to_ll, _pt_m)
            _sample_lons.append(_pt_ll.x)
            _sample_lats.append(_pt_ll.y)
            _sample_gfs.append(_gf)

    print(f"  Sampled {len(_sample_gfs):,} points ({_SAMPLE_STEP_M}m step)")
    if _sample_gfs:
        _pts_gdf = gpd.GeoDataFrame(
            {"gf": _sample_gfs},
            geometry=gpd.points_from_xy(_sample_lons, _sample_lats, crs="EPSG:4326"),
        )
        _joined = gpd.sjoin(_pts_gdf, h3_master_wgs84, how="inner", predicate="within")
        _fr_mean = _joined.groupby("h3_id", observed=True)["gf"].mean()
        _friction_by_h3 = {str(k): float(v) for k, v in _fr_mean.items()}
        _n_assigned = sum(1 for rec in gap_records if str(rec["h3"]) in _friction_by_h3)
        for rec in gap_records:
            _hid = str(rec["h3"])
            if _hid in _friction_by_h3:
                rec["avg_friction"] = round(_friction_by_h3[_hid], 4)
        print(f"  {len(_friction_by_h3)} hexagons with route-sampled friction ({_n_assigned} rows updated)")
else:
    print("  sz_routes.gpkg not found — falling back to OD endpoint (O+D) …")
    _od_path = OUT / "page2_od_analysis.json"
    if not _od_path.exists():
        _od_path = OUT / "od_analysis.json"
    if _od_path.exists():
        with open(_od_path, encoding="utf-8") as _f:
            _od_raw = json.load(_f)
        _feats = _od_raw.get("features", _od_raw)
        _rows = []
        for _feat in _feats:
            _p = _feat.get("properties", _feat)
            try:
                _gf = float(_p.get("ground_friction") or 0)
            except (TypeError, ValueError):
                continue
            _rows.append((_p["o_lon"], _p["o_lat"], _gf))
            _rows.append((_p["d_lon"], _p["d_lat"], _gf))
        if _rows:
            _pts = gpd.GeoDataFrame(
                {"gf": [t[2] for t in _rows]},
                geometry=gpd.points_from_xy([t[0] for t in _rows], [t[1] for t in _rows], crs="EPSG:4326"),
            )
            _joined = gpd.sjoin(_pts, h3_master_wgs84, how="inner", predicate="within")
            _fr_mean = _joined.groupby("h3_id", observed=True)["gf"].mean()
            _friction_by_h3 = {str(k): float(v) for k, v in _fr_mean.items()}
            _n_assigned = sum(1 for rec in gap_records if str(rec["h3"]) in _friction_by_h3)
            for rec in gap_records:
                _hid = str(rec["h3"])
                if _hid in _friction_by_h3:
                    rec["avg_friction"] = round(_friction_by_h3[_hid], 4)
            print(f"  OD endpoint fallback: {len(_friction_by_h3)} hexagons ({_n_assigned} rows updated)")
    else:
        print("  No OD data found — friction stays as square-grid aggregate only")

# Recompute demand_norm, friction_norm, intensity_norm, gap_index (notebook 11 formula)
def _norm_array(vals):
    vals = np.asarray(vals, dtype=float)
    mn, mx = float(vals.min()), float(vals.max())
    if mx <= mn:
        return np.zeros_like(vals)
    return (vals - mn) / (mx - mn)

_dp = np.array([float(rec.get("demand_pressure") or 0) for rec in gap_records])
_af = np.array([float(rec.get("avg_friction") or 0) for rec in gap_records])
_ii = np.array([float(rec.get("intensity_index") or 0) for rec in gap_records])
_dn = _norm_array(_dp)
_fn = _norm_array(_af)
_in = _norm_array(_ii)
for _i, rec in enumerate(gap_records):
    _dnv = float(_dn[_i])
    _fnv = float(_fn[_i])
    _inv = float(_in[_i])
    rec["demand_norm"] = round(_dnv, 4)
    rec["friction_norm"] = round(_fnv, 4)
    rec["intensity_norm"] = round(_inv, 4)
    rec["gap_index"] = round(
        0.4 * _dnv * _fnv + 0.3 * _inv * _fnv + 0.3 * _dnv * _inv,
        4,
    )

save("h3_gap.json", gap_records)
save("page2_h3_gap.json", gap_records)


# ══════════════════════════════════════════
# 4. Takeout demand + food coverage (14)
# ══════════════════════════════════════════
TAKEOUT_PATH = NB / "14 Takeout Demand Coverage" / "data_out" / "sz_takeout_demand_grid.gpkg"
if TAKEOUT_PATH.exists():
    print("\nExporting h3_takeout.json …")
    takeout = gpd.read_file(TAKEOUT_PATH)

    # ── Recompute takeout_demand_index with updated weights ──
    # New formula (decoupled from supply-side POI):
    #   0.50 * real_order_norm + 0.30 * pop_norm + 0.20 * residential_norm
    # Dropped from previous version: food_count (overlaps with supply layer),
    # xiaoqu_count (redundant with residential_count).
    def _minmax(series):
        mn, mx = series.min(), series.max()
        if mx == mn:
            return series * 0
        return (series - mn) / (mx - mn)

    if {"real_order_count", "pop_count", "residential_count"}.issubset(takeout.columns):
        order_n = _minmax(takeout["real_order_count"].fillna(0))
        pop_n   = _minmax(takeout["pop_count"].fillna(0))
        res_n   = _minmax(takeout["residential_count"].fillna(0))
        takeout["takeout_demand_index"] = 0.50 * order_n + 0.30 * pop_n + 0.20 * res_n
        idx_mn, idx_mx = takeout["takeout_demand_index"].min(), takeout["takeout_demand_index"].max()
        takeout["takeout_demand_norm"] = (
            (takeout["takeout_demand_index"] - idx_mn) / (idx_mx - idx_mn)
            if idx_mx > idx_mn else takeout["takeout_demand_index"] * 0
        )
        print(f"  Recomputed takeout_demand_index: "
              f"max={takeout['takeout_demand_index'].max():.4f}, "
              f"mean={takeout['takeout_demand_index'].mean():.4f}")

    takeout_records = []
    takeout_cols = [c for c in takeout.columns if c not in ("geometry", "h3_id")]
    for _, r in takeout.iterrows():
        rec = {"h3": r["h3_id"]}
        for col in takeout_cols:
            val = r[col]
            if val is None or (isinstance(val, float) and np.isnan(val)):
                rec[col] = 0
            elif isinstance(val, float):
                rec[col] = round(val, 4)
            else:
                rec[col] = int(val) if isinstance(val, (np.integer,)) else val
        takeout_records.append(rec)
    save("h3_takeout.json", takeout_records)
else:
    print(f"\n⚠ Skipping h3_takeout.json — {TAKEOUT_PATH} not found. Run notebook 14 first.")


# ══════════════════════════════════════════
# Summary
# ══════════════════════════════════════════
print("\n✅ All grid data converted to H3 hex res-8!")
print("   Files: h3_demand.json, h3_population.json, h3_building.json, "
      "h3_gap.json (+ page2_h3_gap.json), h3_takeout.json")
print("   All keyed by h3_id — no geometry needed (deck.gl H3HexagonLayer renders natively)")
