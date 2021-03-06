/*
* (C) Copyright 2014 Kurento (http://kurento.org/)
*
* All rights reserved. This program and the accompanying materials
* are made available under the terms of the GNU Lesser General Public License
* (LGPL) version 2.1 which accompanies this distribution, and is available at
* http://www.gnu.org/licenses/lgpl-2.1.html
*
* This library is distributed in the hope that it will be useful,
* but WITHOUT ANY WARRANTY; without even the implied warranty of
* MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
* Lesser General Public License for more details.
*
*/

function getopts(args, opts)
{
  var result = opts.default || {};
  args.replace(
      new RegExp("([^?=&]+)(=([^&]*))?", "g"),
      function($0, $1, $2, $3) { result[$1] = $3; });

  return result;
};

var args = getopts(location.search,
{
  default:
  {
    ws_uri: 'ws://' + location.hostname + ':8888/kurento',
    ice_servers: undefined
  }
});

if (args.ice_servers) {
  console.log("Use ICE servers: " + args.ice_servers);
  kurentoUtils.WebRtcPeer.prototype.server.iceServers = JSON.parse(args.ice_servers);
} else {
  console.log("Use freeice")
}

var kurentoClient;
var videoInput;
var videoOutput;
var pipeline1;
var pipeline2;
var webRtcPeer;
var plumberSrc;

function connect(p1, p2, callback) {
	p2.getAddress(function (error, address) {
		if(error) return onError(error);

		console.log("Got address: " + address);

		p2.getPort (function (error, port) {
			if(error) return onError(error);

			console.log("Got port: " + port);

			p1.link (address, port, function(error, success) {
				callback (error, success);
			});
		});
	});
}

window.onload = function() {
	console = new Console('console', console);
	videoInput = document.getElementById('videoInput');
	videoOutput = document.getElementById('videoOutput');

	kurentoClient(args.ws_uri, function(error, client) {
	  if(error) return onError(error);

	  kurentoClient = client;
	});

    kurentoClient.register(kurentoModulePlumberendpoint);
}

function start() {
	showSpinner(videoInput, videoOutput);
	console.log("Creating sink pipeline");

	kurentoClient.create("MediaPipeline", function(error, p) {
		if(error) return onError(error);

		pipeline1 = p;

		pipeline1.create("PlumberEndpoint", function(error, plumberEndPoint) {
			if(error) return onError(error);

			plumberSrc = plumberEndPoint;
			console.log("PlumberEndPoint created");

			pipeline1.create('HttpGetEndpoint', function(error, httpGetEndpoint) {
			  if (error) return onError(error);

				console.log("HttpGetEndPoint created")
				plumberEndPoint.connect(httpGetEndpoint, function(error) {
					if (error) return onError(error);

					httpGetEndpoint.getUrl(function(error, url) {
						if (error) return onError(error);

						console.log ("Getting media from url: " + url);
						videoOutput.src = url;
						webRtcPeer = kurentoUtils.WebRtcPeer.startSendOnly(videoInput, onOffer, onError);
					});
				});
			});
		});
	});
}

function onOffer(sdpOffer){
    console.log ("Offer received.");
    console.log ("Creating source pipeline...");
	kurentoClient.create("MediaPipeline", function(error, p) {
		if(error) return onError(error);

		pipeline2 = p;

		pipeline2.create("WebRtcEndpoint", function(error, webRtc) {
			if(error) return onError(error);

			console.log ("Created webRtc");

			webRtc.processOffer(sdpOffer, function(error, sdpAnswer) {
				if(error) return onError(error);

				webRtcPeer.processSdpAnswer(sdpAnswer);
			});

			pipeline2.create("PlumberEndpoint", function(error, plumberSink) {
				if(error) return onError(error);

				console.log("PlumberEndPoint created");

				// Connect both plumberendpoints
				connect (plumberSink, plumberSrc, function(error, success) {
					if(error) return onError(error);
					if (!success) {
						console.error("Can not connect plumber end points");
						return;
					}

					console.log ("Pipelines connected");

					webRtc.connect(plumberSink, function(error){
						if(error) return onError(error);

						console.log("Source pipeline created.");
					});
				});
			});
		});
	});
}

function onError(error) {
	if(error) console.error(error);
	stop();
}

function stop() {
	if (webRtcPeer) {
		webRtcPeer.dispose();
		webRtcPeer = null;
	}
	if(pipeline1){
		pipeline1.release();
		pipeline1 = null;
	}
	if(pipeline2){
		pipeline2.release();
		pipeline2 = null;
	}
	hideSpinner(videoInput, videoOutput);
}

function showSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].poster = './img/transparent-1px.png';
		arguments[i].style.background = "center transparent url('./img/spinner.gif') no-repeat";
	}
}

function hideSpinner() {
	for (var i = 0; i < arguments.length; i++) {
		arguments[i].src = '';
		arguments[i].poster = './img/webrtc.png';
		arguments[i].style.background = '';
	}
}

/**
 * Lightbox utility (to display media pipeline image in a modal dialog)
 */
$(document).delegate('*[data-toggle="lightbox"]', 'click', function(event) {
	event.preventDefault();
	$(this).ekkoLightbox();
});
