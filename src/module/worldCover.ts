export default function (worldCover, geometry) {
  var cmap1 = ["blue", "cyan", "green", "yellow", "red"];

  var cover = worldCover.first().clip(geometry);

  var coverRemapped = cover.remap(
    [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100],
    [0.4, 0.5, 0.6, 0.7, 0.2, 0.3, 0.1, 0.0, 0.9, 1.0, 0.8]
  );
  // cover = cover.addBands(coverRemapped.rename("Remapped"));

  // Map.centerObject(geometry);

  // Map.addLayer(
  //   coverRemapped,
  //   { min: 0, max: 1, palette: cmap1 },
  //   "Land Cover Land Use"
  // );

  return { map: coverRemapped, vis: { min: 0, max: 1, palette: cmap1 } };
}
