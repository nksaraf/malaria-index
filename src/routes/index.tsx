import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  onCleanup,
  Show,
  Suspense,
} from "solid-js";
import { isServer } from "solid-js/web";
import server$ from "solid-start/server";

declare global {
  var google;
  var ee;
}

export default function Report() {
  const [stateName, setStateName] = createSignal("Delhi");
  const [center] = createResource(stateName, async (stateName) => {
    let response = await server$.fetch(`/api/center?state=${stateName}`);
    let json = await response.json();
    return json;
  });
  const [selectedLocation, setSelectedLocation] = createSignal(null);

  createEffect(() => {
    if (selectedLocation()) {
      const marker = new google.maps.Marker({
        position: selectedLocation(),
        map: embeddedMap(),
      });

      onCleanup(() => {
        marker.setMap(null);
      });
    }
  });

  const embeddedMap = createMemo(() => {
    if (!center() || isServer) {
      return;
    }

    // Get a reference to the placeholder DOM element to contain the map.
    const mapContainerEl = document.getElementById("map-container");

    console.log(center());

    // Create an interactive map inside the placeholder DOM element.
    const embeddedMap = new google.maps.Map(mapContainerEl, {
      // Pan and zoom initial map viewport to Grand Canyon.
      // center at lat long for New Delhi
      center: { lat: center().coordinates[1], lng: center().coordinates[0] },
      zoom: 9,
    });

    embeddedMap.addListener("click", (e) => {
      console.log(e);
      setSelectedLocation(e.latLng);
    });
    return embeddedMap;
  });

  const [selectedData] = createResource(selectedLocation, async (location) => {
    if (!location) {
      return;
    }
    let response = await server$.fetch(
      `/api/mapid?state=${stateName()}&lat=${location.lat()}&lng=${location.lng()}`
    );
    let json = await response.json();
    return json;
  });

  createEffect(() => {
    if (!embeddedMap()) {
      return;
    }

    const initialize = (mapid) => {
      // Create a new tile source to fetch visible tiles on demand and displays them on the map.
      const tileSource = new ee.layers.EarthEngineTileSource({
        mapid,
      });
      const overlay = new ee.layers.ImageOverlay(tileSource);
      embeddedMap().overlayMapTypes.push(overlay);
    };

    // Fetch a valid mapid from the remote web service defined in server.js.
    fetch(`/api/mapid?state=${stateName()}`)
      .then((response) => response.text())
      .then((mapid) => initialize(mapid));
  });

  const [address] = createResource(selectedLocation, async (location) => {
    if (!location) {
      return;
    }
    let s = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat()},${location.lng()}&key=AIzaSyBbM5TgyoeWwvUG5F0PGJXLR37qOzSCf7s`
    );

    let json = await s.json();
    let components = json.results[0].address_components.filter((component) => {
      return component.types.includes("political");
    });

    return components
      .reverse()
      .slice(0, 3)
      .reverse()
      .map((i) => i.short_name)
      .join(", ");
  });
  return (
    <>
      <div class="fixed top-24 left-4 w-[320px]">
        <div class="w-full py-2 rounded-b-none rounded-md text-center flex items-center justify-center bg-opacity-80 bg-red-600 shadow-lg text-red-50 font-bold text-xl">
          <div>Malaria Risk Index (MRI)</div>
        </div>
        <div>
          <Suspense>
            <div class="w-full bg-white pt-3 text-center flex items-center justify-center bg-opacity-90  rounded-t-none shadow-lg text-slate-500  font-bold text-lg">
              {address()}
            </div>
          </Suspense>
          <Suspense
            fallback={
              <div class="w-full bg-white py-3 rounded-md text-center flex items-center justify-center bg-opacity-90  rounded-t-none shadow-lg  font-bold text-2xl">
                <div class="flex items-center flex-row w-full px-4 space-x-2">
                  <img src="/malaria.png" width={32} height={32} />
                  <div class="flex-1 h-4 rounded-md bg-gray-700 animate-pulse relative"></div>
                  <img src="/malaria_many.png" width={32} height={32} />
                </div>
              </div>
            }
          >
            <Show when={selectedData()}>
              <>
                <div class="w-full rounded-t-none bg-white py-3 rounded-md text-center flex items-center justify-center bg-opacity-90  shadow-lg  font-bold text-lg">
                  <div class="flex items-center flex-row w-full px-4 space-x-2">
                    <img src="/malaria.png" width={32} height={32} />
                    <div class="flex-1 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 h-4 rounded-md relative">
                      <div
                        class="absolute bg-white h-7 -top-[35%] w-3 rounded-lg border-[3px] border-black"
                        style={`left: ${Math.round(
                          selectedData().malariaIndexValue * 100
                        )}%`}
                      ></div>
                    </div>
                    <img src="/malaria_many.png" width={32} height={32} />
                  </div>
                </div>
              </>
              <div class="w-full mt-4 bg-white py-3 rounded-md text-center flex flex-col space-y-6 bg-opacity-90  shadow-lg  font-bold text-2xl">
                <div>
                  <div class="text-sm text-slate-400">Vegetation</div>
                  <div class="flex items-center flex-row w-full px-5 space-x-3">
                    <img src="/water.png" width={24} height={24} />
                    <div class="flex-1 bg-gradient-to-r from-emerald-100 via-emerald-400 to-emerald-900 h-3 rounded-md relative">
                      <div
                        class="absolute bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"
                        style={`left: ${
                          Math.round(selectedData().ndviValue * 50) + 50
                        }%`}
                      ></div>
                    </div>
                    <img src="/trees.png" width={24} height={24} />
                  </div>
                </div>

                <div>
                  <div class="text-sm text-slate-400">Population</div>

                  <div class="flex items-center flex-row w-full px-5 space-x-3">
                    <img src="/person.png" width={24} height={24} />
                    <div class="flex-1 bg-gradient-to-r from-amber-100 via-amber-400 to-amber-900 h-3 rounded-md relative">
                      <div
                        class="absolute bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"
                        style={`left: ${Math.round(
                          selectedData().populationValue * 100
                        )}%`}
                      ></div>
                    </div>
                    <img src="/people.png" width={24} height={24} />
                  </div>
                </div>
                <div>
                  <div class="text-sm text-slate-400">Rainfall</div>
                  <div class="flex items-center flex-row w-full px-5 space-x-3">
                    <img src="/desert.png" width={24} height={24} />
                    <div class="flex-1 bg-gradient-to-r from-cyan-100 via-cyan-500 to-cyan-900 h-3 rounded-md relative">
                      <div
                        class="absolute bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"
                        style={`left: ${Math.round(
                          selectedData().rainfallValue * 100
                        )}%`}
                      ></div>
                    </div>
                    <img src="/rain.png" width={24} height={24} />
                  </div>
                </div>
                <div>
                  <div class="text-sm text-slate-400">Surface Temperature</div>
                  <div class="flex items-center flex-row w-full px-5 space-x-3">
                    <img src="/cold.png" width={24} height={24} />
                    <div class="flex-1 bg-gradient-to-r from-blue-500 via-yellow-500 to-red-500 h-3 rounded-md relative">
                      <div
                        class="absolute bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"
                        style={`left: ${Math.round(
                          selectedData().LSTValue * 100
                        )}%`}
                      ></div>
                    </div>
                    <img src="/hot.png" width={24} height={24} />
                  </div>
                </div>
                <div>
                  <div class="text-sm text-slate-400">Canopy Cover</div>
                  <div class="flex items-center flex-row w-full px-5 space-x-3">
                    <img src="/flat-water.png" width={24} height={24} />
                    <div class="flex-1 bg-gradient-to-r from-lime-100 via-lime-500 to-lime-900 h-3 rounded-md relative">
                      <div
                        class="absolute bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"
                        style={`left: ${Math.round(
                          selectedData().canopyCoverValue * 100
                        )}%`}
                      ></div>
                    </div>
                    <img src="/canopy.png" width={24} height={24} />
                  </div>
                </div>
              </div>
            </Show>
          </Suspense>
        </div>
      </div>
      <div class="fixed left-[50vw] -translate-x-[50%] top-4 flex flex-row space-x-2">
        <div class="bg-white border-[3px] w-[180px] shadow-lg rounded-md flex flex-row justify-center items-center">
          <select
            class="font-semibold text-lg py-1"
            onChange={(e) => {
              setSelectedLocation(null);
              setStateName(e.currentTarget.value);
            }}
            value={stateName()}
          >
            <option>Karnataka</option>
            <option>Bihar</option>
            <option>Delhi</option>
            <option>Haryana</option>
            <option>Rajasthan</option>
          </select>
        </div>
        <div class="bg-white w-[180px] border-[3px]   shadow-lg rounded-md flex flex-row justify-center items-center">
          <div class="font-semibold text-lg py-1">
            {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </>
  );
}
