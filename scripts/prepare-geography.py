import json,shapefile,hashlib
from pathlib import Path
from shapely.geometry import shape,mapping,Point
from shapely.ops import unary_union
from shapely.geometry.polygon import orient
from shapely.geometry import MultiPolygon
def orient_polygons(g,exterior_cw=True):
 if g.geom_type=='Polygon':return orient(g,sign=-1)
 return MultiPolygon([orient(p,sign=-1) for p in g.geoms if p.geom_type=='Polygon'])
root=Path('.work/geo-sources');out=Path('data');root.mkdir(parents=True,exist_ok=True);out.mkdir(exist_ok=True)
# Reproducible downloads use a fixed Natural Earth source commit and ZIP hash.
from urllib.request import urlopen
from concurrent.futures import ThreadPoolExecutor
import zipfile,re
from html.parser import HTMLParser
sha='ca96624a56bd078437bca8184e78163e5039ad19'
zip_path=root/'countries-chn.zip'
if not zip_path.exists():
 zip_path.write_bytes(urlopen('https://naturalearth.s3.amazonaws.com/10m_cultural/ne_10m_admin_0_countries_chn.zip',timeout=60).read())
assert hashlib.sha256(zip_path.read_bytes()).hexdigest()=='16e7589083527d01208b9f645fc8643c767170258e9d13b59d37bc5a1f6a8758','Country source changed; re-verify before updating.'
zipfile.ZipFile(zip_path).extractall(root)
def download(item):
 name,ext=item;f=root/f'{name}.{ext}'
 if not f.exists():f.write_bytes(urlopen(f'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/{sha}/10m_cultural/{name}.{ext}',timeout=60).read())
with ThreadPoolExecutor(max_workers=4) as pool:
 list(pool.map(download,[(name,ext) for name in ['ne_10m_admin_0_scale_rank_minor_islands','ne_10m_admin_0_boundary_lines_maritime_indicator_chn'] for ext in ['shp','shx','dbf']]))
class PageText(HTMLParser):
 def __init__(self):super().__init__();self.items=[]
 def handle_data(self,text):self.items.append(text)
page=PageText();page.feed(urlopen('https://www.fmprc.gov.cn/diaoyudao/chn/zrhj/201510/t20151009_8520998.htm',timeout=60).read().decode('utf-8'))
rows=re.findall(r"(\S*岛|\S*屿)\s+北纬\s*(\d+)°\s*([\d.]+)[′’']\s+东经\s*(\d+)°\s*([\d.]+)[′’']",' '.join(page.items))
assert len(rows)==71,'Official coordinate table changed; re-verify its parser.'
(root/'diaoyu-points.json').write_text(json.dumps([{'name':n,'coordinates':[float(ld)+float(lm)/60,float(bd)+float(bm)/60]} for n,bd,bm,ld,lm in rows],ensure_ascii=False))
reader=shapefile.Reader(str(root/'ne_10m_admin_0_countries_chn'))
countries=[];china=[]
for sr in reader.iterShapeRecords():
 d=sr.record.as_dict();g=shape(sr.shape.__geo_interface__)
 if d['SOV_A3'] in ['CHN','CH1']:china.append(g);continue
 countries.append((d['ADM0_A3'],d['NAME'],g))
# Islands remain measured geographic polygons, not enlarged invented outlines.
# Supplement small Paracel/Spratly islands and Scarborough Reef omitted by the
# country polygons, then remove any overlapping polygons from other records.
minor=shapefile.Reader(str(root/'ne_10m_admin_0_scale_rank_minor_islands'))
islands=[]
for sr in minor.iterShapeRecords():
 d=sr.record.as_dict()
 if d['sr_subunit'] in ['Spratly Is.','Paracel Is.','Scarborough Reef']:
  g=shape(sr.shape.__geo_interface__);islands.append((d['sr_subunit'],g));china.append(g)
china=unary_union(china)
features=[]
for ident,name,g in countries+[('CHN','China',china)]:
 if ident!='CHN':g=g.difference(china)
 if g.is_empty:continue
 g=orient_polygons(g,exterior_cw=True)
 features.append({'type':'Feature','id':ident,'properties':{'name':name},'geometry':mapping(g)})
import gzip
(out/'countries-cn.geojson.gz').write_bytes(gzip.compress(json.dumps({'type':'FeatureCollection','features':features},separators=(',',':')).encode(),mtime=0))
lines=[]
for sr in shapefile.Reader(str(root/'ne_10m_admin_0_boundary_lines_maritime_indicator_chn')).iterShapeRecords():
 lines.append({'type':'Feature','properties':{'source':'Natural Earth 5.1.0 China maritime supplement'},'geometry':sr.shape.__geo_interface__})
(out/'china-maritime.geojson').write_text(json.dumps({'type':'FeatureCollection','features':lines},separators=(',',':')))
# The official point coordinates are kept separate from island outlines.
major={'钓鱼岛','黄尾屿','赤尾屿','南小岛','北小岛','南屿','北屿','飞屿'}
points=[]
for a in json.loads((root/'diaoyu-points.json').read_text()):
 if a['name'] in major:
  points.append({'type':'Feature','properties':{'name':a['name'],'kind':'island','source':'SOA official coordinates, 2012; MFA republication'},'geometry':{'type':'Point','coordinates':a['coordinates']}})
for name,g in islands:
 q=g.representative_point();points.append({'type':'Feature','properties':{'name':{'Spratly Is.':'南沙群岛岛礁','Paracel Is.':'西沙群岛岛礁','Scarborough Reef':'黄岩岛'}[name],'kind':'reef' if name=='Scarborough Reef' else 'island','source':'Natural Earth 5.1.1 minor-island polygon representative point'},'geometry':mapping(q)})
points.append({'type':'Feature','properties':{'name':'曾母暗沙','kind':'shoal','source':'People’s Daily/CPC report 2013-05-15, 3°58′N 112°17′E'},'geometry':{'type':'Point','coordinates':[112+17/60,3+58/60]}})
(out/'china-island-markers.geojson').write_text(json.dumps({'type':'FeatureCollection','features':points},ensure_ascii=False,separators=(',',':')))
print('Countries',len(features),'island markers',len(points),'maritime segments',len(lines))
print('POV ZIP SHA256',hashlib.sha256((root/'countries-chn.zip').read_bytes()).hexdigest())
