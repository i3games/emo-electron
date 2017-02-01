var log = require("./filelog");
var osc = require("osc");

var detector;
// affectiva SDK Needs to create video and canvas nodes in the DOM in order to function :((
var divRoot = $("#affdex_elements")[0];
var faceMode = affdex.FaceDetectorMode.LARGE_FACES;
var height = 480;
var oscParameters = { remoteAddress: "127.0.0.1", remotePort: 12000 } ;
var settings = { alldata: false, engagement: true, logFile: log.getPath(), logToFile: false, logToConsole: false, markers: false, sendOSC: false, valence: true, view: false };
var sourceConstraints = { video: true }; // constraints for input camera
var sourceIDs = []; // select input camera
var udpPort = new osc.UDPPort({
    localAddress: "0.0.0.0",
    localPort: 57121
});
var width = 640;

$(document).ready(function() {
  udpPort.open();
  initUI();
});

udpPort.on("ready", function () {
  settings.sendOSC = true;
});

function drawFeaturePoints(img, featurePoints) {
  var contxt = $('#face_video_canvas')[0].getContext('2d');

  var hRatio = contxt.canvas.width / img.width;
  var vRatio = contxt.canvas.height / img.height;
  var ratio = Math.min(hRatio, vRatio);

  contxt.strokeStyle = "#FFFFFF";
  for (var id in featurePoints) {
    contxt.beginPath();
    contxt.arc(featurePoints[id].x,
      featurePoints[id].y, 2, 0, 2 * Math.PI);
      contxt.stroke();
  }
}

function initDetector() {
  var detector = new affdex.CameraDetector(divRoot, width, height, faceMode, sourceConstraints);
  //Enable detection of all Expressions, Emotions and Emojis classifiers.
  detector.detectAllEmotions();
  detector.detectAllExpressions();
  // detector.detectAllEmojis();
  detector.detectAllAppearance();
  detector.addEventListener("onWebcamConnectSuccess", function() {
    logf('#emo-detector', "Webcam access ok", settings.logToFile, settings.logToConsole);
    $("#face_video_canvas").css("display", "none");
    $("#face_video_canvas").css("visibility", "hidden");
    $("#face_video").css("display", "none");
  });

  detector.addEventListener("onInitializeSuccess", function() {
    logf('#emo-detector', "The detector reports initialized", settings.logToFile, settings.logToConsole);
    $("#face_video_canvas").css("display", "none");
    $("#face_video_canvas").css("visibility", "hidden");
    $("#face_video").css("display", "none");
    //Display canvas instead of video feed because we want to draw the feature points on it
  });

  detector.addEventListener("onWebcamConnectFailure", function() {
    logf('#emo-detector', "webcam denied", settings.logToFile, settings.logToConsole);
    console.log("Webcam access denied");
  });

  detector.addEventListener("onStopSuccess", function() {
    logf('#emo-detector', "The detector reports stopped", settings.logToFile, settings.logToConsole);
    $("#results").html("");
  });

  //Add a callback to receive the results from processing an image.
  //The faces object contains the list of the faces detected in an image.
  //Faces object contains probabilities for all the different expressions, emotions and appearance metrics
  detector.addEventListener("onImageResultsSuccess", function(faces, image, timestamp) {
    let appearanceCmd, appearanceArgs, emotionsCmd, emotionsArgs, expressionsCmd, expressionsArgs, emojiCmd, emojiArgs;
    const timestampCmd = "/timestamp";
    const timestampArgs = timestamp.toFixed(2); // float
    const numFacesCmd = "/numfaces";
    const numFacesArgs = faces.length; // int
    if (faces.length > 0) {
      appearanceCmd = "/appearance";
      appearanceArgs = JSON.stringify(faces[0].appearance); // string
      emotionsCmd = "/emotions";
      emotionsArgs =  JSON.stringify(faces[0].emotions, function(key, val) {
                              return val.toFixed ? Number(val.toFixed(0)) : val;});  // int
      expressionsCmd = "/expressions";
      expressionsArgs = JSON.stringify(faces[0].expressions, function(key, val) {
                              return val.toFixed ? Number(val.toFixed(0)) : val});
      emojiCmd = "/emoji";
      emojiArgs = faces[0].emojis.dominantEmoji;
    }

    if(settings.sendOSC) {
      sendOSC(timestampCmd, timestampArgs);
      sendOSC(numFacesCmd, numFacesArgs);
      if (faces.length > 0) {
        sendOSC(appearanceCmd, appearanceArgs);
        sendOSC(emotionsCmd, emotionsArgs);
        sendOSC(expressionsCmd, expressionsArgs);
        sendOSC(emojiCmd, emojiArgs);
      }
    }

    logf('#emo-data', `${timestampCmd} ${timestampArgs}`, settings.logToFile, settings.logToConsole);
    logf('#emo-data', `${numFacesCmd} ${numFacesArgs}`, settings.logToFile, settings.logToConsole);
    if (faces.length > 0) {
      logf('#emo-data', `${appearanceCmd} ${appearanceArgs}`, settings.logToFile, settings.logToConsole);
      logf('#emo-data', `${emotionsCmd} ${emotionsArgs}`, settings.logToFile, settings.logToConsole);
      logf('#emo-data', `${expressionsCmd} ${expressionsArgs}`, settings.logToFile, settings.logToConsole);
      logf('#emo-data', `${emojiCmd} ${emojiArgs}`, settings.logToFile, settings.logToConsole);
      if (settings.view && settings.markers) {
        drawFeaturePoints(image, faces[0].featurePoints);
      }
    }
  });

  return detector;
}

function initUI() {
  $("#face_video_canvas").css("display", "none");
  $("#face_video_canvas").css("visibility", "hidden");
  $('select').material_select(); // required by materialize
  $("#host")[0].value = oscParameters.remoteAddress; // dom elements are in attribute [0] in materialize objects
  $("#port")[0].value = oscParameters.remotePort;
  $("#logfile")[0].value = settings.logFile;
  $("#togglevalence")[0].checked = settings.valence;
  $("#toggleengagement")[0].checked = settings.engagement;
  $("#togglealldata")[0].checked = settings.alldata;
  Materialize.updateTextFields(); // recommended by materialize
}

function logf(category, msg, logToFile, logToConsole) {
  const logMsg = `${category} ${msg}`;
  if (logToFile) { log.write(logMsg); }
  if (logToConsole) { console.log(logMsg); }
}

function onGotSources(sourceInfos) {
  var i, selectList, storageIndex;

  selectList = document.getElementById("sources");
  selectList.options.length = 0;
  storageIndex = 0;
  for (i=0; i < sourceInfos.length; i++) {
    // logf("#emo-detector", sourceInfos[i], settings.logToFile, settings.logToConsole);
    if (sourceInfos[i].kind === 'videoinput') {
      selectList.options.add(new Option(sourceInfos[i].label), i);
      sourceIDs[storageIndex] = sourceInfos[i].deviceId;
      storageIndex++;
    }
  }
  $('select').material_select(); // required by materialize
  onUISourceChanged(); // set the initially displayed entry in the selection list
}

function onUIGetSources(){
  navigator.mediaDevices.enumerateDevices()
  .then(function(devices) {
    devices.forEach(function(device) {
    //  logf("#emo-detector", device.kind + ": " + device.label + " id = " + device.deviceId, settings.logToFile, settings.logToConsole);
    });
    return devices;
  }).catch(function(err) {
    logf("#error", err.name + ": " + err.message, true);
  }).then(onGotSources);
}

function onUIOSCParamsChanged() {
  const button = $("#updateosc");
  if (button.hasClass("disabled")) {
    button.removeClass("disabled");
  }
}

function onUISourceChanged() {
  var selectList = $("#sources");
  var selected = sourceIDs[selectList.selectedIndex];
  logf("#emo-detector", "Active camera deviceId: " + selected, settings.logToFile, settings.logToConsole);

  setSourceConstraintId(selected);
}

function onUIToggleAllData() {
  settings.alldata = $("#togglealldata").is(':checked');
}

function onUIToggleDetector() {
  $("#toggledetector").is(':checked') ? start() : stop();
}

function onUIToggleEngagement() {
  settings.engagement = $("#toggleengagement").is(':checked');
}

function onUIToggleLogToConsole() {
  settings.logToConsole = $("#togglelogconsole").is(':checked');
}

function onUIToggleLogToFile() {
  settings.logToFile = $("#togglelogfile").is(':checked');
}

function onUIToggleMarkers() {
  // markers only make sense when view is enabled
  if (!settings.view) { return; }
  settings.markers = $("#togglemarkers").is(':checked');
}

function onUIToggleOSC() {
  settings.sendOSC = $("#toggleosc").is(':checked');
}

function onUIToggleValence() {
  settings.valence = $("#togglevalence").is(':checked');
}

function onUIToggleView() {
  settings.view = $("#toggleview").is(':checked');
  if (settings.view) { // switch it on
    $("#face_video_canvas").css("display", "block");
    $("#face_video_canvas").css("visibility", "visible");
  } else {
    $("#face_video_canvas").css("display", "none");
    $("#face_video_canvas").css("visibility", "hidden");
  }
}

function onUIUpdateOSCParameters() {
  const button = $("#updateosc");
  const host = $("#host")[0].value;
  const port = $("#port")[0].value;
  oscParameters.remoteAddress = host;
  oscParameters.remotePort = port;
  logf('#emo-detector', `oscParameters changed to: ${oscParameters.remoteAddress} ${oscParameters.remotePort}`, settings.logToFile, settings.logToConsole);
  button.addClass("disabled");
}

function sendOSC(msg, args) {
  udpPort.send({
      address: msg,   // /message
      args: args      // [arrrrrrghhh1, arg2, ...]
  }, oscParameters.remoteAddress, oscParameters.remotePort);
}

function setSourceConstraintId(id) {
  sourceConstraints = { video: { deviceId: { exact: id } } };
}

function start() {
  logf('#emo-detector', "Start", settings.logToFile, settings.logToConsole);
  detector = initDetector();
  if (detector && !detector.isRunning) {
    detector.start();
  }
}

function stop() {
  logf('#emo-detector', "Stop", settings.logToFile, settings.logToConsole);
  if (detector && detector.isRunning) {
    detector.removeEventListener();
    detector.stop();
  }
}
