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
export function pixelToLngLat (pixel: PixelCoord): LngLat {
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
