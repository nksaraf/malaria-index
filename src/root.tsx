import { createEffect } from "solid-js";
import { isServer } from "solid-js/web";
import {
  Body,
  FileRoutes,
  Head,
  Html,
  Routes,
  Scripts,
  Style,
} from "solid-start";
import { HttpHeader, useRequest } from "solid-start/server";
import { Report } from "./Report";
import "./root.css";

export default function Root() {
  createEffect(() => {
    const initialize = (mapid) => {
      // Get a reference to the placeholder DOM element to contain the map.
      const mapContainerEl = document.getElementById("map-container");

      // Create an interactive map inside the placeholder DOM element.
      const embeddedMap = new google.maps.Map(mapContainerEl, {
        // Pan and zoom initial map viewport to Grand Canyon.
        // center at lat long for New Delhi
        center: { lat: 28.6139, lng: 77.209 },
        zoom: 9,
      });
      embeddedMap.addListener('click',(e)=>{
        console.log(e)
        fetch(`/mapid?state=Bihar&lat=${e.latLng.lat()}&lng=${e.latLng.lng()}`)
      .then((response) => response.json())
      .then((mapid) => console.log(mapid));
      })

      // Create a new tile source to fetch visible tiles on demand and displays them on the map.
      const tileSource = new ee.layers.EarthEngineTileSource({
        mapid,
      });
      const overlay = new ee.layers.ImageOverlay(tileSource);
      embeddedMap.overlayMapTypes.push(overlay);
    };

    // Fetch a valid mapid from the remote web service defined in server.js.
    fetch("/mapid?state=Bihar")
      .then((response) => response.text())
      .then((mapid) => initialize(mapid));
  });

  if (isServer) {
    const request = useRequest();
    request.responseHeaders.set("Access-Control-Allow-Origin", "*");
  }
  return (
    <Html>
      <Head>
        {/* <HttpHeader name="Access-Control-Allow-Origin" value="*" /> */}
        {/* <HttpHeader name="Access-Control-Allow-Methods" value="GET" /> */}

        <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBbM5TgyoeWwvUG5F0PGJXLR37qOzSCf7s" />
        <script src="/ee_api_js.js"></script>
      </Head>
      <Body>
        <div id="map-container"></div>
        <Routes>
          <FileRoutes />
        </Routes>
        <Scripts />
      </Body>
    </Html>
  );
}
