import { useEffect, useState } from 'react'
import mapboxgl, { MapboxOptions } from 'mapbox-gl'
import './App.css'
import { LngLat, getTileCoordFromPixel, lngLatToPixel, getPixelInTile } from './geo_util'

const options: MapboxOptions = {
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
  container: 'mapbox-map',
  style: 'mapbox://styles/sw1227/ckqyzf3tm1s0v17rv3rnaxgxm',
  localIdeographFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif",
  center: [139.7, 35.7],
  zoom: 12
}

// Given lng/lat position, return dem tile data and index of the point in the tile
const fetchTile = async (lngLat: LngLat): Promise<{ tile: number[][], indexInTile: { x: number, y: number } }> => {
  // Conevert to tile coordinate
  const zoom = 13;
  const pixelCoord = lngLatToPixel(lngLat, zoom)
  const tileCoord = getTileCoordFromPixel(pixelCoord)

  // Fetch dem tile data
  const url = `https://cyberjapandata.gsi.go.jp/xyz/dem/${tileCoord.z}/${tileCoord.x}/${tileCoord.y}.txt`
  const text = await fetch(url).then(res => res.text());
  const rows = text.split('\n')
  const tile = rows
    .slice(0, rows.length - 1) // last row is empty
    .map(r => r.split(',').map(d => d === 'e' ? 0 : parseFloat(d))) // e: sea

  return { tile, indexInTile: getPixelInTile(pixelCoord) }
}

const useMapboxMap = (options: MapboxOptions) => {
  const [map, setMap] = useState<mapboxgl.Map>()

  // Create a map instance on initial render
  useEffect(() => {
    const map = new mapboxgl.Map(options)

    // Add click event listener to the map
    map.on('click', async (e) => {

      const { tile, indexInTile } = await fetchTile(e.lngLat);
      console.log(`TODO: height: ${tile[indexInTile.y][indexInTile.x]}`)

      const marker = new mapboxgl.Marker()
        .setLngLat(e.lngLat)
        .addTo(map);
    })
    setMap(map)
  }, [])

  return map
}

function App() {
  const map = useMapboxMap(options);

  return (
    <div>
      <div id="mapbox-map" />
    </div>
  )
}

export default App
