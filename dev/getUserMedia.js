// getUserMediaHandler.js

if (typeof webrtcUtils !== 'undefined') {
    webrtcUtils.enableLogs = false;
}

function setStreamType(constraints, stream) {
    if (constraints.mandatory && constraints.mandatory.chromeMediaSource) {
        stream.isScreen = true;
    } else if (constraints.mozMediaSource || constraints.mediaSource) {
        stream.isScreen = true;
    } else if (constraints.video) {
        stream.isVideo = true;
    } else if (constraints.audio) {
        stream.isAudio = true;
    }
}

var currentUserMediaRequest = {
    streams: [],
    mutex: false,
    queueRequests: [],
    remove: function(idInstance) {
        this.mutex = false;

        var stream = this.streams[idInstance];
        if (!stream) {
            return;
        }

        stream = stream.stream;

        var options = stream.currentUserMediaRequestOptions;

        if (this.queueRequests.indexOf(options)) {
            delete this.queueRequests[this.queueRequests.indexOf(options)];
            this.queueRequests = removeNullEntries(this.queueRequests);
        }

        this.streams[idInstance].stream = null;
        delete this.streams[idInstance];
    }
};

function getUserMediaHandler(options) {
    if (currentUserMediaRequest.mutex === true) {
        currentUserMediaRequest.queueRequests.push(options);
        return;
    }
    currentUserMediaRequest.mutex = true;

    // easy way to match 
    var idInstance = JSON.stringify(options.localMediaConstraints);

    function streaming(stream, returnBack) {
        setStreamType(options.localMediaConstraints, stream);
        options.onGettingLocalMedia(stream, returnBack);

        stream.addEventListener('ended', function() {
            delete currentUserMediaRequest.streams[idInstance];

            currentUserMediaRequest.mutex = false;
            if (currentUserMediaRequest.queueRequests.indexOf(options)) {
                delete currentUserMediaRequest.queueRequests[currentUserMediaRequest.queueRequests.indexOf(options)];
                currentUserMediaRequest.queueRequests = removeNullEntries(currentUserMediaRequest.queueRequests);
            }
        }, false);

        currentUserMediaRequest.streams[idInstance] = {
            stream: stream
        };
        currentUserMediaRequest.mutex = false;

        if (currentUserMediaRequest.queueRequests.length) {
            getUserMediaHandler(currentUserMediaRequest.queueRequests.shift());
        }
    }

    if (currentUserMediaRequest.streams[idInstance]) {
        streaming(currentUserMediaRequest.streams[idInstance].stream, true);
    } else {
        if (isPluginRTC) {
            var mediaElement = document.createElement('video');
            Plugin.getUserMedia({
                audio: true,
                video: true
            }, function(stream) {
                stream.streamid = stream.id || getRandomString();
                streaming(stream);
            }, function(error) {});

            return;
        }

        if (typeof DetectRTC !== 'undefined') {
            if (!DetectRTC.hasMicrophone) {
                options.localMediaConstraints.audio = false;
            }

            if (!DetectRTC.hasWebcam) {
                options.localMediaConstraints.video = false;
            }
        }

        navigator.mediaDevices.getUserMedia(options.localMediaConstraints).then(function(stream) {
            stream.streamid = stream.streamid || stream.id || getRandomString();
            stream.idInstance = idInstance;
            streaming(stream);
        }).catch(function(error) {
            options.onLocalMediaError(error, options.localMediaConstraints);
        });
    }
}
