import ee from "@google/earthengine";

export default function getRainfall(
  start_date: ee.Date,
  end_date: ee.Date,
  geometry: ee.Geometry
) {
  var chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/PENTAD");

  var filteredByDate = chirps.filter(ee.Filter.date(start_date, end_date));

  var totalRainfall = filteredByDate.reduce(ee.Reducer.sum()).clip(geometry);

  var minMax = totalRainfall.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: geometry,
    scale: 30,
    maxPixels: 10e9,
    // tileScale: 16
  });

  // use unit scale to normalize the pixel values
  var normalizedRainfall = ee.ImageCollection.fromImages(
    totalRainfall.bandNames().map(function (name) {
      name = ee.String(name);
      var band = totalRainfall.select(name);
      return band.unitScale(
        ee.Number(minMax.get(name.cat("_min"))),
        ee.Number(minMax.get(name.cat("_max")))
      );
    })
  )
    .toBands()
    .rename("precipitation_sum_normazlied");

  return {
    image: normalizedRainfall,
    visParams: {
      min: 0,
      max: 1,
      palette: ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"],
    },
  };
}
