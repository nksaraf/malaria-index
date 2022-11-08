import ee from "@google/earthengine";

export default function (chirps, start_date, end_date, geometry) {
  var filtered = chirps.filter(ee.Filter.date(start_date, end_date));

  var total_rainfall = filtered.reduce(ee.Reducer.sum()).clip(geometry);

  var minMax = total_rainfall.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: geometry,
    scale: 30,
    maxPixels: 10e9,
    // tileScale: 16
  });

  // use unit scale to normalize the pixel values
  var unitScale_rainfall = ee.ImageCollection.fromImages(
    total_rainfall.bandNames().map(function (name) {
      name = ee.String(name);
      var band = total_rainfall.select(name);
      return band.unitScale(
        ee.Number(minMax.get(name.cat("_min"))),
        ee.Number(minMax.get(name.cat("_max")))
      );
      // eventually multiply by 100 to get range 0-100
      //.multiply(100);
    })
  )
    .toBands()
    .rename("precipitation_sum_normazlied");

  var palette = ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"];
  var visParams = {
    min: 0,
    max: 1,
    palette: palette,
  };

  // Map.addLayer(unitScale_rainfall, visParams, 'chirps image');

  // total_rainfall = total_rainfall.addBands(unitScale_rainfall)

  return { map: unitScale_rainfall, vis: visParams };
}
