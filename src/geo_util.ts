import { LRUCache } from 'lru-cache'

// Tile: 256 x 256 pixels
export const tileSize = 256

export type LngLat = {
  lng: number
  lat: number
}

export type PixelCoord = {
  x: number
  y: number
  z: number
}

export type TileCoord = {
  z: number
  x: number
  y: number
}

export const deg2rad = (deg: number): number => {
  return Math.PI / 180 * deg
}
export const rad2deg = (rad: number): number => {
  return 180 / Math.PI * rad
}

// Normalize longitude to [-180, +180)
export const normalizeLongitude = (deg: number): number => {
  return deg - 360 * Math.floor((deg + 180) / 360)
}

// Convert pixel coordinate at specific zoom level to lnglat
export function pixelToLngLat(pixel: PixelCoord): LngLat {
  const L = 85.05112878
  const lat = rad2deg(Math.asin(Math.tanh(
    -(Math.PI * pixel.y / (1 << (pixel.z + 7))) + Math.atanh(Math.sin(deg2rad(L)))
  )))
  const lng = 180 * (pixel.x / (1 << (pixel.z + 7)) - 1)
  return {
    lng: normalizeLongitude(lng),
    lat,
  }
}

// Convert lnglat to pixel coordinate at specific zoom level
export const lngLatToPixel = (center: LngLat, zoom: number): PixelCoord => {
  const L = 85.05112878

  const lng = normalizeLongitude(center.lng)
  const x = (1 << (zoom + 7)) * (lng / 180 + 1)
  const y = (1 << (zoom + 7)) / Math.PI * (
    -Math.atanh(Math.sin(deg2rad(center.lat))) + Math.atanh(Math.sin(deg2rad(L)))
  )

  return { x: Math.round(x), y: Math.round(y), z: zoom }
}

// Get tile coordinate which contains given pixel coordinate
// (zoom level of returned tile coordinate is same as given pixel coordinate)
export const getTileCoordFromPixel = (pixel: PixelCoord): TileCoord => {
  return {
    z: pixel.z,
    x: Math.floor(pixel.x / tileSize),
    y: Math.floor(pixel.y / tileSize),
  }
}

// Get pixel position in tile which contains given pixel coordinate
export const getPixelInTile = (pixel: PixelCoord): { x: number, y: number } => {
  return {
    x: pixel.x % tileSize,
    y: pixel.y % tileSize
  }
}

type TileCache = LRUCache<string, number[][]>
const fetchTile = async (tileCoord: TileCoord, tileCache?: TileCache): Promise<number[][]> => {
  if (tileCoord.z < 1 || tileCoord.z > 15) {
    throw new Error('Invalid zoom level')
  }
  const url = `https://cyberjapandata.gsi.go.jp/xyz/dem5a/${tileCoord.z}/${tileCoord.x}/${tileCoord.y}.txt`

  const cached = tileCache?.get(url)
  if (cached) return cached

  const text = await fetch(url).then(res => res.text());
  const rows = text.split('\n')
  const tile = rows
    .slice(0, rows.length - 1) // last row is empty
    .map(r => r.split(',').map(d => d === 'e' ? 0 : parseFloat(d))) // e: sea

  tileCache?.set(url, tile)
  return tile
}

// Get elevation at given pixel coordinate
export const getElevation = async (pixelCoord: PixelCoord, tileCache?: TileCache): Promise<number> => {
  const tileCoord = getTileCoordFromPixel(pixelCoord)
  const tile = await fetchTile(tileCoord, tileCache)
  const { x, y } = getPixelInTile(pixelCoord)
  return tile[y][x]
}

// Unit: [meter / pixel]
type Gradient = {
  dx: number
  dy: number
}
// Get gradient at given pixel coordinate
export const getGradient = async (pixelCoord: PixelCoord, tileCache?: TileCache): Promise<Gradient> => {

  const fx = Math.floor(pixelCoord.x)
  const fy = Math.floor(pixelCoord.y)

  if ((pixelCoord.x - fx) + (pixelCoord.y - fy) < 1) {
    try {
      const [nwElev, neElev, swElev] = await Promise.all([
        getElevation({ x: fx, y: fy, z: pixelCoord.z }, tileCache),
        getElevation({ x: fx + 1, y: fy, z: pixelCoord.z }, tileCache),
        getElevation({ x: fx, y: fy + 1, z: pixelCoord.z }, tileCache),
      ])
      return {
        dx: neElev - nwElev,
        dy: swElev - nwElev,
      }
    } catch (e) {
      console.error(e)
      return { dx: 0, dy: 0 }
    }
  } else {
    try {
      const [neElev, swElev, seElev] = await Promise.all([
        getElevation({ x: fx + 1, y: fy, z: pixelCoord.z }, tileCache),
        getElevation({ x: fx, y: fy + 1, z: pixelCoord.z }, tileCache),
        getElevation({ x: fx + 1, y: fy + 1, z: pixelCoord.z }, tileCache),
      ])
      return {
        dx: seElev - swElev,
        dy: seElev - neElev,
      }
    } catch (e) {
      console.error(e)
      return { dx: 0, dy: 0 }
    }
  }
};

// Get next pixel coordinate by gradient descent
export const gradientDescent = async (startPixel: PixelCoord, epsilon: number, tileCache?: TileCache): Promise<PixelCoord> => {
  const gradient = await getGradient(startPixel, tileCache)
  const nextPixel = {
    x: startPixel.x - epsilon * gradient.dx,
    y: startPixel.y - epsilon * gradient.dy,
    z: startPixel.z,
  }
  return nextPixel
};

// Execute gradient descent

export class GradientDescentExecutor {
  private currentPixel: PixelCoord // Internally, this class holds current position in pixel coordinate
  private callback: (pos: LngLat) => void // called with the new position when each step is finished
  private options: {
    epsilon: number
    zoom: number
  }
  private tileCache: LRUCache<string, number[][]>

  constructor(
    start: LngLat,
    options: { epsilon: number; zoom: number },
    callback: (pos: LngLat) => void,
  ) {
    this.currentPixel = lngLatToPixel(start, options.zoom)
    this.options = options
    this.callback = callback
    this.tileCache = new LRUCache<string, number[][]>({ max: 1000 })
  }

  async step() {
    // Update position by gradient descent
    this.currentPixel = await gradientDescent(this.currentPixel, this.options.epsilon, this.tileCache)
    // Call callback function with new position (in lnglat)
    const lngLat = pixelToLngLat(this.currentPixel)
    this.callback(lngLat)
  }
}
