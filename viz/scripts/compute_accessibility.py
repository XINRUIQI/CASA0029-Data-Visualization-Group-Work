"""
Precompute accessibility and A-D values for Page6.

Steps:
1. local_acc_count  = own POI + POI of all hexes within 3km
2. Min-max normalize → local_acc_index (0-1)
3. For each budget (20, 50, 100):
   - Select top-N sites by composite score
   - Map sites → H3 hexes
   - For each drone-site pair within 3km: they are "connected"
   - For each drone site S:
       extra_S = sum of connected drone sites' local_acc_index
   - For every hex within 3km of site S:
       final_acc_index += extra_S
4. A-D = final_acc_index - demand_norm

Output: viz/public/data/page6_accessibility.json
"""

import json, math, os

RADIUS_KM = 3.0
DEG_BUFFER = 0.035
BUDGETS = [20, 50, 100]

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def composite_score(s):
    d = s.get("demand_norm", 0)
    f = s.get("friction_norm", 0)
    i = s.get("intensity_norm", 0)
    return 0.4 * d * f + 0.3 * i * f + 0.3 * d * i

def main():
    from h3 import cell_to_latlng, latlng_to_cell

    base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    demand_path = os.path.join(base, "public", "data", "h3_demand.json")
    gap_path    = os.path.join(base, "public", "data", "page2_h3_gap.json")
    sites_path  = os.path.join(base, "public", "data", "page6_candidate_sites.json")
    out_path    = os.path.join(base, "public", "data", "page6_accessibility.json")

    with open(demand_path) as f:
        demand = json.load(f)
    with open(gap_path) as f:
        gap = json.load(f)
    with open(sites_path) as f:
        sites = json.load(f)

    gap_map = {g["h3"]: g for g in gap}
    n = len(demand)
    print(f"Loaded {n} hexes, {len(sites)} candidate sites")

    # --- Step 1: local_acc_count ---
    coords = []
    pois = []
    h3_ids = []
    for d in demand:
        lat, lon = cell_to_latlng(d["h3"])
        coords.append((lat, lon))
        pois.append(d.get("poi", 0.0))
        h3_ids.append(d["h3"])

    local_acc = [0.0] * n
    for i in range(n):
        lat_i, lon_i = coords[i]
        total = pois[i]
        for j in range(n):
            if i == j:
                continue
            lat_j, lon_j = coords[j]
            if abs(lat_j - lat_i) > DEG_BUFFER or abs(lon_j - lon_i) > DEG_BUFFER:
                continue
            if haversine_km(lat_i, lon_i, lat_j, lon_j) <= RADIUS_KM:
                total += pois[j]
        local_acc[i] = total
        if (i + 1) % 500 == 0:
            print(f"  local_acc: {i + 1}/{n}")

    # --- Step 2: normalize → local_acc_index ---
    lo = min(local_acc)
    hi = max(local_acc)
    span = hi - lo if hi > lo else 1.0
    local_acc_idx = [(v - lo) / span for v in local_acc]
    print(f"local_acc_count range: {lo} – {hi}")

    demand_norms = [gap_map.get(h, {}).get("demand_norm", 0) for h in h3_ids]
    h3_to_i = {h: i for i, h in enumerate(h3_ids)}

    # --- Step 3: for each budget ---
    scored = sorted(sites, key=composite_score, reverse=True)

    budget_results = {}
    for budget in BUDGETS:
        selected = scored[:budget]

        # Map sites to hexes
        drone_sites = []
        drone_hex_set = set()
        for s in selected:
            hid = latlng_to_cell(s["lat"], s["lon"], 8)
            idx = h3_to_i.get(hid)
            if idx is not None and hid not in drone_hex_set:
                drone_hex_set.add(hid)
                drone_sites.append({
                    "h3": hid, "idx": idx,
                    "lat": coords[idx][0], "lon": coords[idx][1],
                    "lai": local_acc_idx[idx],
                })

        # For each drone site, compute extra = sum of connected sites' lai
        site_extra = {}
        for a in drone_sites:
            ex = 0.0
            for b in drone_sites:
                if a["h3"] == b["h3"]:
                    continue
                if haversine_km(a["lat"], a["lon"], b["lat"], b["lon"]) <= RADIUS_KM:
                    ex += b["lai"]
            site_extra[a["h3"]] = ex

        # For each hex, accumulate boost from all drone sites within 3km
        hex_boost = [0.0] * n
        for site in drone_sites:
            ex = site_extra[site["h3"]]
            if ex <= 0:
                continue
            slat, slon = site["lat"], site["lon"]
            for i in range(n):
                lat_i, lon_i = coords[i]
                if abs(lat_i - slat) > DEG_BUFFER or abs(lon_i - slon) > DEG_BUFFER:
                    continue
                if haversine_km(lat_i, lon_i, slat, slon) <= RADIUS_KM:
                    hex_boost[i] += ex

        final_idx = [round(local_acc_idx[i] + hex_boost[i], 6) for i in range(n)]
        ad_after = [round(final_idx[i] - demand_norms[i], 6) for i in range(n)]
        ad_before = [round(local_acc_idx[i] - demand_norms[i], 6) for i in range(n)]

        neg_b = sum(1 for x in ad_before if x < 0)
        neg_a = sum(1 for x in ad_after if x < 0)
        boosted = sum(1 for i in range(n) if hex_boost[i] > 0)
        print(f"  budget={budget}: drone_hexes={len(drone_sites)}, "
              f"boosted_hexes={boosted}, neg before={neg_b}, neg after={neg_a} (Δ{neg_a - neg_b:+d})")

        budget_results[budget] = {"final_acc_index": final_idx, "ad_after": ad_after}

    # --- Step 4: build output ---
    result = []
    for i in range(n):
        row = {
            "h3": h3_ids[i],
            "lai": round(local_acc_idx[i], 6),
            "dn": round(demand_norms[i], 6),
            "adb": round(local_acc_idx[i] - demand_norms[i], 6),
        }
        for budget in BUDGETS:
            row[f"fai{budget}"] = budget_results[budget]["final_acc_index"][i]
            row[f"ada{budget}"] = budget_results[budget]["ad_after"][i]
        result.append(row)

    with open(out_path, "w") as f:
        json.dump(result, f, separators=(",", ":"))
    print(f"Wrote {len(result)} records to {out_path}")

if __name__ == "__main__":
    main()
