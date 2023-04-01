import { useEffect, useState } from 'react'
import mapboxgl, { MapboxOptions } from 'mapbox-gl'
import './App.css'
import { lngLatToPixel, gradientDescent, PixelCoord, pixelToLngLat } from './geo_util'

const options: MapboxOptions = {
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
  container: 'mapbox-map',
  style: 'mapbox://styles/sw1227/ckqyzf3tm1s0v17rv3rnaxgxm',
  localIdeographFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif",
  center: [139.7, 35.7],
  zoom: 12
}

const useMapboxMap = (options: MapboxOptions) => {
  const [map, setMap] = useState<mapboxgl.Map>()

  // Create a map instance on initial render
  useEffect(() => {
    const map = new mapboxgl.Map(options)

    // Add click event listener to the map
    map.on('click', async (e) => {

      // Add a marker to the map, indicating the clicked location
      const marker = new mapboxgl.Marker()
        .setLngLat(e.lngLat)
        .addTo(map);

      // Start gradient descent
      const zoom = 13
      const epsilon = 0.3
      const maxStep = 10
      let position: PixelCoord = lngLatToPixel(e.lngLat, zoom)
      const locationHistory: PixelCoord[] = [{ ...position }]
      for (let i = 0; i < maxStep; i++) {
        position = await gradientDescent(position, epsilon)
        locationHistory.push({ ...position })
      }

      console.log('TODO: ', locationHistory)
      // Create markers for each location in the location history
      locationHistory.map(p => {
        const lngLat = pixelToLngLat(p)
        const marker = new mapboxgl.Marker()
          .setLngLat(lngLat)
          .addTo(map);
      })
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
