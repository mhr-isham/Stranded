"""Pack Kepler Q0 photometry for the Transit Archive (requires astropy and numpy).

Run with the DR25 FITS file listed in docs/GAME-REVIEW.md, then use the output
as src/data/kepler-archive.json. Each row is [elapsed days, flux offset in ppm].
"""
import json
import sys

import numpy as np
from astropy.io import fits

with fits.open(sys.argv[1]) as hdus:
    assert hdus[0].header['KEPLERID'] == 10666592
    assert hdus[0].header['QUARTER'] == 0 and hdus[0].header['DATA_REL'] == 25
    data = hdus[1].data
    good = (data['SAP_QUALITY'] == 0) & np.isfinite(data['TIME']) & np.isfinite(data['PDCSAP_FLUX'])
    time = np.asarray(data['TIME'][good])
    flux = np.asarray(data['PDCSAP_FLUX'][good], dtype=float)

elapsed = time - time[0]
baseline = float(np.median(flux))
bins = np.floor(elapsed * 100).astype(int)
rows = []
for index in np.unique(bins):
    keep = bins == index
    if keep.sum() < 5:
        continue
    rows.append([round(float(np.median(elapsed[keep])), 5),
                 round(float((np.median(flux[keep]) / baseline - 1) * 1e6))])
print('[')
for start in range(0, len(rows), 12):
    line = ','.join(json.dumps(row, separators=(',', ':')) for row in rows[start:start+12])
    print('  ' + line + (',' if start + 12 < len(rows) else ''))
print(']')
