const express = require('express');
const cors = require('cors');
const app = express();
const bodyParser = require('body-parser');
const webrtc = require('wrtc');

app.use(cors());
app.use(express.static('public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const sidePartyStreams = {};

app.post('/side-party-users', ({ body }, res) => {
  const streams = sidePartyStreams[body.sidePartyUid];

  const payload = {
    users: Object.keys(streams)
  };

  res.json(payload);
});

app.post('/consumer', async ({ body }, res) => {
  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      }
    ]
  });

  const desc = new webrtc.RTCSessionDescription(body.sdp);

  await peer.setRemoteDescription(desc);

  const streams = sidePartyStreams[body.sidePartyUid];

  streams[body.userUid].getTracks().forEach((track) => peer.addTrack(track, streams[body.userUid]));

  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  const payload = {
    sdp: peer.localDescription
  };

  res.json(payload);
});

app.post('/broadcast', async ({ body }, res) => {
  const peer = new webrtc.RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      }
    ]
  });

  peer.ontrack = (e) => handleTrackEvent(e, { sidePartyUid: body.sidePartyUid, userUid: body.userUid });
  const desc = new webrtc.RTCSessionDescription(body.sdp);

  await peer.setRemoteDescription(desc);
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  const payload = {
    sdp: peer.localDescription
  };

  res.json(payload);
});

const handleTrackEvent = async (e, { sidePartyUid, userUid }) => {
  // get existing streams if any
  const streams = sidePartyStreams[sidePartyUid];

  let allStreams = { [userUid]: e.streams[0] };

  if (streams) {
    allStreams = { ...streams, ...allStreams };
  }

  sidePartyStreams[sidePartyUid] = allStreams;
};

app.listen(5000, () => console.log('server running'));

// TODO: We need to handle when people leave to clear the redis db
