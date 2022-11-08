/*
Author: Sofia Ermida (sofia.ermida@ipma.pt; @ermida_sofia)

This code is free and open. 
By using this code and any data derived with it, 
you agree to cite the following reference 
in any publications derived from them:
Ermida, S.L., Soares, P., Mantas, V., Göttsche, F.-M., Trigo, I.F., 2020. 
    Google Earth Engine open-source code for Land Surface Temperature estimation from the Landsat series.
    Remote Sensing, 12 (9), 1471; https://doi.org/10.3390/rs12091471

This function selects the Landsat data based on user inputs
and performes the LST computation

to call this function use:

var LandsatLST = './Landsat_LST.js')
var LandsatCollection = LandsatLST.collection(landsat, date_start, date_end, geometry)

USES:
    - NCEP_TPW.js
    - cloudmask.js
    - compute_NDVI.js
    - compute_FVC.js
    - compute_emissivity.js
    - SMWalgorithm.js

INPUTS:
        - landsat: <string>
                  the Landsat satellite id
                  valid inputs: 'L4', 'L5', 'L7' and 'L8'
        - date_start: <string>
                      start date of the Landsat collection
                      format: YYYY-MM-DD
        - date_end: <string>
                    end date of the Landsat collection
                    format: YYYY-MM-DD
        - geometry: <ee.Geometry>
                    region of interest
        - use_ndvi: <boolean>
                if true, NDVI values are used to obtain a
                dynamic emissivity; if false, emissivity is 
                obtained directly from ASTER
OUTPUTS:
        - <ee.ImageCollection>
          image collection with bands:
          - landsat original bands: all from SR excpet the TIR bands (from TOA) 
          - cloud masked
          - 'NDVI': normalized vegetation index
          - 'FVC': fraction of vegetation cover [0-1]
          - 'TPW': total precipitable water [mm]
          - 'EM': surface emissvity for TIR band
          - 'LST': land surface temperature
          
  14-08-2020: update to avoid using the getInfo() and if() 
    (Thanks Tyler Erickson for the suggestion)
  
  11-07-2022: update to use collection 2
*/

///////////////////////////// ATTENTION //////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
//
// As off 11.07.2022 a new version of the code is released:
//      - update to use collection 2 data
//      - emissivities of water and snow surfaces are now prescribed
//
// the previous version of the code will still be available; the replaced code
// is commented
//
//////////////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////

// MODULES DECLARATION -----------------------------------------------------------
// Total Precipitable Water
// import NCEP_TPW from "./NCEP_TPW.js";
//cloud mask
// import cloudmask from "./cloudmask.js";
// //Normalized Difference Vegetation Index
// import NDVI from "./compute_NDVI.js";
// //Fraction of Vegetation cover
// import FVC from "./compute_FVC.js";
// //surface emissivity
// import EM from "./compute_emissivity.js";
// // land surface temperature
// import LST from "./SMWalgorithm.js";
// --------------------------------------------------------------------------------

import ee from "@google/earthengine";

/* COLLECTION 1
var COLLECTION = ee.Dictionary({
  'L4': {
    'TOA': ee.ImageCollection('LANDSAT/LT04/C01/T1_TOA'),
    'SR': ee.ImageCollection('LANDSAT/LT04/C01/T1_SR'),
    'TIR': ['B6',]
  },
  'L5': {
    'TOA': ee.ImageCollection('LANDSAT/LT05/C01/T1_TOA'),
    'SR': ee.ImageCollection('LANDSAT/LT05/C01/T1_SR'),
    'TIR': ['B6',]
  },
  'L7': {
    'TOA': ee.ImageCollection('LANDSAT/LE07/C01/T1_TOA'),
    'SR': ee.ImageCollection('LANDSAT/LE07/C01/T1_SR'),
    'TIR': ['B6_VCID_1','B6_VCID_2'],
  },
  'L8': {
    'TOA': ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA'),
    'SR': ee.ImageCollection('LANDSAT/LC08/C01/T1_SR'),
    'TIR': ['B10','B11']
  }
});
*/

function addNCEPBand(image) {
  // first select the day of interest
  var date = ee.Date(image.get("system:time_start"));
  var year = ee.Number.parse(date.format("yyyy"));
  var month = ee.Number.parse(date.format("MM"));
  var day = ee.Number.parse(date.format("dd"));
  var date1 = ee.Date.fromYMD(year, month, day);
  var date2 = date1.advance(1, "days");

  // function compute the time difference from landsat image
  var datedist = function (image) {
    return image.set(
      "DateDist",
      ee.Number(image.get("system:time_start")).subtract(date.millis()).abs()
    );
  };

  // load atmospheric data collection
  var TPWcollection = ee
    .ImageCollection("NCEP_RE/surface_wv")
    .filter(
      ee.Filter.date(date1.format("yyyy-MM-dd"), date2.format("yyyy-MM-dd"))
    )
    .map(datedist);

  // select the two closest model times
  var closest = TPWcollection.sort("DateDist").toList(2);

  // check if there is atmospheric data in the wanted day
  // if not creates a TPW image with non-realistic values
  // these are then masked in the SMWalgorithm function (prevents errors)
  var tpw1 = ee.Image(
    ee.Algorithms.If(
      closest.size().eq(0),
      ee.Image.constant(-999.0),
      ee.Image(closest.get(0)).select("pr_wtr")
    )
  );
  var tpw2 = ee.Image(
    ee.Algorithms.If(
      closest.size().eq(0),
      ee.Image.constant(-999.0),
      ee.Algorithms.If(
        closest.size().eq(1),
        tpw1,
        ee.Image(closest.get(1)).select("pr_wtr")
      )
    )
  );

  var time1 = ee.Number(
    ee.Algorithms.If(
      closest.size().eq(0),
      1.0,
      ee.Number(tpw1.get("DateDist")).divide(ee.Number(21600000))
    )
  );
  var time2 = ee.Number(
    ee.Algorithms.If(
      closest.size().lt(2),
      0.0,
      ee.Number(tpw2.get("DateDist")).divide(ee.Number(21600000))
    )
  );

  var tpw = tpw1
    .expression("tpw1*time2+tpw2*time1", {
      tpw1: tpw1,
      time1: time1,
      tpw2: tpw2,
      time2: time2,
    })
    .clip(image.geometry());

  // SMW coefficients are binned by TPW values
  // find the bin of each TPW value
  var pos = tpw
    .expression(
      "value = (TPW>0 && TPW<=6) ? 0" +
        ": (TPW>6 && TPW<=12) ? 1" +
        ": (TPW>12 && TPW<=18) ? 2" +
        ": (TPW>18 && TPW<=24) ? 3" +
        ": (TPW>24 && TPW<=30) ? 4" +
        ": (TPW>30 && TPW<=36) ? 5" +
        ": (TPW>36 && TPW<=42) ? 6" +
        ": (TPW>42 && TPW<=48) ? 7" +
        ": (TPW>48 && TPW<=54) ? 8" +
        ": (TPW>54) ? 9" +
        ": 0",
      { TPW: tpw }
    )
    .clip(image.geometry());

  // add tpw to image as a band
  var withTPW = image
    .addBands(tpw.rename("TPW"), ["TPW"])
    .addBands(pos.rename("TPWpos"), ["TPWpos"]);

  return withTPW;
}

export default function (landsat, date_start, date_end, geometry, use_ndvi) {
  // get ASTER emissivity
  var aster = ee.Image("NASA/ASTER_GED/AG100_003");

  //get ASTER FVC from NDVI
  var aster_ndvi = aster.select("ndvi").multiply(0.01);

  var aster_fvc = aster_ndvi.expression(
    "((ndvi-ndvi_bg)/(ndvi_vg - ndvi_bg))**2",
    { ndvi: aster_ndvi, ndvi_bg: 0.2, ndvi_vg: 0.86 }
  );
  aster_fvc = aster_fvc.where(aster_fvc.lt(0.0), 0.0);
  aster_fvc = aster_fvc.where(aster_fvc.gt(1.0), 1.0);

  // bare ground emissivity functions for each band
  var emiss_bare_band10 = function (image) {
    return image
      .expression("(EM - 0.99*fvc)/(1.0-fvc)", {
        EM: aster.select("emissivity_band10").multiply(0.001),
        fvc: aster_fvc,
      })
      .clip(image.geometry());
  };

  var emiss_bare_band11 = function (image) {
    return image
      .expression("(EM - 0.99*fvc)/(1.0-fvc)", {
        EM: aster.select("emissivity_band11").multiply(0.001),
        fvc: aster_fvc,
      })
      .clip(image.geometry());
  };

  var emiss_bare_band12 = function (image) {
    return image
      .expression("(EM - 0.99*fvc)/(1.0-fvc)", {
        EM: aster.select("emissivity_band12").multiply(0.001),
        fvc: aster_fvc,
      })
      .clip(image.geometry());
  };

  var emiss_bare_band13 = function (image) {
    return image
      .expression("(EM - 0.99*fvc)/(1.0-fvc)", {
        EM: aster.select("emissivity_band13").multiply(0.001),
        fvc: aster_fvc,
      })
      .clip(image.geometry());
  };

  var emiss_bare_band14 = function (image) {
    return image
      .expression("(EM - 0.99*fvc)/(1.0-fvc)", {
        EM: aster.select("emissivity_band14").multiply(0.001),
        fvc: aster_fvc,
      })
      .clip(image.geometry());
  };
  // this function computes the emissivity of the
  // Landsat TIR band using ASTER and FVC
  function addEMBand(landsat, use_ndvi) {
    var wrap = function (image) {
      var c13 = ee.Number(
        ee.Algorithms.If(
          landsat === "L4",
          0.3222,
          ee.Algorithms.If(
            landsat === "L5",
            -0.0723,
            ee.Algorithms.If(landsat === "L7", 0.2147, 0.682)
          )
        )
      );
      var c14 = ee.Number(
        ee.Algorithms.If(
          landsat === "L4",
          0.6498,
          ee.Algorithms.If(
            landsat === "L5",
            1.0521,
            ee.Algorithms.If(landsat === "L7", 0.7789, 0.2578)
          )
        )
      );
      var c = ee.Number(
        ee.Algorithms.If(
          landsat === "L4",
          0.0272,
          ee.Algorithms.If(
            landsat === "L5",
            0.0195,
            ee.Algorithms.If(landsat === "L7", 0.0059, 0.0584)
          )
        )
      );

      // get ASTER emissivity
      // convolve to Landsat band
      var emiss_bare = image.expression("c13*EM13 + c14*EM14 + c", {
        EM13: emiss_bare_band13(image),
        EM14: emiss_bare_band14(image),
        c13: ee.Image(c13),
        c14: ee.Image(c14),
        c: ee.Image(c),
      });

      // compute the dynamic emissivity for Landsat
      var EMd = image.expression("fvc*0.99+(1-fvc)*em_bare", {
        fvc: image.select("FVC"),
        em_bare: emiss_bare,
      });

      // compute emissivity directly from ASTER
      // without vegetation correction
      // get ASTER emissivity
      var aster = ee.Image("NASA/ASTER_GED/AG100_003").clip(image.geometry());
      var EM0 = image.expression("c13*EM13 + c14*EM14 + c", {
        EM13: aster.select("emissivity_band13").multiply(0.001),
        EM14: aster.select("emissivity_band14").multiply(0.001),
        c13: ee.Image(c13),
        c14: ee.Image(c14),
        c: ee.Image(c),
      });

      // select which emissivity to output based on user selection
      var EM = ee.Image(ee.Algorithms.If(use_ndvi, EMd, EM0));

      // prescribe emissivity of water bodies
      var qa = image.select("QA_PIXEL");
      EM = EM.where(qa.bitwiseAnd(1 << 7), 0.99);
      // prescribe emissivity of snow/ice bodies
      EM = EM.where(qa.bitwiseAnd(1 << 5), 0.989);

      return image.addBands(EM.rename("EM"));
    };
    return wrap;
  }
  var COLLECTION = ee.Dictionary({
    L4: {
      TOA: ee.ImageCollection("LANDSAT/LT04/C02/T1_TOA"),
      SR: ee.ImageCollection("LANDSAT/LT04/C02/T1_L2"),
      TIR: ["B6"],
      VISW: ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B7", "QA_PIXEL"],
    },
    L5: {
      TOA: ee.ImageCollection("LANDSAT/LT05/C02/T1_TOA"),
      SR: ee.ImageCollection("LANDSAT/LT05/C02/T1_L2"),
      TIR: ["B6"],
      VISW: ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B7", "QA_PIXEL"],
    },
    L7: {
      TOA: ee.ImageCollection("LANDSAT/LE07/C02/T1_TOA"),
      SR: ee.ImageCollection("LANDSAT/LE07/C02/T1_L2"),
      TIR: ["B6_VCID_1", "B6_VCID_2"],
      VISW: ["SR_B1", "SR_B2", "SR_B3", "SR_B4", "SR_B5", "SR_B7", "QA_PIXEL"],
    },
    L8: {
      TOA: ee.ImageCollection("LANDSAT/LC08/C02/T1_TOA"),
      SR: ee.ImageCollection("LANDSAT/LC08/C02/T1_L2"),
      TIR: ["B10", "B11"],
      VISW: [
        "SR_B1",
        "SR_B2",
        "SR_B3",
        "SR_B4",
        "SR_B5",
        "SR_B6",
        "SR_B7",
        "QA_PIXEL",
      ],
    },
  });

  // Function to create a lookup between two columns in a
  // feature collection
  var get_lookup_table = function (fc, prop_1, prop_2) {
    var reducer = ee.Reducer.toList().repeat(2);
    var lookup = fc.reduceColumns(reducer, [prop_1, prop_2]);
    return ee.List(lookup.get("list"));
  };

  let SMWcoef = {};
  SMWcoef.coeff_SMW_L4 = ee.FeatureCollection([
    ee.Feature(null, { TPWpos: 0, A: 0.9755, B: -205.2767, C: 212.0051 }),
    ee.Feature(null, { TPWpos: 1, A: 1.0155, B: -233.8902, C: 230.4049 }),
    ee.Feature(null, { TPWpos: 2, A: 1.0672, B: -257.1884, C: 239.3072 }),
    ee.Feature(null, { TPWpos: 3, A: 1.1499, B: -286.2166, C: 244.8497 }),
    ee.Feature(null, { TPWpos: 4, A: 1.2277, B: -316.7643, C: 253.0033 }),
    ee.Feature(null, { TPWpos: 5, A: 1.3649, B: -361.8276, C: 258.5471 }),
    ee.Feature(null, { TPWpos: 6, A: 1.5085, B: -410.1157, C: 265.1131 }),
    ee.Feature(null, { TPWpos: 7, A: 1.7045, B: -472.4909, C: 270.7 }),
    ee.Feature(null, { TPWpos: 8, A: 1.5886, B: -442.9489, C: 277.1511 }),
    ee.Feature(null, { TPWpos: 9, A: 2.0215, B: -571.8563, C: 279.9854 }),
  ]);

  SMWcoef.coeff_SMW_L5 = ee.FeatureCollection([
    ee.Feature(null, { TPWpos: 0, A: 0.9765, B: -204.6584, C: 211.1321 }),
    ee.Feature(null, { TPWpos: 1, A: 1.0229, B: -235.5384, C: 230.0619 }),
    ee.Feature(null, { TPWpos: 2, A: 1.0817, B: -261.3886, C: 239.5256 }),
    ee.Feature(null, { TPWpos: 3, A: 1.1738, B: -293.6128, C: 245.6042 }),
    ee.Feature(null, { TPWpos: 4, A: 1.2605, B: -327.1417, C: 254.2301 }),
    ee.Feature(null, { TPWpos: 5, A: 1.4166, B: -377.7741, C: 259.9711 }),
    ee.Feature(null, { TPWpos: 6, A: 1.5727, B: -430.0388, C: 266.952 }),
    ee.Feature(null, { TPWpos: 7, A: 1.7879, B: -498.1947, C: 272.8413 }),
    ee.Feature(null, { TPWpos: 8, A: 1.6347, B: -457.8183, C: 279.616 }),
    ee.Feature(null, { TPWpos: 9, A: 2.1168, B: -600.7079, C: 282.4583 }),
  ]);

  SMWcoef.coeff_SMW_L7 = ee.FeatureCollection([
    ee.Feature(null, { TPWpos: 0, A: 0.9764, B: -205.3511, C: 211.8507 }),
    ee.Feature(null, { TPWpos: 1, A: 1.0201, B: -235.2416, C: 230.5468 }),
    ee.Feature(null, { TPWpos: 2, A: 1.075, B: -259.656, C: 239.6619 }),
    ee.Feature(null, { TPWpos: 3, A: 1.1612, B: -289.819, C: 245.3286 }),
    ee.Feature(null, { TPWpos: 4, A: 1.2425, B: -321.4658, C: 253.6144 }),
    ee.Feature(null, { TPWpos: 5, A: 1.3864, B: -368.4078, C: 259.139 }),
    ee.Feature(null, { TPWpos: 6, A: 1.5336, B: -417.7796, C: 265.7486 }),
    ee.Feature(null, { TPWpos: 7, A: 1.7345, B: -481.5714, C: 271.3659 }),
    ee.Feature(null, { TPWpos: 8, A: 1.6066, B: -448.5071, C: 277.9058 }),
    ee.Feature(null, { TPWpos: 9, A: 2.0533, B: -581.2619, C: 280.68 }),
  ]);

  SMWcoef.coeff_SMW_L8 = ee.FeatureCollection([
    ee.Feature(null, { TPWpos: 0, A: 0.9751, B: -205.8929, C: 212.7173 }),
    ee.Feature(null, { TPWpos: 1, A: 1.009, B: -232.275, C: 230.5698 }),
    ee.Feature(null, { TPWpos: 2, A: 1.0541, B: -253.1943, C: 238.9548 }),
    ee.Feature(null, { TPWpos: 3, A: 1.1282, B: -279.4212, C: 244.0772 }),
    ee.Feature(null, { TPWpos: 4, A: 1.1987, B: -307.4497, C: 251.8341 }),
    ee.Feature(null, { TPWpos: 5, A: 1.3205, B: -348.0228, C: 257.274 }),
    ee.Feature(null, { TPWpos: 6, A: 1.454, B: -393.1718, C: 263.5599 }),
    ee.Feature(null, { TPWpos: 7, A: 1.635, B: -451.079, C: 268.9405 }),
    ee.Feature(null, { TPWpos: 8, A: 1.5468, B: -429.5095, C: 275.0895 }),
    ee.Feature(null, { TPWpos: 9, A: 1.9403, B: -547.2681, C: 277.9953 }),
  ]);

  function addSMWBand(landsat) {
    var wrap = function (image) {
      // Select algorithm coefficients
      var coeff_SMW = ee.FeatureCollection(
        ee.Algorithms.If(
          landsat === "L4",
          SMWcoef.coeff_SMW_L4,
          ee.Algorithms.If(
            landsat === "L5",
            SMWcoef.coeff_SMW_L5,
            ee.Algorithms.If(
              landsat === "L7",
              SMWcoef.coeff_SMW_L7,
              SMWcoef.coeff_SMW_L8
            )
          )
        )
      );

      // Create lookups for the algorithm coefficients
      var A_lookup = get_lookup_table(coeff_SMW, "TPWpos", "A");
      var B_lookup = get_lookup_table(coeff_SMW, "TPWpos", "B");
      var C_lookup = get_lookup_table(coeff_SMW, "TPWpos", "C");

      // Map coefficients to the image using the TPW bin position
      var A_img = image
        .remap(A_lookup.get(0), A_lookup.get(1), 0.0, "TPWpos")
        .resample("bilinear");
      var B_img = image
        .remap(B_lookup.get(0), B_lookup.get(1), 0.0, "TPWpos")
        .resample("bilinear");
      var C_img = image
        .remap(C_lookup.get(0), C_lookup.get(1), 0.0, "TPWpos")
        .resample("bilinear");

      // select TIR band
      var tir = ee.String(
        ee.Algorithms.If(
          landsat === "L8",
          "B10",
          ee.Algorithms.If(landsat === "L7", "B6_VCID_1", "B6")
        )
      );
      // compute the LST
      var lst = image
        .expression("A*Tb1/em1 + B/em1 + C", {
          A: A_img,
          B: B_img,
          C: C_img,
          em1: image.select("EM"),
          Tb1: image.select(tir),
        })
        .updateMask(image.select("TPW").lt(0).not());

      return image.addBands(lst.rename("LST"));
    };
    return wrap;
  }

  function toa(image) {
    var qa = image.select("QA_PIXEL");
    var mask = qa.bitwiseAnd(1 << 3);
    return image.updateMask(mask.not());
  }

  // cloudmask for SR data
  function sr(image) {
    var qa = image.select("QA_PIXEL");
    var mask = qa.bitwiseAnd(1 << 3).or(qa.bitwiseAnd(1 << 4));
    return image.updateMask(mask.not());
  }

  // load TOA Radiance/Reflectance
  var collection_dict = ee.Dictionary(COLLECTION.get(landsat));

  var landsatTOA = ee
    .ImageCollection(collection_dict.get("TOA"))
    .filter(ee.Filter.date(date_start, date_end))
    .filterBounds(geometry);
  //.map(cloudmask.toa);

  // load Surface Reflectance collection for NDVI
  var landsatSR = ee
    .ImageCollection(collection_dict.get("SR"))
    .filter(ee.Filter.date(date_start, date_end))
    .filterBounds(geometry)
    .map(sr)
    .map(addNDVIBand(landsat))
    .map(addFSVBand(landsat))
    .map(addNCEPBand)
    .map(addEMBand(landsat, use_ndvi));

  // combine collections
  // all channels from surface reflectance collection
  // except tir channels: from TOA collection
  // select TIR bands
  var tir = ee.List(collection_dict.get("TIR"));
  var visw = ee
    .List(collection_dict.get("VISW"))
    .add("NDVI")
    .add("FVC")
    .add("TPW")
    .add("TPWpos")
    .add("EM");
  var landsatALL = landsatSR.select(visw).combine(landsatTOA.select(tir), true);

  // compute the LST
  var landsatLST = landsatALL.map(addSMWBand(landsat));

  return landsatLST;
}

/*
Author: Sofia Ermida (sofia.ermida@ipma.pt; @ermida_sofia)

This code is free and open. 
By using this code and any data derived with it, 
you agree to cite the following reference 
in any publications derived from them:
Ermida, S.L., Soares, P., Mantas, V., Göttsche, F.-M., Trigo, I.F., 2020. 
    Google Earth Engine open-source code for Land Surface Temperature estimation from the Landsat series.
    Remote Sensing, 12 (9), 1471; https://doi.org/10.3390/rs12091471

this function computes the Fraction of Vegetation Cover from NDVI
the compute_NDVI.js function must be called before this one

to call this function use:

var FVCfun = require('users/sofiaermida/landsat_smw_lst:modules/compute_FVC.js')
var ImagewithFVC = FVCfun.addBand(landsat)(image)
or
var collectionwithFVC = ImageCollection.map(FVCfun.addBand(landsat))

USES:
    - SMW_coefficients.js

INPUTS:
        - landsat: <string>
                  the Landsat satellite id
                  valid inputs: 'L4', 'L5', 'L7' and 'L8'
        - image: <ee.Image>
                image for which to calculate the FVC
OUTPUTS:
        - <ee.Image>
          the input image with 1 new band: 
          'FVC': fraction of vegetation cover
*/
function addFSVBand(landsat) {
  var wrap = function (image) {
    var ndvi = image.select("NDVI");

    // Compute FVC
    var fvc = image.expression("((ndvi-ndvi_bg)/(ndvi_vg - ndvi_bg))**2", {
      ndvi: ndvi,
      ndvi_bg: 0.2,
      ndvi_vg: 0.86,
    });
    fvc = fvc.where(fvc.lt(0.0), 0.0);
    fvc = fvc.where(fvc.gt(1.0), 1.0);

    return image.addBands(fvc.rename("FVC"));
  };
  return wrap;
}

function addNDVIBand(landsat) {
  var wrap = function (image) {
    // choose bands
    var nir = ee.String(ee.Algorithms.If(landsat === "L8", "SR_B5", "SR_B4"));
    var red = ee.String(ee.Algorithms.If(landsat === "L8", "SR_B4", "SR_B3"));

    // compute NDVI
    return image.addBands(
      image
        .expression("(nir-red)/(nir+red)", {
          nir: image.select(nir).multiply(0.0000275).add(-0.2),
          red: image.select(red).multiply(0.0000275).add(-0.2),
        })
        .rename("NDVI")
    );
  };
  return wrap;
}
