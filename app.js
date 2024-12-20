const express = require("express"),
      serveStatic = require("serve-static"),
      bodyParser = require("body-parser"),
      multer = require("multer"),
      { Readable } = require("stream"),
      socketIO = require("socket.io"),
      uploadFile = multer({dest: "./uploads"}),
      { join } = require("path"),
      cookieParser = require("cookie-parser"),
      { createUserAccount, authenticateUserAccount, getProfilePicture, updateUserAccount } = require("./auth.js"),
      { connectToDBServer } = require("./db-utils.js"),
      { stringifyError } = require("./util.js"),
      { writeContent, streamContent, CONTENT_TYPES, addPlaylist, readPlaylists, readContents, readRandomContents, likeContent, dislikeContent, unlikeContent, undislikeContent, readComments, writeComment, readPlaylistlessContents, getChannel, removePlaylist, removeContent, removeAllPlaylists, removeAllPlaylistlessContents } = require("./media.js"),
      { addSubscription, removeSubscription, readSubscriptions } = require("./subscriptions.js"),
      { readNotifications, removeNotification } = require("./notifications.js"),
      { writeMessage, readMessages, removeMessage, getComments } = require("./messaging.js"),
      { authenticatePrimeAdmin, verifyPrimeAdminCredentials, authenticateAdminAccount, createPrimeAdminFile, createPrimeAdminCredentialsFile, addAdminAccount, banAdminAccount, unBanAdminAccount, deleteAdminAccount, banUser, unBanUser, deleteUser, hide, unHide, searchVideosForAdmin, searchShortsForAdmin } = require("./admin-auth.js"),
      PORT_NUMBER = 2024,
      ADMIN_RESPONSE_SUFFIX = "_response",
      ADMIN_ERROR_SUFFIX = "_error";

var app = express()
    .use(bodyParser.json())
    .post("/sign-up-user", uploadFile.single("profilePicture"), (req, res, next) => {
        let { emailAddress, username, password } = req.body,
        profilePicture = req.file;
        handleRequest(createUserAccount, { client, emailAddress, username, password, profilePicture }, res);
    })
    .post("/login", (req, res) => {
        let { emailAddress, password } = req.body;
        if(emailAddress.indexOf("prime") > 0) {
            handleRequest(verifyPrimeAdminCredentials, { client, emailAddress, password }, res);
        } else if(emailAddress.indexOf("admin") === 0) {
            handleRequest(authenticateAdminAccount, { client, emailAddress, password, addAdminSessionKey }, res);
        } else {
            handleRequest(authenticateUserAccount, { client, emailAddress, password }, res);
        }
    })
    .post("/add-playlist", (req, res) => {
        let { channelEmailAddress, playlistTitle, contentType } = req.body;
        handleRequest(addPlaylist, { client, channelEmailAddress, playlistTitle, contentType }, res);
    })
    .post("/get-playlists", (req, res) => {
        let { channelEmailAddress, contentType } = req.body;
        handleRequest(readPlaylists, { client, channelEmailAddress, contentType: Number(contentType) }, res);
    })
    .post("/upload-content", uploadFile.single("contentFile"), (req, res) => {
        let { contentTitle, contentType, channelEmailAddress, playlistTitle } = req.body,
        contentFile = req.file;
        handleRequest(writeContent, { client, contentTitle, contentType: Number(contentType), channelEmailAddress, playlistTitle, contentFile }, res);
    })
    .post("/get-contents", (req, res) => {
        let { channelEmailAddress, contentType, playlistTitle } = req.body;
        handleRequest(readContents, { client, channelEmailAddress, contentType, playlistTitle }, res);
    })
    .post("/subscribe", (req, res) => {
        let { emailAddress, channelEmailAddress } = req.body;
        handleRequest(addSubscription, { client, emailAddress, channelEmailAddress }, res);
    })
    .post("/unsubscribe", (req, res) => {
        let { emailAddress, channelEmailAddress } = req.body;
        handleRequest(removeSubscription, { client, emailAddress, channelEmailAddress }, res);
    })
    .post("/get-notifications", (req, res) => {
        let { emailAddress } = req.body;
        handleRequest(readNotifications, { client, emailAddress }, res);
    })
    .post("/delete-notification", (req, res) => {
        let { emailAddress, notificationText } = req.body;
        handleRequest(removeNotification, { client, emailAddress, notificationText }, res);
    })
    .post("/send-message", (req, res) => {
        let { senderEmailAddress, receiverEmailAddress, stringifiedMessage } = req.body;
        handleRequest(writeMessage, { client, senderEmailAddress, receiverEmailAddress, message: JSON.parse(stringifiedMessage) }, res);
    })
    .post("/get-messages", (req, res) => {
        let { senderEmailAddress, receiverEmailAddress } = req.body;
        handleRequest(readMessages, { client, senderEmailAddress, receiverEmailAddress }, res);
    })
    .post("/delete-message", (req, res) => {
        let { senderEmailAddress, receiverEmailAddress, messageText } = req.body;
        handleRequest(removeMessage, { client, senderEmailAddress, receiverEmailAddress, messageText }, res);
    })
    .post("/authenticate-prime-admin", uploadFile.single("primeAdminAuthFile"), (req, res) => {
        let primeAdminAuthFile = req.file;
        handleRequest(authenticatePrimeAdmin, { primeAdminAuthFile, setPrimeAdminSessionKey }, res);
    })
    .post("/get-random-contents", (req, res) => {
        let { contentType, amount } = req.body;
        handleRequest(readRandomContents, { client, contentType, amount }, res);
    })
    .post("/like", (req, res) => {
        let { contentTitle, emailAddress, contentType, channelEmailAddress, playlistTitle } = req.body;
        handleRequest(likeContent, { client, emailAddress, contentTitle, contentType, channelEmailAddress, playlistTitle }, res);
    })
    .post("/unlike", (req, res) => {
        let { contentTitle, emailAddress, contentType, channelEmailAddress, playlistTitle } = req.body;
        handleRequest(unlikeContent, { client, emailAddress, contentTitle, contentType, channelEmailAddress, playlistTitle }, res);
    })
    .post("/dislike", (req, res) => {
        let { contentTitle, emailAddress, contentType, channelEmailAddress, playlistTitle } = req.body;
        handleRequest(dislikeContent, { client, emailAddress, contentTitle, contentType, channelEmailAddress, playlistTitle }, res);
    })
    .post("/undislike", (req, res) => {
        let { contentTitle, emailAddress, contentType, channelEmailAddress, playlistTitle } = req.body;
        handleRequest(undislikeContent, { client, emailAddress, contentTitle, contentType, channelEmailAddress, playlistTitle }, res);
    })
    .post("/get-comments", (req, res) => {
        let { contentTitle, contentType, playlistTitle, channelEmailAddress } = req.body;
        handleRequest(getComments, { contentTitle, contentType, playlistTitle, channelEmailAddress }, res);
    })
    .post("/send-comment", (req, res) => {
        let { contentTitle, contentType, playlistTitle, channelEmailAddress, stringifiedComment } = req.body;
        handleRequest(writeComment, { client, contentTitle, contentType, playlistTitle, channelEmailAddress, comment: JSON.parse(stringifiedComment) }, res);
    })
    .get("/profile-picture/*", (req, res, next) => {
        handleRequest(getProfilePicture, { client, emailAddress: req.url.substring(req.url.lastIndexOf("/") + 1) }, res, true)
    })
    .post("/get-subscribees", (req, res) => {
        let {emailAddress} = req.body;
        handleRequest(readSubscriptions, { client, emailAddress }, res);
    })
    .post("/get-playlistless-content", (req, res) => {
        let {channelEmailAddress, contentType} = req.body;
        handleRequest(readPlaylistlessContents, { client, channelEmailAddress, contentType }, res);
    })
    .post("/get-channel", (req, res) => {
        let {emailAddress} = req.body;
        handleRequest(getChannel, { client, emailAddress }, res);
    })
    .post("/delete-playlist", (req, res) => {
        let {channelEmailAddress, contentType, playlistTitle} = req.body;
        handleRequest(removePlaylist, { client, channelEmailAddress, contentType, playlistTitle }, res);
    })
    .post("/delete-all-playlists", (req, res) => {
        let {channelEmailAddress, contentType} = req.body;
        handleRequest(removeAllPlaylists, {client, channelEmailAddress, contentType}, res);
    })
    .post("/delete-content", (req, res) => {
        let { id, title, type, channelEmailAddress, playlistTitle } = req.body;
        handleRequest(removeContent, { client, id, title, type, channelEmailAddress, playlistTitle }, res);
    })
    .post("/delete-all-playlistless-contents", (req, res) => {
        let {channelEmailAddress, contentType} = req.body;
        handleRequest(removeAllPlaylistlessContents, {client, channelEmailAddress, contentType}, res);
    })
    .post("/update-account", uploadFile.single("profilePicture"), (req, res) => {
        let { emailAddress, username, channelTitle } = req.body,
        profilePicture = req.file;
        handleRequest(updateUserAccount, { client, emailAddress, username, channelTitle, profilePicture }, res);
    })
    .get("/shorts/playlist-present/*", (req, res) => {
        let url = decodeURIComponent(req.url);//to avoid modifying request url
        let contentTitle = url.substring(url.lastIndexOf("/") + 1);
        url = url.substring(0, url.lastIndexOf("/"));
        let playlistTitle = url.substring(url.lastIndexOf("/") + 1);
        url = url.substring(0, url.lastIndexOf("/"));
        let channelEmailAddress = url.substring(url.lastIndexOf("/") + 1);
        handleRequest(streamContent, { client, contentTitle, playlistTitle, channelEmailAddress, contentType: CONTENT_TYPES.SHORT }, res, true, true);

    })
    .get("/shorts/*", (req, res) => {
        let url = decodeURIComponent(req.url);
        let contentTitle = url.substring(url.lastIndexOf("/") + 1);
        url = url.substring(0, url.lastIndexOf("/"));
        let channelEmailAddress = url.substring(url.lastIndexOf("/") + 1);
        handleRequest(streamContent, { client, contentTitle, channelEmailAddress, contentType: CONTENT_TYPES.SHORT }, res, true, true);})
    .get("/videos/playlist-present/*", (req, res) => {
        let url = decodeURIComponent(req.url);//to avoid modifying request url
        let contentTitle = url.substring(url.lastIndexOf("/") + 1);
        url = url.substring(0, url.lastIndexOf("/"));
        let playlistTitle = url.substring(url.lastIndexOf("/") + 1);
        url = url.substring(0, url.lastIndexOf("/"));
        let channelEmailAddress = url.substring(url.lastIndexOf("/") + 1);
        handleRequest(streamContent, { client, contentTitle, playlistTitle, channelEmailAddress, contentType: CONTENT_TYPES.VIDEO }, res, true, true);

    })
    .get("/videos/*", (req, res) => {
        let url = decodeURIComponent(req.url);
        let contentTitle = url.substring(url.lastIndexOf("/") + 1);
        url = url.substring(0, url.lastIndexOf("/"));
        let channelEmailAddress = url.substring(url.lastIndexOf("/") + 1);
        handleRequest(streamContent, { client, contentTitle, channelEmailAddress, contentType: CONTENT_TYPES.VIDEO }, res, true, true);})
    
    //</FOR_UI_CUSTOMISATION_IN_CSS>
    .get("/ui-fac.html", (req, res) => {
        res.sendFile(join(__dirname, "public", "ui-fac.html"))
    })
    .get("/ui-fac", (req, res) => {
        res.sendFile(join(__dirname, "public", "ui-fac.html"))
    })
    .get("/anville-tube.css", (req, res) => {
        res.sendFile(join(__dirname, "public", "anville-tube.css"))
    })
    .get("/images/miscellanious.png", (req, res) => {
        res.sendFile(join(__dirname, "public", "images", "miscellanious.png"))
    })
    .get("/func-test.js", (req, res) => {
        res.sendFile(join(__dirname, "public", "func-test.js"));
    })
    .get("/anville-tube-react/src/util/*", (req, res) => {
        res.sendFile(join(__dirname, "anville-tube-react", "src", "util", req.url.substring(req.url.lastIndexOf("/") + 1)));
    })
    .get("/func-test.html", (req, res) => {
        res.sendFile(join(__dirname, "public", "func-test.html"));
    })
    //</FOR_UI_CUSTOMISATION_IN_CSS>
    .use(serveStatic(join(__dirname, "anville-tube-react", "build")))
    .use(cookieParser())
    /*
    //ENSURING LEGITIMACY OF auth COOKIE
    .get("/dashboard", (req, res, next) => {
        let {emailAddress, password} = req.cookies.auth ? JSON.parse(req.cookies.auth) : {};
        authenticateUserAccount({client, emailAddress, password})
        .then(() => next())
        .catch(e => {
            res.writeHead(301, { "Clear-Cookie": "auth", "Location": "/" });
            res.end();
        })
    })
    */
    .get("*", (req, res) => {
        res.sendFile(join(__dirname, "anville-tube-react", "build", "index.html"));
    })
    .listen(PORT_NUMBER, () => {
        console.log("--------------------------------------------");
        console.log("anville-tube SERVER RUNNING ON PORT: " + PORT_NUMBER);
        console.log("--------------------------------------------");
    });

const ADMIN_COMMANDS = {
    ADD_ADMIN: "create-admin",
    BAN_ADMIN: "ban-admin",
    UNBAN_ADMIN: "unban-admin",
    DELETE_ADMIN: "delete-admin",
    BAN_USER: "ban-user",
    UNBAN_USER: "unban-user",
    DELETE_USER: "delete-user",
    SEARCH_VIDEOS: "search-videos",
    SEARCH_SHORTS: "search-shorts",
    HIDE_CONTENT: "hide-content",
    UNHIDE_CONTENT: "unhide-content"
}

//Socket for Admins
socketIO(app)
    .on("connection", socket => {
        socket.emit("connection");
        socket.on("adminAuthData", adminAuthDataString => {
            let adminAuthData = JSON.parse(adminAuthDataString);
            console.log({adminAuthData, adminsSessionKeys: sessionKeys.adminsSessionKeys})
            if(sessionKeys.adminsSessionKeys.indexOf(adminAuthData.key) < 0 && adminAuthData.key !== sessionKeys.primeAdminSessionKey) {
                socket.emit("adminAuthDataNotApproved");
                socket.disconnect(true);
            } else {
                addAdminSocketId(socket.id, adminAuthData);
                socket.emit("adminAuthDataApproved");
            }
        })
        .on(ADMIN_COMMANDS.ADD_ADMIN,  admin => {
            handleSocketCommand(ADMIN_COMMANDS.ADD_ADMIN, addAdminAccount, { client, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, authPrimeAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, admin }, socket);
        })
        .on(ADMIN_COMMANDS.BAN_ADMIN, emailAddress => {
            handleSocketCommand(ADMIN_COMMANDS.BAN_ADMIN, banAdminAccount, { client, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, authPrimeAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, emailAddress }, socket);
        })
        .on(ADMIN_COMMANDS.UNBAN_ADMIN, emailAddress => {
            handleSocketCommand(ADMIN_COMMANDS.UNBAN_ADMIN, unBanAdminAccount, { client, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, authPrimeAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, emailAddress }, socket);
        })
        .on(ADMIN_COMMANDS.DELETE_ADMIN, emailAddress => {
            handleSocketCommand(ADMIN_COMMANDS.DELETE_ADMIN, deleteAdminAccount, { client, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, authPrimeAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, emailAddress }, socket);
        })
        .on(ADMIN_COMMANDS.BAN_USER, emailAddress => {
            handleSocketCommand(ADMIN_COMMANDS.BAN_USER, banUser, { client, emailAddress, adminAuthData: { authAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, adminsSessionKeys: sessionKeys.adminsSessionKeys } }, socket);
        })
        .on(ADMIN_COMMANDS.UNBAN_USER, emailAddress => {
            handleSocketCommand(ADMIN_COMMANDS.UNBAN_USER, unBanUser, { client, emailAddress, adminAuthData: { authAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, adminsSessionKeys: sessionKeys.adminsSessionKeys } }, socket);
        })
        .on(ADMIN_COMMANDS.DELETE_USER, emailAddress => {
            handleSocketCommand(ADMIN_COMMANDS.DELETE_USER, deleteUser, { client, emailAddress, adminAuthData: { authAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, adminsSessionKeys: sessionKeys.adminsSessionKeys } }, socket);
        })
        .on(ADMIN_COMMANDS.HIDE_CONTENT, content => {
            handleSocketCommand(ADMIN_COMMANDS.HIDE_CONTENT, hide, { data: { client, ...content }, adminAuthData: { authAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, adminsSessionKeys: sessionKeys.adminsSessionKeys } }, socket);
        })
        .on(ADMIN_COMMANDS.UNHIDE_CONTENT, content => {
            handleSocketCommand(ADMIN_COMMANDS.UNHIDE_CONTENT, unHide, { data: { client, ...content }, adminAuthData: { authAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, adminsSessionKeys: sessionKeys.adminsSessionKeys } }, socket);
        })
        .on(ADMIN_COMMANDS.SEARCH_VIDEOS, data => {
            handleSocketCommand(ADMIN_COMMANDS.SEARCH_VIDEOS, searchVideosForAdmin, { data: {...data, client}, adminAuthData: { authAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, adminsSessionKeys: sessionKeys.adminsSessionKeys } }, socket);
        })
        .on(ADMIN_COMMANDS.SEARCH_SHORTS, data => {
            handleSocketCommand(ADMIN_COMMANDS.SEARCH_SHORTS, searchShortsForAdmin, { data: {...data, client}, adminAuthData: { authAdminSessionKey: sessionKeys.adminSocketIds[socket.id].key, primeAdminSessionKey: sessionKeys.primeAdminSessionKey, adminsSessionKeys: sessionKeys.adminsSessionKeys } }, socket);
        })
        .on("disconnect", () => {
            removeAdminSessionKey(removeAdminSocketId(socket.id));
        })
    })

async function handleRequest(operation, parameters, res, isResponsePipable, isResponseVideo, next) {
    try {
        let response = await operation(parameters);
        if(typeof response === "object" && !isResponsePipable) {
            response = JSON.stringify(response);
        }
        if(isResponseVideo) {
            let { dataType, size, buffer } = response;
            res.writeHead(200, { "Content-Length": size, "Content-Type": "video/" + dataType });
            Readable.from(buffer).pipe(res);
        } else {
            res.writeHead(200, { "Content-Type": "text/plain" });
            if(isResponsePipable) {
                Readable.from(response).pipe(res);
                if(next) {next();}
            } else {
                if(next) {
                    res.send(response);
                    next();
                } else {
                    res.end(response);
                }
            }
        }
    } catch(error) {
        console.log(error);
        res.writeHead(500, { "Content-Type": "text/plain" });
        if(error.errorCode) {
            res.end(stringifyError(error));
        } else {
            res.end(stringifyError(new Error("Something went wrong. For DEV(anville): [" + error.message + "]")));
        }
    }
}

async function handleSocketCommand(command, operation, parameters, socket) {
    try {
        socket.emit(command + ADMIN_RESPONSE_SUFFIX, await operation(parameters));
    } catch(error) {
        console.log(error);//for debugging
        socket.emit(command + ADMIN_ERROR_SUFFIX, stringifyError(error));
    }
 }

let client;//DB client

connectToDBServer()
.then(returnedClient => {
    client = returnedClient;
})

let sessionKeys = {
    primeAdminSessionKey: "",
    adminsSessionKeys: [],
    adminSocketIds: {} /*{ socketId: key }*/
}

function setPrimeAdminSessionKey(key) {
    sessionKeys.primeAdminSessionKey = key;
}

function addAdminSessionKey(key) {
    sessionKeys.adminsSessionKeys.push(key);
}

function removeAdminSessionKey(key) {
    sessionKeys.adminsSessionKeys = sessionKeys.adminsSessionKeys.filter(adminSessionKey => adminSessionKey !== key);
}

function addAdminSocketId(socketId, adminAuthData) {
    sessionKeys.adminSocketIds[socketId] = adminAuthData;
}

function removeAdminSocketId(socketId) {
    if(sessionKeys.adminSocketIds[socketId]) {
        let key = sessionKeys.adminSocketIds[socketId].key;
        delete sessionKeys.adminSocketIds[socketId];
        return key;
    }
}
