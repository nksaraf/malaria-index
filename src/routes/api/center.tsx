import { APIEvent, json } from "solid-start";
import eePromise from "../../ee";
export async function GET(event: APIEvent) {
  try {
    let ee = await eePromise;
    var location = new URL(event.request.url);
    var stateGeometry = ee
      .FeatureCollection("FAO/GAUL_SIMPLIFIED_500m/2015/level2")
      .filter(ee.Filter.eq("ADM1_NAME", location.searchParams.get("state")));

    return json(
      await new Promise((resolve) =>
        stateGeometry.geometry().centroid().evaluate(resolve)
      )
    );
  } catch (e) {
    console.log(e);
  }
}
