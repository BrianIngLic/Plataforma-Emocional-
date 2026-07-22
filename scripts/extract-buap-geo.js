const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

// Path to the cached markers.js file from the agent brain
const cachePath = 'C:/Users/guill/.gemini/antigravity/brain/e05a0c0d-d249-48c7-a471-8a6a579dd0cd/.system_generated/steps/96/content.md';
const outputGeoJsonDir = path.join(__dirname, '../public/assets/geo');
const outputSqlDir = path.join(__dirname, '../db/seeds');

// Ensure directories exist
if (!fs.existsSync(outputGeoJsonDir)) {
  fs.mkdirSync(outputGeoJsonDir, { recursive: true });
}
if (!fs.existsSync(outputSqlDir)) {
  fs.mkdirSync(outputSqlDir, { recursive: true });
}

// Read markers.js content
let content = fs.readFileSync(cachePath, 'utf8');
const startIndex = content.indexOf('//MARCADORES');
if (startIndex !== -1) {
  content = content.substring(startIndex);
}

// Execute in VM with proxy sandbox to extract variable values
const sandbox = { console, L: {} };
const proxySandbox = new Proxy(sandbox, {
  has: () => true,
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return new Proxy(() => {}, {
      get: (t, p) => {
        if (p === 'addTo') return () => ({ bindPopup: () => ({ on: () => {} }) });
        return new Proxy(() => {}, {});
      },
      construct: () => ({})
    });
  },
  set: (target, prop, value) => {
    target[prop] = value;
    return true;
  }
});

vm.runInNewContext(content, proxySandbox);

// List of arrays we want to process
const datasets = {
  cnsGeoJSON: 'Ciencias Naturales y de la Salud',
  cshGeoJSON: 'Ciencias Sociales y Humanidades',
  eaGeoJSON: 'Económico Administrativo',
  iceGeoJSON: 'Ingeniería y Ciencias Exactas',
  dependenciasGeoJSON: 'Dependencias BUAP',
  emasGeoJSON: 'Edificios Multiaulas',
  institutosGeoJSON: 'Institutos',
  accesosGeoJson: 'Accesos'
};

// Simple cache to avoid redundant requests and rate limiting
const cacheFilePath = path.join(__dirname, 'resolved-urls-cache.json');
let urlCache = {};
if (fs.existsSync(cacheFilePath)) {
  try {
    urlCache = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
  } catch (e) {
    urlCache = {};
  }
}

// Helper to resolve short URL to long URL
function resolveUrl(url) {
  if (urlCache[url]) {
    return Promise.resolve(urlCache[url]);
  }
  return new Promise((resolve) => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    };
    https.get(url, options, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const redirectUrl = res.headers.location;
        urlCache[url] = redirectUrl;
        fs.writeFileSync(cacheFilePath, JSON.stringify(urlCache, null, 2), 'utf8');
        resolve(redirectUrl);
      } else {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const match = data.match(/url=([^"]+)/i) || data.match(/href="([^"]+)"/i);
          if (match) {
            const redirectUrl = decodeURIComponent(match[1]);
            urlCache[url] = redirectUrl;
            fs.writeFileSync(cacheFilePath, JSON.stringify(urlCache, null, 2), 'utf8');
            resolve(redirectUrl);
          } else {
            resolve(url); // fallback
          }
        });
      }
    }).on('error', (err) => {
      console.error(`Error resolving URL ${url}:`, err.message);
      resolve(null);
    });
  });
}

// Extract lat/lng from resolved URL
function extractCoords(longUrl) {
  if (!longUrl) return null;
  
  // Try precise marker coordinates first: !3d18.9969573!4d-98.2029542
  const exactMatch = longUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (exactMatch) {
    return {
      lat: parseFloat(exactMatch[1]),
      lng: parseFloat(exactMatch[2])
    };
  }

  // Try center coordinates: @18.9972149,-98.2030879
  const centerMatch = longUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (centerMatch) {
    return {
      lat: parseFloat(centerMatch[1]),
      lng: parseFloat(centerMatch[2])
    };
  }

  // Try search query coordinates: q=18.9972149,-98.2030879 or query=
  const qMatch = longUrl.match(/q=(-?\d+\.\d+),\s*\+?\s*(-?\d+\.\d+)/) ||
                 longUrl.match(/query=(-?\d+\.\d+),\s*\+?\s*(-?\d+\.\d+)/) ||
                 longUrl.match(/search\/(-?\d+\.\d+),\s*\+?\s*(-?\d+\.\d+)/);
  if (qMatch) {
    return {
      lat: parseFloat(qMatch[1]),
      lng: parseFloat(qMatch[2])
    };
  }

  return null;
}

// Function to extract short code from faculty name (e.g. "Facultad de Ciencias de la Computación - FCC" -> "FCC")
function extractCode(name) {
  // Custom manual mappings first
  if (name.includes('Computación')) return 'FCC';
  if (name.includes('Biología')) return 'BIO';
  if (name.includes('Químicas')) return 'FCQ';
  if (name.includes('Cultura Física')) return 'FCF';
  if (name.includes('Veterinaria')) return 'MVZ';
  if (name.includes('Políticas')) return 'CPS';
  if (name.includes('Derecho')) return 'DER';
  if (name.includes('Lenguas')) return 'LEN';
  if (name.includes('Filosofía')) return 'FIL';
  if (name.includes('Administración')) return 'ADM';
  if (name.includes('Contaduría')) return 'FCP';
  if (name.includes('Economía')) return 'ECO';
  if (name.includes('Arquitectura')) return 'ARQ';
  if (name.includes('Electrónica')) return 'FCE';
  if (name.includes('Físico-Matemáticas')) return 'FM';
  if (name.includes('Ingeniería Química')) return 'FIQ';
  if (name.includes('Ingeniería')) return 'ING';
  if (name.includes('Medicina')) return 'MED';
  if (name.includes('Biblioteca Central')) return 'BC';

  const match = name.match(/-\s*([A-Z0-9]+)\s*$/) || name.match(/\(\s*([A-Z0-9]+)\s*\)/);
  if (match) return match[1];
  
  return null;
}

async function run() {
  const geojsonFeatures = [];
  const sqlStatements = [];
  
  sqlStatements.push('-- Seeds for faculties and campuses geographical data\n');
  sqlStatements.push('BEGIN;\n');

  let totalProcessed = 0;
  let totalResolved = 0;

  for (const [varName, areaName] of Object.entries(datasets)) {
    const rawList = sandbox[varName];
    if (!rawList || !Array.isArray(rawList)) {
      console.log(`Variable ${varName} not found or is not an array`);
      continue;
    }

    console.log(`Processing dataset ${varName} (${areaName}): ${rawList.length} items`);

    for (const item of rawList) {
      if (item.type !== 'Feature') continue;
      const props = item.properties || {};
      const name = props.name || 'Sin Nombre';
      const shortUrl = props.ruta;

      totalProcessed++;
      let lat = null;
      let lng = null;

      if (shortUrl) {
        // Delay a bit to avoid rate limits
        await new Promise(r => setTimeout(r, 80));
        
        console.log(`[${totalProcessed}] Resolving short URL for: ${name}...`);
        const longUrl = await resolveUrl(shortUrl);
        const coords = extractCoords(longUrl);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          totalResolved++;
          console.log(`    -> Coords found: ${lat}, ${lng}`);
        } else {
          console.log(`    -> Could not extract coordinates from resolved URL: ${longUrl}`);
        }
      } else {
        console.log(`[${totalProcessed}] No short URL for: ${name}`);
      }

      // If no real coordinates, use dummy center coords for CU
      const useRealCoords = (lat !== null && lng !== null);
      const finalLat = useRealCoords ? lat : 19.0049;
      const finalLng = useRealCoords ? lng : -98.2023;

      // Add to GeoJSON features
      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [finalLng, finalLat]
        },
        properties: {
          name: name,
          code: extractCode(name),
          campus_code: 'CU',
          area: areaName,
          buap_info_url: props.info || null,
          virtual_tour_url: props.recorrido || null,
          google_maps_url: shortUrl || null,
          is_geo_accurate: useRealCoords
        }
      };
      geojsonFeatures.push(feature);

      // Generate SQL seed statements for faculties (only for academic fields that map to student faculties)
      // Exclude doors/accesos, dependencias, etc. unless they are defined as faculties in the app
      const isAcademic = ['cnsGeoJSON', 'cshGeoJSON', 'eaGeoJSON', 'iceGeoJSON'].includes(varName);
      if (isAcademic && useRealCoords) {
        const code = extractCode(name);
        const cleanedName = name.replace(/\s*-\s*[A-Z0-9-y]+$/, '').trim(); // Remove suffix like " - FCC" or " - FCQ1-8"
        sqlStatements.push(`
-- Faculty: ${name}
INSERT INTO public.faculties (campus_id, name, virtual_tour_url, latitude, longitude, faculty_code)
VALUES (
  (SELECT id FROM public.campuses WHERE campus_code = 'CU' LIMIT 1),
  '${cleanedName.replace(/'/g, "''")}',
  ${props.recorrido ? `'${props.recorrido}'` : 'NULL'},
  ${lat.toFixed(7)},
  ${lng.toFixed(7)},
  ${code ? `'${code}'` : 'NULL'}
)
ON CONFLICT (name) DO UPDATE SET
  virtual_tour_url = COALESCE(EXCLUDED.virtual_tour_url, public.faculties.virtual_tour_url),
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  faculty_code = COALESCE(EXCLUDED.faculty_code, public.faculties.faculty_code);
`);
      }
    }
  }

  sqlStatements.push('\nCOMMIT;\n');

  // Write files
  const geojsonOutput = {
    type: 'FeatureCollection',
    features: geojsonFeatures
  };

  const geojsonPath = path.join(outputGeoJsonDir, 'cu-campus.geojson');
  fs.writeFileSync(geojsonPath, JSON.stringify(geojsonOutput, null, 2), 'utf8');
  console.log(`Saved GeoJSON to ${geojsonPath}`);

  const sqlPath = path.join(outputSqlDir, 'faculties-geo.sql');
  fs.writeFileSync(sqlPath, sqlStatements.join(''), 'utf8');
  console.log(`Saved SQL seeds to ${sqlPath}`);

  console.log(`Finished: Processed ${totalProcessed} features, resolved ${totalResolved} coordinates.`);
}

run().catch(console.error);
