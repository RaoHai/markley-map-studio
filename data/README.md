# External map data

No real map dataset is stored in this directory or bundled into the application. The descriptions below document the separately downloadable default package. Generated files are Git-ignored. Existing historical commits may still contain previous datasets.

# China-POV geography and correction record

This is a sourced geographic correction, **not a map approved by China's natural resources authorities**. No map-review number is claimed or inherited from another map. Natural Earth China POV is third-party data, not the official Chinese boundary standard.

## Sources

- Countries: Natural Earth 5.1.1, 1:10m, China point of view. [Publisher](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/), [source ZIP](https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries_chn.zip). SHA-256: `16e7589083527d01208b9f645fc8643c767170258e9d13b59d37bc5a1f6a8758`.
- Minor islands: Natural Earth 5.1.1, `ne_10m_admin_0_scale_rank_minor_islands`.
- Maritime segments: Natural Earth 5.1.0, `ne_10m_admin_0_boundary_lines_maritime_indicator_chn`.
- The latter two datasets are pinned to [Natural Earth source commit ca96624a56bd078437bca8184e78163e5039ad19](https://github.com/nvkelso/natural-earth-vector/tree/ca96624a56bd078437bca8184e78163e5039ad19/10m_cultural).
- Diaoyu and affiliated island markers: the main eight island names and coordinates from [State Oceanic Administration's official coordinate announcement, republished by MFA](https://www.fmprc.gov.cn/diaoyudao/chn/zrhj/201510/t20151009_8520998.htm). They are position symbols, not enlarged coastlines or territorial-sea baselines.
- Zengmu Ansha (James Shoal): 3°58′N, 112°17′E, [People's Daily/CPC report, 2013-05-15](https://cpc.people.com.cn/n/2013/0515/c117005-21495182.html). A hollow shoal symbol is used; submerged shoals are not painted as land.

## Processing

1. Use the publisher's China POV polygons instead of world-atlas's default de facto polygons.
2. Dissolve features with Chinese sovereignty (CHN/CH1) into a single CHN feature, including Taiwan, Hong Kong, and Macao.
3. Supplement Paracel and Spratly island polygons and Scarborough Reef from the minor-island dataset. Subtract overlap from other features, so the same island is not assigned to two map features.
4. Orient polygon rings for D3 spherical geometry, then build one shared TopoJSON topology. Retain 30% of weighted vertices and quantize to a million steps. Coastlines and national boundaries share the same arcs.
5. Use point symbols for small island positions that are otherwise difficult to see at poster scale. These are distinct from geographic land polygons; their size is a cartographic symbol, not physical area.
6. Project all geometry, sea-line segments, and marker positions through the same Markley projection, clip once, and repeat the same unit for preview, PNG, and SVG.

`countries-cn.geojson.gz` is the intermediate geometry before topological reduction. Regenerate the display topology with `npm run geography`, then `npm run build`. Full source preparation is in `scripts/prepare-geography.py`; install `pyshp` and `shapely` in a Python virtual environment before using it.

## Known limits

- The Natural Earth maritime supplement supplies **nine South China Sea segments**. It does not supply a verified Chinese-standard East China Sea segment. No missing line has been invented by hand. That item still requires official-source geometry and standard-map verification.
- The mainland borders and island outlines have not been certified against every point of the official Chinese standard boundary maps. Samples verify Taiwan, Hong Kong, Macao, Tawang, Aksai Chin, and Hainan membership, but do not constitute an official conformity check.
- Tiny island outlines are generalized. Official-coordinate marker positions and Natural Earth outlines can differ at this scale; the marker facts must not be read as a precise surveyed coastline.
- Free zoom, panning, and export cropping can omit portions of a full world map. The exporter does not certify complete national territory in arbitrary user compositions.
- Public use in China requires determining and completing applicable map-review procedures. This correction alone does not establish legal compliance.

Natural Earth data is public domain. Official geographic coordinate facts are attributed above. The artifact uses no restricted survey data.


## Optional atlas layers

- `china-provinces.geojson`: Natural Earth admin-1 boundary lines 5.1.0, ADM0_A3=CHN only. Clipped to the interior of this repository's China geometry (0.005° inset), merged once, simplified at 0.008°. Only internal lines are added; this does not replace the China POV national border. The source is generalized and may omit segments; it is not an official administrative boundary dataset.
- `bathymetry.geojson`: Natural Earth 200m and 1000m nested ocean-depth polygons 4.0.0, derived from SRTM Plus. Simplified at 0.035°, with clockwise exterior rings for d3. Display layers, not navigational depth data. Transparent export omits both bathymetric fills.
- Country colors use the existing shared China POV country topology. A deterministic adjacency coloring assigns distinct fills to neighboring countries; borders are still drawn only once.
- Local scale: projected differential at 120°W, 20°S, using great-circle distance on a 6371.0088 km sphere. A 1000 km bar shows local scale only, not an exact finite geodesic or a global map scale. Every repeated map cell carries the same geographic reference.
- Rebuild optional layers with `python scripts/prepare-cartography.py` (pyshp and shapely required). Source ZIP hashes are pinned in the script.

Sources: [Admin-1 boundary lines](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-1-states-provinces/), [bathymetry](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-bathymetry/). Both datasets are public domain.
