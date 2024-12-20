import { addShortsPlaylist, addVideosPlaylist, deleteNotification, getNotifications, getRandomShorts, getRandomVideos, getShorts, getShortsPlaylists, getVideos, getVideosPlaylists, subscribe, unsubscribe, uploadShort, uploadVideo, getSubscribees, getPlaylistlessVideos, getPlaylistlessShorts } from "/anville-tube-react/src/util/media.js";
import { login, signUpUser } from "/anville-tube-react/src/util/auth.js";
import { deleteMessage, getMessages, sendMessage } from "/anville-tube-react/src/util/messaging.js";
import { authenticatePrimeAdmin, prepareCommandChannel, sendCommand } from "/anville-tube-react/src/util/admin.js";
/*
let fileInput = document.getElementById("file");
fileInput.onchange = () => {
    signUpUser("anville@maven.com", "anville", "pass", fileInput.files[0])
    .then(response => {
        alert(response);
    })
    .catch(error => {
        alert("ERROR: " + error.message);
    })
}

login("anville@maven.com", "pass")
.then(user => {
    console.log("Yaaaaaaaaaaaas!");
    console.log(user);
    addShortsPlaylist(user.emailAddress, "Catalogue Confirmation Short Playlist")
    .then(() => {
        console.log("Success!");
    })
    .catch(error => {
        console.log("Playlist addition failed!");
        console.error(error);
    })
})
.catch(error => {
    console.log("Nooooo!");
    console.error(error);
})

let contentInput = document.getElementById("content");
contentInput.onchange = () => {
    uploadShort("Short Content For Catalogue", contentInput.files[0], "anville@maven.com", "Catalogue Confirmation Short Playlist")
    .then(() => {
        console.log("Successful upload. Yaaas");
    })
    .catch(error => {console.error(error);})
}

getShortsPlaylists("anville@maven.com")
.then(playlist => {
    console.log(playlist);
})
.catch(error => {
    console.error(error);
})

getShorts("anville@maven.com", "The First Shorts Playlist. Yaaas!!!")
.then(shorts => {
    console.log(shorts);
})
.catch(error => {
    console.error(error);
})
getVideos("anville@maven.com", "The First Videos Playlist")
.then(shorts => {
    console.log(shorts);
})
.catch(error => {
    console.error(error);
})
let fileInput = document.getElementById("file2");
fileInput.onchange = () => {
    signUpUser("maven@anville.com", "anville", "pass", fileInput.files[0])
    .then(response => {
        alert(response);
    })
    .catch(error => {
        alert("ERROR: " + error.message);
    })
}
subscribe("maven@anville.com",  "anville@maven.com")
.then(() => {
    console.log("Subscription successful!");
})
.catch(error => {
    console.error(error);
})
getNotifications("maven@anville.com")
.then(notifications => {
    console.log(notifications);
})
.catch(error => {
    console.error(error);
})

unsubscribe("maven@anville.com",  "anville@maven.com")
.then(() => {
    console.log("Unsubscription successful!");
})
.catch(error => {
    console.error(error);
})

deleteNotification("maven@anville.com", "anville's ChannelHas uploaded new short; 2Second Video Content")
.then(() => {
    console.log("Notification deletion successful!");
})
.catch(error => {
    console.error(error);
})
sendMessage("maven@anville.com", "maven",  "anville@maven.com", "Hi anville. This is the first message")
.then(() => {
    console.log("Message sent successfully!");
})
.catch(error => {
    console.error(error);
})
getMessages("maven@anville.com", "maven",  "anville@maven.com")
.then(messages => {
    console.log(messages);
})
.catch(error => {
    console.error(error);
})
deleteMessage("maven@anville.com", "anville@maven.com", "Hi anville. This is the first message")
.then(() => {
    console.log("Message deleted successfully!");
})
.catch(error => {
    console.error(error);
})

//admin-email: anville@maven-admin.com
let primeInput = document.getElementById("pInput");
primeInput.onchange = () => {
    authenticatePrimeAdmin(primeInput.files[0])
    .then(socket => {
        console.log(socket);
        sendCommand("add-admin", JSON.stringify({ emailAddress: "admin-anville@maven-admin.com", password: "pass1234" }), socket)
        .then(response => {
            console.log(response);
        })
        .catch(error => {
            console.error(error);
        })
    })
    .catch(error => {
        console.error(error);
    })
}

login("admin-anville@maven-admin.com", "pass1234")
.then(user => {
    console.log("Yaaaaaaaaaaaas!");
    console.log(user);
    prepareCommandChannel(user)
    .then(socket => {
        sendCommand("unhide-content", JSON.stringify({contentTitle: "Short Content", contentType: 2, channelEmailAddress: "anville@maven.com", playlistTitle: "The First Shorts Playlist. Yaaas!!!"}), socket)
        .then(res => {
            console.log(res);
        })
        .catch(error => {
            console.error(error);
        })
    })
})
.catch(error => {
    console.error(error);
})

getRandomVideos()
.then(shorts => {
    console.log("Yaaas!");
    console.log(shorts);
})
.catch(error => {
    console.error(error);
})

getRandomShorts({amount: 2})
.then(console.log)
.catch(console.error);
getSubscribees("anville@maven.com")
.then(console.log)
.catch(console.error);
*/
getPlaylistlessShorts({channelEmailAddress:"anville@maven.com"})
.then(console.log)
.catch(console.error);

getPlaylistlessVideos({channelEmailAddress:"anville@maven.com"})
.then(console.log)
.catch(console.error);