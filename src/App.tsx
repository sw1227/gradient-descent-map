import { useEffect, useState, useRef } from 'react'
import mapboxgl, { MapboxOptions } from 'mapbox-gl'
import { interpolatePlasma } from 'd3-scale-chromatic'
import { IconButton } from '@chakra-ui/react'
import { Icon } from '@chakra-ui/react'
import { FaPlay } from 'react-icons/fa'
import './App.css'
import { LngLat, GradientDescentExecutor } from './geo_util'
import { createColorStopsFromInterpolateFunc } from './color_util'

const options: MapboxOptions = {
  accessToken: import.meta.env.VITE_MAPBOX_TOKEN,
  container: 'mapbox-map',
  style: 'mapbox://styles/sw1227/ckqyzf3tm1s0v17rv3rnaxgxm',
  localIdeographFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif",
  center: [138.731, 35.363],
  zoom: 12
}

// Gradient descent options
const gradientDescentOptions = {
  zoom: 15,
  epsilon: 0.5,
  maxStep: 1000,
}

type Trajectory = {
  id: string
  start: LngLat
  history: LngLat[]
}

function App() {
  const [map, setMap] = useState<mapboxgl.Map>()

  const [running, setRunning] = useState(false)
  const [trajectories, setTrajectories] = useState<Trajectory[]>([])
  const trajectoriesRef = useRef(trajectories)
  // Update ref to the latest trajectories value
  useEffect(() => {
    trajectoriesRef.current = trajectories;
  }, [trajectories])

  // Initialize map on initial render
  useEffect(() => {
    const map = new mapboxgl.Map(options)
    map.on('load', () => {
      // Add terrain layer
      const sourceId = `mapbox-terrain-source`
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 13,
        })
      }
      map.setTerrain({ source: sourceId, exaggeration: 1 })
    })
    // // Add click event listener to the map
    map.on('click', (e) => {
      setTrajectories([
        ...trajectoriesRef.current,
        {
          id: trajectoriesRef.current.length.toString(), // '0', '1', '2', ...
          start: e.lngLat,
          history: [e.lngLat],
        }
      ])
      // Add a marker to the map, indicating the clicked location
      const marker = new mapboxgl.Marker()
        .setLngLat(e.lngLat)
        .addTo(map);
    })
    setMap(map)
  }, [])

  // Update trajectory layer on trajectories change
  useEffect(() => {
    trajectories.forEach(traj => {
      // Add or update GeoJSON source
      const sourceId = `trajectory-source-${traj.id}`
      const source = map?.getSource(sourceId);
      const geoJsonData: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: traj.history.slice(0, traj.history.length - 1).map((pos, i) => ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[pos.lng, pos.lat], [traj.history[i + 1]?.lng, traj.history[i + 1]?.lat]],
          },
          properties: {
            id: traj.id,
            idx: i,
            idx_rate: i / traj.history.length,
          },
        })),
      }
      if (!source) {
        map?.addSource(sourceId, { type: 'geojson', data: geoJsonData})
      } else {
        if (source.type !== 'geojson') return;
        source.setData(geoJsonData)
      }

      // Add layer if not exists
      const layerId = `trajectory-layer-${traj.id}`
      const layer = map?.getLayer(layerId)
      if (!layer) {
        const colorStops = createColorStopsFromInterpolateFunc(interpolatePlasma, 1, true)
        map?.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-width': 5,
            'line-opacity': 0.8,
            'line-color': [
              'interpolate-hcl',
              ['linear'],
              ['get', 'idx_rate'],
              ...colorStops,
            ],
          },
        })
      }
    })
  }, [trajectories])

  const handlePlay = async () => {
    if(trajectories.length < 1 || !map) return

    const execute = async (trajectory: Trajectory) => {
      const executor = new GradientDescentExecutor(
        trajectory.history[trajectory.history.length - 1], // Continue from the last position
        gradientDescentOptions,
        pos => {
          setTrajectories(prevTrajectories => prevTrajectories.map(traj => {
            if (traj.id === trajectory.id) {
              return {
                ...traj,
                history: [...traj.history, pos]
              }
            }
            return traj
          }))
        },
      )

      for (let i = 0; i < gradientDescentOptions.maxStep; i++) {
        await executor.step()
      }
    }

    // Start gradient descent
    setRunning(true)
    await Promise.all(trajectories.map(traj => execute(traj)))
    setRunning(false)
  }

  return (
    <div>
      <IconButton
        aria-label='play-button'
        icon={<Icon as={FaPlay} />}
        isDisabled={!map || trajectories.length < 1 || running}
        isLoading={running}
        onClick={handlePlay}
        position='absolute'
        boxShadow='md'
        isRound={true}
        colorScheme='teal'
        bottom='8'
        right='4'
        zIndex={2}
      />
      <div id="mapbox-map" />
    </div>
  )
}

export default App
