import ee from "@google/earthengine";

export default function getNDVI(
  date_start: ee.Date,
  date_end: ee.Date,
  geometry: ee.Geometry
) {
  var s2 = ee.ImageCollection("COPERNICUS/S2");

  //var s2 = ee.ImageCollection("COPERNICUS/S2");

  //var admin2 = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level2");
  //var geometry = admin2.filter(ee.Filter.eq('ADM1_NAME', 'Karnataka'))

  function maskS2clouds(image) {
    var qa = image.select("QA60");
    var cloudBitMask = 1 << 10;
    var cirrusBitMask = 1 << 11;
    var mask = qa
      .bitwiseAnd(cloudBitMask)
      .eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
    return image
      .updateMask(mask)
      .divide(10000)
      .select("B.*")
      .copyProperties(image, ["system:time_start"]);
  }

  var filtered = s2
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 30))
    .filter(ee.Filter.date(date_start, date_end))
    .filter(ee.Filter.bounds(geometry))
    .map(maskS2clouds);

  var image = filtered.median();

  // Calculate  Normalized Difference Vegetation Index (NDVI)
  // 'NIR' (B8) and 'RED' (B4)
  var ndvi = image.normalizedDifference(["B8", "B4"]).rename(["ndvi"]);

  return {
    image: ndvi,
    visParams: { min: 0, max: 1, palette: ["white", "green"] },
  };
}
