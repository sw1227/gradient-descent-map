import { useEffect } from 'react'
import mapboxgl, { MapboxOptions } from 'mapbox-gl'
import './App.css'

const options: MapboxOptions = {
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
  container: 'mapbox-map',
  style: 'mapbox://styles/mapbox/light-v10',
  center: [139.7, 35.7],
  zoom: 12
}

function App() {
  useEffect(() => {
    const map = new mapboxgl.Map(options)
  }, [])

  return (
    <div>
      <div id="mapbox-map" />
    </div>
  )
}

export default App
