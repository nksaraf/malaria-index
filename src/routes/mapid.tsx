/**
 * Bad:
 *  * IDE Sucks
 *  * No Types information for SDK
 *
 * Good:
 *  * Computationally efficient
 *  * Compute graph is created while calling functions, then sent to server and evaluated all together and send map-id to client
 *  * Caching amongst users
 *
 */

import { json } from "solid-start";
import ee from "@google/earthengine";
import privateKey from "../../ee-nsaraf-8e47e743c021.json";
import collection from "../module/Landsat_LST";
import rainfall from "../module/chirps";
import getNDVI from "../module/NDVI";
import getPopulation from "../module/population";
import getWorldCover from "../module/worldCover";

console.log("Authenticating Earth Engine API using private key...");
ee.data.authenticateViaPrivateKey(
  privateKey,
  () => {
    console.log("Authentication successful.");
    ee.initialize(
      null,
      null,
      () => {
        console.log("Earth Engine client library initialized.");
      },
      (err) => {
        console.log(err);
        console.log(
          `Please make sure you have created a service account and have been approved.
Visit https://developers.google.com/earth-engine/service_account#how-do-i-create-a-service-account to learn more.`
        );
      }
    );
  },
  (err) => {
    console.log(err);
  }
);

function LST(date_start, date_end, geometry) {
  var satellite = "L8";
  var use_ndvi = false;

  // get landsat collection with added variables: NDVI, FVC, TPW, EM, LST
  var LandsatColl = collection(
    satellite,
    date_start,
    date_end,
    geometry,
    use_ndvi
  );

  // select the first feature
  var LandSurfaceTempreture = LandsatColl.mean().clip(geometry);
  var LandSurfaceTempretureNormazlied = LandSurfaceTempreture.select(
    "LST"
  ).interpolate([265, 320], [0, 1], "clamp");
  // LandSurfaceTempreture = LandSurfaceTempreture.addBands(
  //   LandSurfaceTempretureNormazlied.rename("LSTNormalized")
  // );

  var cmap1 = ["blue", "cyan", "green", "yellow", "red"];

  // Map.centerObject(geometry)
  // Map.addLayer(LandSurfaceTempretureNormazlied.select('LST'), {min:0, max:1, palette:cmap1}, 'Land Surface Tempreture')

  return LandSurfaceTempretureNormazlied;
}

export async function GET() {
  /**** Start of imports. If edited, may not auto-convert in the playground. ****/
  try {
    var date_end = ee.Date("2022-08-21");
    var date_start = date_end.advance(-6, "months");
    var populationLayer = ee.ImageCollection(
        "CIESIN/GPWv411/GPW_Population_Density"
      ),
      worldCover = ee.ImageCollection("ESA/WorldCover/v100"),
      chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/PENTAD");
    var s2 = ee.ImageCollection("COPERNICUS/S2");

    var l8 = ee.ImageCollection("LANDSAT/LC08/C02/T1_RT_TOA");
    /***** End of imports. If edited, may not auto-convert in the playground. *****/

    var admin2 = ee.FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level2");

    var geometry = admin2.filter(ee.Filter.eq("ADM1_NAME", "Delhi"));

    var { map: chirps } = rainfall(chirps, date_start, date_end, geometry);

    let { map: ndvi } = getNDVI(s2, date_start, date_end, geometry);

    let { map: population } = getPopulation(
      populationLayer,
      // date_start,
      // date_end,
      geometry
    );

    const a = LST(date_start, date_end, geometry);
    const { map: coverMap } = getWorldCover(worldCover, geometry);
    // Map.centerObject(geometry)
    // Import the Landsat 8 TOA image collection.

    // Get the least cloudy image in 2015.
    var image = l8
      .filterBounds(geometry)
      .filterDate("2015-12-01", "2017-12-15")
      .sort("CLOUD_COVER");

    image = image.mosaic().clip(geometry);

    var nir = image.select("B5");
    var red = image.select("B4");
    // var ndvi = nir.subtract(red).divide(nir.add(red)).rename("NDVI");

    // Display the result.
    //Map.centerObject(image, 9);

    var malaria_index = a.add(coverMap).add(chirps).add(ndvi).add(population);
    var percetile_index = malaria_index.reduceRegion(
      ee.Reducer.percentile([10, 90]),
      geometry,
      5000
    );
    var min_index = ee.Number(percetile_index.get("Malria Index_mean_p10"));
    var max_index = ee.Number(percetile_index.get("Malria Index_mean_p90"));
    var hotspotThreshold = ee.Number(
      percetile_index.get("Malria Index_mean_p90")
    );
    // const {min:v1, max:v2, palette:cmap1}
    var cmap1 = ["blue", "cyan", "green", "yellow", "red"];
    console.log(coverMap);
    const map = await new Promise((resolve) =>
      malaria_index.getMap(
        { min: 1.1, max: 2.2, palette: cmap1 },
        ({ mapid }) => resolve(mapid)
      )
    );
    console.log(map);
    return new Response(map);
  } catch (e) {
    console.log(e);
  }
}
