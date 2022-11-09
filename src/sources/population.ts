import ee from "@google/earthengine";

export default function getPopulation(date_start, date_end, geometry) {
  let imageCollection = ee.ImageCollection(
    "CIESIN/GPWv411/GPW_Population_Density"
  );
  var population = imageCollection
    .limit(1, "system:time_start", false)
    .first()
    .select("population_density")
    .clip(geometry);

  var minMax = population.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: geometry,
    scale: 30,
    maxPixels: 10e9,
    // tileScale: 16
  });

  // use unit scale to normalize the pixel values
  var normalizedPopulation = ee.ImageCollection.fromImages(
    population.bandNames().map(function (name) {
      name = ee.String(name);
      var band = population.select(name);
      return band.unitScale(
        ee.Number(minMax.get(name.cat("_min"))),
        ee.Number(minMax.get(name.cat("_max")))
      );
      // eventually multiply by 100 to get range 0-100
      //.multiply(100);
    })
  )
    .toBands()
    .rename("population_density_normalized");

  return {
    image: normalizedPopulation,
    visParams: {
      max: 1,
      min: 0,
      palette: ["ffffe7", "FFc869", "ffac1d", "e17735", "f2552c", "9f0c21"],
    },
  };
}
