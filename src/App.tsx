import { useEffect, useState, useRef } from 'react'
import mapboxgl, { MapboxOptions } from 'mapbox-gl'
import { IconButton } from '@chakra-ui/react'
import { Icon } from '@chakra-ui/react'
import { FaPlay } from 'react-icons/fa'
import './App.css'
import { LngLat, GradientDescentExecutor } from './geo_util'

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
  epsilon: 1,
  maxStep: 500,
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
      map.setTerrain({ source: sourceId, exaggeration: 1.5 })
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
    // Add or update GeoJSON source
    const sourceId = `trajectories-source`
    const source = map?.getSource(sourceId);
    if (!source) {
      map?.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: trajectories.map(traj => ({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: traj.history.map(lngLat => [lngLat.lng, lngLat.lat]),
            },
            properties: {
              id: traj.id,
            },
          }))
        }
      })
    } else {
      if (source.type !== 'geojson') return;
      source.setData({
        type: 'FeatureCollection',
        features: trajectories.map(traj => ({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: traj.history.map(lngLat => [lngLat.lng, lngLat.lat]),
          },
          properties: {
            id: traj.id,
          },
        }))
      })
    }
    // Add layer if not exists
    const layerId = `trajectories-layer`
    const layer = map?.getLayer(layerId)
    if (!layer) {
      map?.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#ff0000',
          'line-width': 5,
          'line-opacity': 0.8,
        },
      })
    }
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
