import { Suspense } from "solid-js";
import { Body, FileRoutes, Head, Html, Routes, Scripts } from "solid-start";
import "./root.css";

export default function Root() {
  return (
    <Html>
      <Head>
        <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBbM5TgyoeWwvUG5F0PGJXLR37qOzSCf7s" />
        <script src="/ee_api_js.js"></script>
      </Head>
      <Body>
        <div id="map-container"></div>
        <Suspense>
          <Routes>
            <FileRoutes />
          </Routes>
        </Suspense>
        <Scripts />
      </Body>
    </Html>
  );
}
