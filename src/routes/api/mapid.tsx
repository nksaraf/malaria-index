/**
 * Bad:
 *  * IDE Sucks
 *  * No Types information for SDK
 *  * Going from web editor to localhost is not easy, have to change all require/imports
 *  * Uses a lot of old javascript paradigms, like callbacks instead of promises
 *
 * Good:
 *  * Computationally efficient
 *  * Compute graph is created while calling functions, then sent to server and evaluated all together and send map-id to client
 *  * Caching amongst users
 *
 */

import { json, APIEvent } from "solid-start";
import ee from "@google/earthengine";
import getRainfall from "~/sources/rainfall";
import getNDVI from "~/sources/ndvi";
import getPopulation from "~/sources/population";
import getSurfaceTemperature from "~/sources/surface-temperature";
import getLandUse from "~/sources/land-use";

export async function GET(state: APIEvent) {
  try {
    var location = new URL(state.request.url);
    var date_end = ee.Date(Date.now());
    var date_start = date_end.advance(-6, "months");

    var stateGeometry = ee
      .FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level2")
      .filter(ee.Filter.eq("ADM1_NAME", location.searchParams.get("state")));

    var { image: rainfall } = getRainfall(date_start, date_end, stateGeometry);

    let { image: ndvi } = getNDVI(date_start, date_end, stateGeometry);

    let { image: population } = getPopulation(
      date_start,
      date_end,
      stateGeometry
    );

    const { image: surfaceTemperature } = getSurfaceTemperature(
      date_start,
      date_end,
      stateGeometry
    );
    const { image: landUse } = getLandUse(date_start, date_end, stateGeometry);
    var radius = 2;

    var malaria_index = surfaceTemperature
      .add(landUse)
      .add(rainfall)
      .add(ndvi)
      .add(population)
      .reduceNeighborhood({
        reducer: ee.Reducer.mean(),
        kernel: ee.Kernel.square({
          radius: radius,
          units: "pixels",
          normalize: false,
        }),
      })
      .rename("malariaIndex");
    var percetile_index = malaria_index.reduceRegion(
      ee.Reducer.percentile([1, 99]),
      stateGeometry,
      5000
    );

    console.log(percetile_index);

    var min_index = ee.Number(percetile_index.get("malariaIndex_p1"));
    var max_index = ee.Number(percetile_index.get("malariaIndex_p99"));

    malaria_index = malaria_index
      .select("malariaIndex")
      .interpolate([min_index, max_index], [0, 1], "clamp");
    // const {min:v1, max:v2, palette:cmap1}
    var cmap1 = ["blue", "cyan", "green", "yellow", "red"];
    if (location.searchParams.has("lat")) {
      var lat = location.searchParams.get("lat");
      var lng = location.searchParams.get("lng");
      var point = ee.Geometry.Point([Number(lng), Number(lat)]);

      const dict = ee.Dictionary();

      dict.set(
        "LSTValue",
        surfaceTemperature
          .select("LST")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("LST")
      );
      dict.set(
        "NDVIValue",
        ndvi

          .select("ndvi")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("ndvi")
      );
      dict.set(
        "RainfallValue",
        rainfall

          .select("precipitation_sum_normazlied")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("precipitation_sum_normazlied")
      );
      dict.set(
        "PopulationValue",
        population
          .select("population_density_normalized")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("population_density_normalized")
      );
      dict.set(
        "LandUseValue",
        landUse
          .select("remapped")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("remapped")
      );
      dict.set(
        "MalariaIndexValue",
        malaria_index
          .select("malariaIndex")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("malariaIndex")
      );

      const LSTValuePromise = new Promise((resolve) =>
        surfaceTemperature
          .select("LST")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("LST")
          .evaluate(function (v) {
            resolve(v);
          })
      );
      const rainfallValuePromise = new Promise((resolve) =>
        rainfall
          .select("precipitation_sum_normazlied")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("precipitation_sum_normazlied")
          .evaluate(function (v) {
            resolve(v);
          })
      );
      const ndviValuPromisee = new Promise((resolve) =>
        ndvi
          .select("ndvi")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("ndvi")
          .evaluate(function (v) {
            resolve(v);
          })
      );
      const populationValuePromise = new Promise((resolve) =>
        population
          .select("population_density_normalized")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("population_density_normalized")
          .evaluate(function (v) {
            resolve(v);
          })
      );
      const canopyCoverPromise = new Promise((resolve) =>
        landUse
          .select("remapped")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("remapped")
          .evaluate(function (v) {
            resolve(v);
          })
      );
      const malariaIndexValuePromise = new Promise((resolve) =>
        malaria_index
          .select("malariaIndex")
          .reduceRegion(ee.Reducer.first(), point, 10)
          .get("malariaIndex")
          .evaluate(function (v) {
            resolve(v);
          })
      );

      const [
        LSTValue,
        rainfallValue,
        ndviValue,
        populationValue,
        canopyCoverValue,
        malariaIndexValue,
      ] = await Promise.all([
        LSTValuePromise,
        rainfallValuePromise,
        ndviValuPromisee,
        populationValuePromise,
        canopyCoverPromise,
        malariaIndexValuePromise,
      ]);
      var data = {
        LSTValue: LSTValue,
        rainfallValue: rainfallValue,
        ndviValue: ndviValue,
        populationValue: populationValue,
        canopyCoverValue: canopyCoverValue,
        malariaIndexValue: malariaIndexValue,
      };
      // var data = await new Promise((resolve) => dict.getInfo(resolve));
      // console.log(data);
      return json(data);
    } else {
      const mapid: string = await new Promise((resolve) =>
        malaria_index.getMap(
          { min: 0, max: 1, palette: cmap1 },
          function (ob, error) {
            console.log(arguments);
            resolve(ob.mapid);
          }
        )
      );
      console.log(mapid);
      return new Response(mapid);
    }
  } catch (e) {
    console.log(e);
  }
}
