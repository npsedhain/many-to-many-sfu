window.onload = () => {
  document.getElementById('start').onclick = () => {
    startStream();
  };

  document.getElementById('view').onclick = () => {
    viewStream();
  };
};

const urlParams = new URLSearchParams(window.location.search);
const userUid = urlParams.get('userUid');
const sidePartyUid = urlParams.get('sidePartyUid');

const startStream = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  document.getElementById('my-video').srcObject = stream;

  const peer = createBroadcastPeer();

  stream.getTracks().forEach((track) => peer.addTrack(track, stream));
};

const createBroadcastPeer = () => {
  const peer = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      }
    ]
  });

  peer.onnegotiationneeded = () => handleBroadcasterNegotiationNeeded(peer);

  return peer;
};

const viewStream = async () => {
  const response = await fetch(`http://localhost:5000/side-party-users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify({ sidePartyUid })
  });

  const { users } = await response.json();

  users.map((user) => {
    if (user != userUid) {
      const peer = createReceiverPeer(user);
      peer.addTransceiver('video', { direction: 'recvonly' });
    }
  });
};

const createReceiverPeer = (user) => {
  const peer = new RTCPeerConnection({
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      }
    ]
  });

  peer.ontrack = (e) => handleReceivedTrack(e, user);

  peer.onnegotiationneeded = () => handleConsumerNegotiationNeeded(peer, user);

  return peer;
};

const handleReceivedTrack = (e, user) => {
  document.getElementById(`video-${user}`).srcObject = e.streams[0];
};

const handleConsumerNegotiationNeeded = async (peer, user) => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  const payload = {
    sdp: peer.localDescription,
    userUid: user,
    sidePartyUid
  };

  const res = await fetch(`http://localhost:5000/consumer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  const desc = new RTCSessionDescription(data.sdp);

  peer.setRemoteDescription(desc).catch((e) => console.log(e));
};

const handleBroadcasterNegotiationNeeded = async (peer) => {
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  const payload = {
    sdp: peer.localDescription,
    userUid,
    sidePartyUid
  };

  const res = await fetch(`http://localhost:5000/broadcast`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
      // 'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  const desc = new RTCSessionDescription(data.sdp);

  peer.setRemoteDescription(desc).catch((e) => console.log(e));
};
