"""Optional Natural Earth display layers; pip dependencies: pyshp, shapely."""
import gzip, hashlib, json, zipfile
from pathlib import Path
from urllib.request import urlopen
import shapefile
from shapely.geometry import shape, mapping
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

root = Path('.work/cartography'); root.mkdir(parents=True, exist_ok=True)
sources = [
 ('provinces', 'cultural', 'ne_10m_admin_1_states_provinces_lines', '86acd56ce6c0e47f5fa79725591533b5766f26d6ed1437b086f2b8d4028fe456'),
 ('shallow', 'physical', 'ne_10m_bathymetry_K_200', '68fe55b9ac57bd8255696d83259f5856594a60c582dd395de9c1772179337887'),
 ('deep', 'physical', 'ne_10m_bathymetry_J_1000', 'ff586fb1faf86c9917519577f1490a2106d7c45a456053374731f59aac0211e5')
]
for alias, category, name, digest in sources:
 archive = root / (alias + '.zip')
 if not archive.exists(): archive.write_bytes(urlopen(f'https://naturalearth.s3.amazonaws.com/10m_{category}/{name}.zip', timeout=60).read())
 assert hashlib.sha256(archive.read_bytes()).hexdigest() == digest, 'Source changed; verify before updating'
 zipfile.ZipFile(archive).extractall(root)

countries = json.loads(gzip.decompress(Path('data/countries-cn.geojson.gz').read_bytes()))
china = unary_union([shape(f['geometry']) for f in countries['features'] if f['id'] == 'CHN'])
lines = []
for record in shapefile.Reader(str(root / sources[0][2])).iterShapeRecords():
 if record.record.as_dict()['ADM0_A3'] == 'CHN':
  # Internal lines only: never add a competing coastline or external border.
  g = shape(record.shape.__geo_interface__).intersection(china.buffer(-.005))
  if not g.is_empty: lines.append(g)
province = unary_union(lines).simplify(.008, preserve_topology=True)
Path('data/china-provinces.geojson').write_text(json.dumps({'type':'Feature','properties':{'source':'Natural Earth admin-1 lines 5.1.0','scope':'China internal boundaries; not officially reviewed'},'geometry':mapping(province)}, separators=(',',':')))
depths = []
for depth, source in zip([200,1000], sources[1:]):
 polygons = []
 for record in shapefile.Reader(str(root / source[2])).iterShapeRecords():
  g = shape(record.shape.__geo_interface__).simplify(.035, preserve_topology=True)
  polygons.extend(list(g.geoms) if g.geom_type == 'MultiPolygon' else [g])
 # d3 uses clockwise exterior rings for small geographic polygons.
 geometry = {'type':'MultiPolygon','coordinates':[mapping(orient(g, sign=-1))['coordinates'] for g in polygons]}
 depths.append({'type':'Feature','properties':{'depth':depth},'geometry':geometry})
Path('data/bathymetry.geojson').write_text(json.dumps({'type':'FeatureCollection','features':depths}, separators=(',',':')))
print('Prepared internal province lines and generalized 200m/1000m depth contours')
