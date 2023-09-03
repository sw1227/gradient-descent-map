import { color } from 'd3-color'

// Create color stops for Mapbox interpolate expression, based on the given interpolators of d3-scheme-chromatic
// https://docs.mapbox.com/mapbox-gl-js/style-spec/expressions/#interpolate-hcl
export const createColorStopsFromInterpolateFunc = (
  colorInterpolateFunc: (t: number) => string,
  maxValue = 1,
  reversed = false,
): (string | number)[] => {
  const nStops = 11;
  return [...Array(nStops).keys()]
    .map(i =>
      [
        maxValue * i / (nStops - 1),
        reversed
          ? color(colorInterpolateFunc(1 - i / 10))!.formatHex()
          : color(colorInterpolateFunc(i / 10))!.formatHex()
      ]
    )
    .flat()
}
