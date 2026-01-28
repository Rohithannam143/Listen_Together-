let player;
let playerReady = false;
let userProfile = null;
let currentRoom = null;
let isRemoteAction = true;
let lastKnownTime = 0; 
let currentLocalBlobURL = null;

const localPicker = document.getElementById("localPicker");
const localPlayer = document.getElementById("localPlayer");

let currentSource = "youtube"; // or "local"


setInterval(() => {
  if (!playerReady || !currentRoom || isRemoteAction) return;

  const state = player.getPlayerState();
  const time = player.getCurrentTime();

  // Detect manual seek (forward/backward)
  if (Math.abs(time - lastKnownTime) > 2) {
    updateRoomState("seek", time);
  }

  // Only sync time while playing
  if (state === YT.PlayerState.PLAYING) {
    updateRoomState("play", time);
  }

  lastKnownTime = time;
}, 800);


// 🔥 Firebase Config (PASTE YOURS)
firebase.initializeApp({
  apiKey: "AIzaSyDub9_sSHhxF-tLMxiGl7gDvR8XfDX_y3g",
  authDomain: "first-test-e497f.firebaseapp.com",
  databaseURL: "https://first-test-e497f-default-rtdb.asia-southeast1.firebasedatabase.app/", 
  projectId: "first-test-e497f",
  storageBucket: "first-test-e497f.firebasestorage.app",
  messagingSenderId: "688617687184"
});

const auth = firebase.auth();
const db = firebase.database();
const YT_API_KEY = "AIzaSyDo_eioze-6nhC4mz9Qdm9_bzNotITfXkg";


// Google Login (Optional)
document.getElementById("googleLogin").onclick = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(res => {
    currentUser = res.user;
    alert("Logged in as " + currentUser.displayName);
  });
};

// Enter App
const nameInput = document.getElementById("name");
const nickInput = document.getElementById("nickname");
const enterBtn = document.getElementById("enterBtn");

function checkInputs() {
  enterBtn.disabled = !(nameInput.value.trim() && nickInput.value.trim());
}

nameInput.addEventListener("input", checkInputs);
nickInput.addEventListener("input", checkInputs);

enterBtn.onclick = () => {
  userProfile = {
    name: nameInput.value.trim(),
    nick: nickInput.value.trim()
  };

  document.getElementById("landing").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");
};


// CREATE ROOM
function createRoom() {
  const roomId = document.getElementById("roomId").value.trim();
  if (!roomId || !userProfile) return;

  db.ref(`rooms/${roomId}`).get().then(snap => {
   if (snap.exists() && snap.child("members").exists()) {
  roomStatus.innerText = "❌ Room already active";
  return;
}


    currentRoom = roomId;

if (
  snap.exists() &&
  snap.child("members").exists() &&
  snap.child("members").numChildren() > 0
) {
  roomStatus.innerText = "❌ Room already active";
  return;
}

    joinRoomInternal();
    roomStatus.innerText = "✅ Room created & joined";
  });
}
function requestJoinRoom(roomId) {
  const reqRef = db.ref(`rooms/${roomId}/requests/${userProfile.nick}`);

  reqRef.set({
    name: userProfile.name,
    nick: userProfile.nick,
    requestedAt: Date.now()
  });

  roomStatus.innerText = "⏳ Join request sent";
}

function listenJoinRequests() {
  if (!currentRoom) return;

  db.ref(`rooms/${currentRoom}/requests`).on("value", snap => {
    if (!snap.exists()) return;

    snap.forEach(child => {
      const req = child.val();
      showJoinRequestUI(req); // accept / reject buttons
    });
  });
}
if (userProfile.nick === roomHost) {
  listenJoinRequests();
}
function acceptJoinRequest(nick) {
  const memberRef = db.ref(`rooms/${currentRoom}/members/${nick}`);
  const reqRef = db.ref(`rooms/${currentRoom}/requests/${nick}`);

  reqRef.get().then(snap => {
    if (!snap.exists()) return;

    memberRef.set({
      ...snap.val(),
      joinedAt: Date.now()
    });

    reqRef.remove();
  });
}
function autoAcceptJoin(roomId, nick) {
  setTimeout(() => {
    const reqRef = db.ref(`rooms/${roomId}/requests/${nick}`);
    const memberRef = db.ref(`rooms/${roomId}/members/${nick}`);

    reqRef.get().then(snap => {
      if (!snap.exists()) return; // already handled

      memberRef.set({
        ...snap.val(),
        joinedAt: Date.now(),
        autoApproved: true
      });

      reqRef.remove();
    });
  }, 10000); // 10 sec
}
autoAcceptJoin(roomId, userProfile.nick);
function waitForApproval(roomId) {
  db.ref(`rooms/${roomId}/members/${userProfile.nick}`)
    .on("value", snap => {
      if (!snap.exists()) return;

      // Approved
      currentRoom = roomId;
      joinRoomInternal();
      roomStatus.innerText = "✅ Joined room";
    });
}
memberRef.onDisconnect().remove();
//Search
function searchYouTube() {
  const q = document.getElementById("ytQuery").value;

  fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&maxResults=5&key=${YT_API_KEY}`)
    .then(res => res.json())
    .then(data => {
      results.innerHTML = "";
      data.items.forEach(item => {
        const div = document.createElement("div");
        div.className = "yt-card";
        div.innerHTML = `
          <img src="${item.snippet.thumbnails.medium.url}">
          <p>${item.snippet.title}</p>
        `;
        div.onclick = () => loadVideo(item.id.videoId);
        results.appendChild(div);
      });
    });
}
// Load Video
function loadVideo(videoId) {
  if (!playerReady || !currentRoom) return;

  player.loadVideoById(videoId);
  player.playVideo(); 

  db.ref(`rooms/${currentRoom}/state`).set({
    videoId,
    action: "play",
    time: 0,
    updatedAt: Date.now()
  });
  currentSource = "youtube";
localPlayer.pause();
localPlayer.style.display = "none";
document.getElementById("player").style.display = "block";

}


// Player

function onYouTubeIframeAPIReady() {
  player = new YT.Player("player", {
    height: "360",
    width: "100%",
    playerVars: {
      playsinline: 1
    },
    events: {
      onReady: () => {
        playerReady = true;
        console.log("✅ Player Ready");

        // Only attach sync AFTER ready
        if (currentRoom) {
          attachPlayerSync();
          listenRoomState();
        }
      }
    }
  });
}


// JOIN ROOM
function joinRoom() {
  const roomId = document.getElementById("roomId").value.trim();
  if (!roomId || !userProfile) return;

  db.ref(`rooms/${roomId}`).get().then(snap => {
    if (!snap.exists()) {
  roomStatus.innerText = "❌ Room does not exist";
  return;
}

if (
  !snap.child("members").exists() ||
  snap.child("members").numChildren() === 0
) {
  roomStatus.innerText = "⚠️ Room is empty. Try creating it.";
  return;
}

    currentRoom = roomId;
    joinRoomInternal();
    roomStatus.innerText = "✅ Joined room";
  });
}
// Join Room Internal
function joinRoomInternal() {
  if (!currentRoom || !userProfile) return;

  // Register member
  const memberRef = db.ref(`rooms/${currentRoom}/members/${userProfile.nick}`);

  memberRef.set({
    name: userProfile.name,
    nick: userProfile.nick,
    joinedAt: Date.now()
  });
db.ref(`rooms/${currentRoom}/members`).on("value", snap => {
  if (!snap.exists() || snap.numChildren() === 0) {
    db.ref(`rooms/${currentRoom}`).remove();
  }
});

  memberRef.onDisconnect().remove();

  // 🔥 START LISTENERS (THIS WAS MISSING / TOO EARLY BEFORE)
  if (playerReady) {
    listenRoomState();
    attachPlayerSync();
  }

  listenForMessages();
  listenMembers();
}
// attach Player Sync
function attachPlayerSync() {
  player.addEventListener("onStateChange", event => {
    if (!currentRoom || isRemoteAction) return;

    const time = player.getCurrentTime();

    if (event.data === YT.PlayerState.PLAYING) {
      updateRoomState("play", time);
    }

    if (event.data === YT.PlayerState.PAUSED) {
      updateRoomState("pause", time);
    }
  });
}

// Listen Room State
function listenRoomState() {
  db.ref(`rooms/${currentRoom}/state`).off();

  db.ref(`rooms/${currentRoom}/state`).on("value", snap => {
    if (!snap.exists() || !playerReady) return;
    if (!player || typeof player.seekTo !== "function") return;

    const state = snap.val();
    isRemoteAction = true;

    const currentTime = player.getCurrentTime();

    // SEEK (forward / backward)
    if (state.action === "seek") {
      player.seekTo(state.time, true);
    }

    // PLAY
    if (state.action === "play") {
      // Load video if needed
      const loaded = player.getVideoData()?.video_id;
      if (state.videoId && loaded !== state.videoId) {
        player.loadVideoById(state.videoId, state.time || 0);
        setTimeout(() => player.playVideo(), 400);
      } else {
        player.playVideo();
        player.seekTo(state.time, true);
      }
    }

    // PAUSE / STOP
    if (state.action === "pause") {
      player.pauseVideo();
      player.seekTo(state.time, true);
    }

    setTimeout(() => {
      isRemoteAction = false;
    }, 300);

    if (state.source === "local") {
  isRemoteAction = true;

  currentSource = "local";

  document.getElementById("player").style.display = "none";
  localPlayer.style.display = "block";

  // File must be selected manually
  if (!localPlayer.src) {
    alert(
      `Select local file: ${state.localName} to sync`
    );
    isRemoteAction = false;
    return;
  }

  if (state.action === "seek") {
    localPlayer.currentTime = state.time;
  }

  if (state.action === "play") {
    localPlayer.currentTime = state.time;
    localPlayer.play();
  }

  if (state.action === "pause") {
    localPlayer.pause();
    localPlayer.currentTime = state.time;
  }

  setTimeout(() => {
    isRemoteAction = false;
  }, 300);

  return; // 🔥 prevent YouTube logic from running
}

  });
}
function updateRoomState(action, time) {
  if (!currentRoom) return;

  db.ref(`rooms/${currentRoom}/state`).update({
    action,
    time,
    updatedAt: Date.now()
  });
}

// Listen Members
function listenMembers() {
  const list = document.getElementById("memberList");
  list.innerHTML = "";

  db.ref(`rooms/${currentRoom}/members`).off();

  db.ref(`rooms/${currentRoom}/members`).on("value", snap => {
    list.innerHTML = "";

    snap.forEach(child => {
      const m = child.val();
      const li = document.createElement("li");
      li.textContent = `${m.name} (${m.nick})`;
      list.appendChild(li);
    });
  });
}
function pickLocalFile() {
  if (!userProfile || !currentRoom) {
    alert("Join a room first");
    return;
  }
  localPicker.click();
}

localPicker.onchange = () => {
  const file = localPicker.files[0];
  if (!file) return;

  // 🔥 Revoke old blob URL to avoid errors
  if (currentLocalBlobURL) {
    URL.revokeObjectURL(currentLocalBlobURL);
  }

  const blobURL = URL.createObjectURL(file);
  currentLocalBlobURL = blobURL;

  currentSource = "local";
  showLocalPlayer();
  localPlayer.pause();
  localPlayer.src = blobURL;
  localPlayer.load();

  alert("Press ▶️ to start local media");

  db.ref(`rooms/${currentRoom}/state`).set({
    source: "local",
    localName: file.name,
    action: "pause",
    time: 0,
    updatedAt: Date.now()
  });
};
localPlayer.onerror = () => {
  console.error("Local media error:", localPlayer.error);
};


localPlayer.onplay = () => {
  if (isRemoteAction) return;
  updateRoomState("play", localPlayer.currentTime);
};

localPlayer.onpause = () => {
  if (isRemoteAction) return;
  updateRoomState("pause", localPlayer.currentTime);
};

localPlayer.onseeked = () => {
  if (isRemoteAction) return;
  updateRoomState("seek", localPlayer.currentTime);
};


// CHAT
function sendMessage() {
  if (!currentRoom || !userProfile) return;

  const text = chatInput.value.trim();
  if (!text) return;

  const time = new Date().toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short"
  });

  db.ref(`chats/${currentRoom}`).push({
    name: userProfile.name,
    nick: userProfile.nick,
    text,
    time
  });

  chatInput.value = "";
}


// Listen Chats
function listenForMessages() {
  const chatBox = document.getElementById("chatBox");
  chatBox.innerHTML = "";

  db.ref(`chats/${currentRoom}`).off();

  db.ref(`chats/${currentRoom}`).on("child_added", snap => {
    const m = snap.val();

    const div = document.createElement("div");
    div.className = "msg";

    div.innerHTML = `
      <div class="msg-user">${m.nick}</div>
      <div class="msg-text">${m.text}</div>
      <div class="msg-time">${m.time}</div>
    `;

    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  });
}
function openChat() {
  document.querySelector(".right").classList.add("mobile-chat");
  document.querySelector(".left").classList.remove("mobile-rooms");
}

function openRooms() {
  document.querySelector(".left").classList.add("mobile-rooms");
  document.querySelector(".right").classList.remove("mobile-chat");
}

// Close when tapping outside (optional)
document.addEventListener("click", e => {
  if (e.target.classList.contains("mobile-chat")) {
    e.target.classList.remove("mobile-chat");
  }
  if (e.target.classList.contains("mobile-rooms")) {
    e.target.classList.remove("mobile-rooms");
  }
});

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
