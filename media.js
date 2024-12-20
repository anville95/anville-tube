const { Binary, ObjectId } = require("mongodb"),
      { readFile, unlink, stat } = require("fs/promises"),
      { createReadStream } = require("fs"),
      { readOne, writeOne, updateOne, findOneAndUpdate, readMany, deleteOne, getSample, deleteMany } = require("./db-utils.js"),
      { Notification, pushNotification, NOTIFICATION_ACTIONS } = require("./notifications.js"),
      COLLECTION = "channels",
      SHORTS_CHUNKS_COLLECTION = "content-chunks.shorts",
      VIDEOS_CHUNKS_COLLECTION = "content-chunks.videos",
      CATALOGUE_COLLECTION = "catalogue",
      DEFAULT_CONTENTS_COLLECTION = "default_contents",
      CONTENT_TYPES = {
        VIDEO: 1,
        SHORT: 2
      },
      CONTENT_CHUNK_SIZE = 9437184
      ,
      CATALOGUE_ELEMENT_TYPES = {
        VIDEO: "video",
        SHORT: "short",
        PLAYLIST: "playlist",
        CHANNEL: "channel"
      },
      MEDIA_ERROR_CODES = {
        channelNotFoundError: 4,
        playlistNotFoundError: 5,
        invalidCatalogueTypeError: 6,
        invalidCreateCatalogueElementParameters: 7,
        channelAlreadyExistsError: 8
      },
    CHANNEL_STATES = {
        UNBANNED: 1,
        BANNED: 2
    },
    CONTENT_STATES = {
        UNHIDDEN: 1,
        HIDDEN: 2
    },
    DEFAULT_CONTENT_IDS = {
        defaultProfilePictures: "default-profile-pictures"
    };

function Content(title, id, type=CONTENT_TYPES.VIDEO, dataType, size, channelEmailAddress, views=0, likes=0, dislikes=0, comments=[], dateUploaded = new Date().toLocaleDateString(), playlistTitle, state=CONTENT_STATES.UNHIDDEN) {
    this.title = title;
    this.id = id;
    this.type = type;
    this.dataType = dataType;
    this.size = size;
    this.channelEmailAddress = channelEmailAddress;
    this.views = views;
    this.likes = likes;
    this.dislikes = dislikes;
    this.comments = comments;
    this.dateUploaded = dateUploaded;
    if(playlistTitle){ this.playlistTitle = playlistTitle;}
    this.state = state;
}

function Comment(id, senderHandle, text, time = new Date().toLocaleDateString()) {
    this.id = id;
    this.senderHandle = senderHandle;
    if(text) {
        this.text = text;
        this.time = time;
    }
}

function ContentChunk(contentId, data, index) {
    this.contentId = contentId;
    if(data) { this.data = data; }
    if(index) { this.index = index; }
}

function Channel(channelEmailAddress, channelHandle, title, playlists, channelState, subscribers, videos, shorts) {
    this.channelEmailAddress = channelEmailAddress;
    if(channelHandle) { this.channelHandle = channelHandle; }
    if(title) { this.title = title; }
    if(playlists) { this.playlists = playlists; }
    if(channelState) { this.channelState = channelState; }
    if(subscribers) { this.subscribers = subscribers; }
    if(videos) { this.videos = videos }
    if(shorts) { this.shorts = shorts }
}

function Playlist(title, contentType, contents) {
    this.title = title;
    if(contentType) { this.contentType = contentType; }
    if(contents) { this.contents = contents; }
}

function CatalogueElement(key, type, address) {
    this.key = key;
    this.type = type;
    this.address = address;
}

function CatalogueAddress(channelEmailAddress, playlistTitle, contentType) {
    this.channelEmailAddress = channelEmailAddress;
    if(playlistTitle) { this.playlistTitle = playlistTitle };
    if(contentType) { this.contentType = contentType };
}

function DefaultContent(id, dataObject) {
    this.id = id;
    if(dataObject) {
        for(key in dataObject) {
            this[key] = dataObject[key];
        }
    }
}

function CreateMediaError(errorCode, errorMessage) {
    let error = new Error(errorMessage);
    error.errorCode = errorCode;
    return error;
}

async function addChannel(client, channelEmailAddress, channelTitle, channelHandle) {
    if(await readOne(client, COLLECTION, new Channel(channelEmailAddress))) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelAlreadyExistsError, "A channel with the same email address already exists. One can have only one channel!");
    }
    let channel = new Channel(channelEmailAddress, channelHandle, channelTitle, {shorts: [], videos: []}, CHANNEL_STATES.UNBANNED, [], [], []);
    await writeOne(client, COLLECTION, channel);
}

async function updateChannel(client, channelEmailAddress, channelTitle) {
    if(!await readOne(client, COLLECTION, new Channel(channelEmailAddress))) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel which you seek to update does not exist!");
    }
    await updateOne(client, COLLECTION, new Channel(channelEmailAddress), { $set: { title: channelTitle } });
}

async function searchChannels({client, channelEmailAddress}) {
    return searchCatalogueElements(client, channelEmailAddress, CATALOGUE_ELEMENT_TYPES.CHANNEL).map(resultCatalogueElement => getDBElementFromCatalogueElement(resultCatalogueElement));
}

async function banChannel(client, channelEmailAddress) {
    if(!await readOne(client, COLLECTION, new Channel(channelEmailAddress))) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel which you seek to ban does not exist!");
    }
    await updateOne(client, COLLECTION, new Channel(channelEmailAddress), { $set: { channelState: CHANNEL_STATES.BANNED } });
}

async function unBanChannel(client, channelEmailAddress) {
    if(!await readOne(client, COLLECTION, new Channel(channelEmailAddress))) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel which you seek to unban does not exist!");
    }
    await updateOne(client, COLLECTION, new Channel(channelEmailAddress), { $set: { channelState: CHANNEL_STATES.UNBANNED } });
}

async function removeChannel(client, channelEmailAddress) {
    if(!await readOne(client, COLLECTION, new Channel(channelEmailAddress))) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel which you seek to delete does not exist!");
    }
    await deleteOne(client, COLLECTION, new Channel(channelEmailAddress));
}

async function getChannel({client, emailAddress}) {
    let channel = await readOne(client, COLLECTION, new Channel(emailAddress));
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel which you seek to retrieve does not exist!");
    }
    return channel;
}

async function addPlaylist({client, channelEmailAddress, playlistTitle, contentType}) {
    let channelQuery = new Channel(channelEmailAddress),
        playlist = new Playlist(playlistTitle, contentType, []);
    if(contentType === CONTENT_TYPES.VIDEO) {
        await updateOne(client, COLLECTION, channelQuery, { $push: { "playlists.videos": playlist } });
    } else {
        await updateOne(client, COLLECTION, channelQuery, { $push: { "playlists.shorts": playlist } });
    }
    await insertCatalogueElement({ client, title: playlistTitle, contentType, channelEmailAddress });
}

async function readPlaylists({client, channelEmailAddress, contentType}) {
    let channelQuery = new Channel(channelEmailAddress);
    if(contentType === CONTENT_TYPES.VIDEO) {
        return (await readOne(client, COLLECTION, channelQuery)).playlists.videos;
    } else {
        return (await readOne(client, COLLECTION, channelQuery)).playlists.shorts;
    }
}

async function searchPlaylists({client, playlistTitle}) {
    let resultPlaylists = [],
    resultCatalogueElements = await searchCatalogueElements(client, playlistTitle, CATALOGUE_ELEMENT_TYPES.PLAYLIST);
    for(let catalogueElement of resultCatalogueElements) {
        resultPlaylists[resultPlaylists.length] = getDBElementFromCatalogueElement({ client, ...catalogueElement });
    }
    return resultPlaylists;
}

async function removePlaylist({client, channelEmailAddress, contentType, playlistTitle}) {
    let channelQuery = new Channel(channelEmailAddress),
        playlist = new Playlist(playlistTitle);
    if(contentType === CONTENT_TYPES.VIDEO) {
        await updateOne(client, COLLECTION, channelQuery, { $pull: { "playlists.videos": playlist } });
    } else {
        await updateOne(client, COLLECTION, channelQuery, { $pull: { "playlists.shorts": playlist } });
    }
    await removeCatalogueElement({ client, title: playlistTitle, contentType, channelEmailAddress });
}

async function removeAllPlaylists({client, channelEmailAddress, contentType}) {
    let channelQuery = new Channel(channelEmailAddress),
        playlists = (await readOne(client, COLLECTION, channelQuery)).playlists[contentType===CONTENT_TYPES.VIDEO?"videos":"shorts"];
    if(contentType === CONTENT_TYPES.VIDEO) {
        await updateOne(client, COLLECTION, channelQuery, { $set: { "playlists.videos": [] } });
    } else {
        await updateOne(client, COLLECTION, channelQuery, { $set: { "playlists.shorts": [] } });
    }
    for(const playlist of playlists) {
        let {playlistTitle, contentType, channelEmailAddress} = playlist;
        await removeCatalogueElement({ client, title: playlistTitle, contentType, channelEmailAddress });
    }
}

async function writeContent({client, contentTitle, contentFile, contentType, channelEmailAddress, playlistTitle}){
    let channel = await readOne(client, COLLECTION, new Channel(channelEmailAddress));
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "You have not created a channel yet!");
    }
    let contentId = channelEmailAddress + (new ObjectId()).toString();
    let {dataType, size} = await getContentData(contentFile),
    chunks = await getChunks(contentFile.path, true);
    let collection = contentType === CONTENT_TYPES.VIDEO ? VIDEOS_CHUNKS_COLLECTION : SHORTS_CHUNKS_COLLECTION;
    for(let i = 0; i < chunks.length; i++) {
        await writeOne(client, collection, new ContentChunk(contentId, chunks[i], i))
    }

    let content = new Content(contentTitle, contentId, contentType, dataType, size, channelEmailAddress, [], [], [], [], undefined, playlistTitle),
    channelQuery = new Channel(channelEmailAddress);
    if(contentType === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            await findOneAndUpdate(client, COLLECTION, channelQuery, { $push: { "playlists.videos.$[p].contents": content } }, { arrayFilters: [ { "p.title": playlistTitle } ], upsert: true, "new": true });
        } else {
            await updateOne(client, COLLECTION, channelQuery, { $push: { videos: content } });
        }
    } else {
        if(playlistTitle) {
            await findOneAndUpdate(client, COLLECTION, channelQuery, { $push: { "playlists.shorts.$[p].contents": content } }, { arrayFilters: [ { "p.title": playlistTitle } ], upsert: true, "new": true });
        } else {
            await updateOne(client, COLLECTION, channelQuery, { $push: { shorts: content } });
        }
    }
    await insertCatalogueElement({ client, title: contentTitle, type: contentType, channelEmailAddress, playlistTitle });
    await notifySubscribers(client, channelEmailAddress, new Notification(channel.title + "Has uploaded new " + (contentType === CONTENT_TYPES.VIDEO ? "video": "short") + "; " + contentTitle, contentType === CONTENT_TYPES.VIDEO ? NOTIFICATION_ACTIONS.watchVideo : NOTIFICATION_ACTIONS.watchShort, new CatalogueAddress(channelEmailAddress, playlistTitle, contentType)));
}

async function removeContent({client, id, title, type, channelEmailAddress, playlistTitle}) {
    let channel = await readOne(client, COLLECTION, new Channel(channelEmailAddress));
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "You have not created a channel yet!");
    }
    
    if(playlistTitle) {
        if(type===CONTENT_TYPES.VIDEO) {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "playlists.videos.$[p].contents": {id} } }, { arrayFilters: [ {"p.title": playlistTitle} ] } );
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "playlists.shorts.$[p].contents": {id} } }, { arrayFilters: [ {"p.title": playlistTitle} ] } );
        }
    } else {
        if(type===CONTENT_TYPES.VIDEO) {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "videos": {id} } } );
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "shorts": {id} } } );
        }
    }

    await deleteMany(client, type===CONTENT_TYPES.VIDEO?VIDEOS_CHUNKS_COLLECTION:SHORTS_CHUNKS_COLLECTION, new ContentChunk(id));
    await removeCatalogueElement({ client, title, type, channelEmailAddress, playlistTitle });
}

async function removeAllPlaylistlessContents({channelEmailAddress, contentType}) {
    let channel = await readOne(client, COLLECTION, new Channel(channelEmailAddress));
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "You have not created a channel yet!");
    }
    if(type===CONTENT_TYPES.VIDEO) {
        await updateOne(client, COLLECTION, new channelQuery(channelEmailAddress), { $set: { "videos": [] } }, { arrayFilters: [ {"c.id": id} ] } );
    } else {
        await updateOne(client, COLLECTION, new channelQuery(channelEmailAddress), { $set: { "shorts": [] } }, { arrayFilters: [ {"c.id": id} ] } );
    }

    for(const content of channel[contentType===CONTENT_TYPES.VIDEO?"videos":"shorts"]) {
        await removeCatalogueElement({client, ...content});
    }
}

async function readContents({client, channelEmailAddress, contentType, playlistTitle}) {
    let channelQuery = new Channel(channelEmailAddress);
    if(contentType === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            return (await readOne(client, COLLECTION, channelQuery)).playlists.videos.filter(videosPlaylist => videosPlaylist.title === playlistTitle)[0].contents;
        } else {
            return (await readOne(client, COLLECTION, channelQuery)).videos;
        }
    } else {
        if(playlistTitle) {
            return (await readOne(client, COLLECTION, channelQuery)).playlists.shorts.filter(shortsPlaylist => shortsPlaylist.title === playlistTitle)[0].contents;
        } else {
            return (await readOne(client, COLLECTION, channelQuery)).shorts;
        }
    }
}

async function streamContent({client, contentTitle, contentType, channelEmailAddress, playlistTitle}) {
    let { dataType, size, id } = playlistTitle ? (await readOne(client, COLLECTION, new Channel(channelEmailAddress))).playlists[contentType===CONTENT_TYPES.VIDEO?"videos":"shorts"].filter(playlist => playlist.title === playlistTitle)[0].contents.filter(content => content.title===contentTitle)[0] : (await readOne(client, COLLECTION, new Channel(channelEmailAddress)))[contentType===CONTENT_TYPES.VIDEO?"videos":"shorts"].filter(content => content.title===contentTitle)[0];
    return {
        dataType,
        size,
        buffer: Buffer.concat((await readMany(client, contentType===CONTENT_TYPES.VIDEO?VIDEOS_CHUNKS_COLLECTION:SHORTS_CHUNKS_COLLECTION , { contentId: id })).sort((a, b) => a.index - b.index).map(chunkObject => chunkObject.data.buffer))
    }
}

async function readPlaylistlessContents({ client, channelEmailAddress, contentType }) {
    let channel = await readOne(client, COLLECTION, {channelEmailAddress});
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel whose playlistless content is sought does not exist!");
    }
    return contentType === CONTENT_TYPES.VIDEO ? channel.videos : channel.shorts;
}

async function hideContent({ client, title, type, channelEmailAddress, playlistTitle }) {
    if(type === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $set: { "playlists.videos.$[p].contents.$[c].state": CONTENT_STATES.HIDDEN } }, { arrayFilters: [{"p.title": playlistTitle}, {"c.title": title}], upsert: true, new: true });
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $set: { "videos.$[c].state": CONTENT_STATES.HIDDEN } }, { arrayFilters: [{"c.title": title}], upsert: true, new: true });
        }
    } else {
        if(playlistTitle) {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $set: { "playlists.shorts.$[p].contents.$[c].state": CONTENT_STATES.HIDDEN } }, { arrayFilters: [{"p.title": playlistTitle}, {"c.title": title}], upsert: true, new: true });
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $set: { "shorts.$[c].state": CONTENT_STATES.HIDDEN } }, { arrayFilters: [{"c.title": title}], upsert: true, new: true });
        }
    }
}

async function unHideContent({ client, title, type, channelEmailAddress, playlistTitle }) {
    if(type === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            await updateOne(client, COLLECTION, new Channel(channelEmailAddress), { $set: { "playlists.videos.$[p].contents.$[c].state": CONTENT_STATES.UNHIDDEN } }, { arrayFilters: [{"p.title": playlistTitle}, {"c.title": title}], upsert: true, new: true });
        } else {
            await updateOne(client, COLLECTION, new Channel(channelEmailAddress), { $set: { "videos.$[c].state": CONTENT_STATES.UNHIDDEN } }, { arrayFilters: [{"c.title": title}], upsert: true, new: true });
        }
    } else {
        if(playlistTitle) {
            await updateOne(client, COLLECTION, new Channel(channelEmailAddress), { $set: { "playlists.shorts.$[p].contents.$[c].state": CONTENT_STATES.UNHIDDEN } }, { arrayFilters: [{"p.title": playlistTitle}, {"c.title": title}], upsert: true, new: true });
        } else {
            await updateOne(client, COLLECTION, new Channel(channelEmailAddress), { $set: { "shorts.$[c].state": CONTENT_STATES.UNHIDDEN } }, { arrayFilters: [{"c.title": title}], upsert: true, new: true });
        }
    }
}

async function writeComment({ client, contentTitle, contentType, channelEmailAddress, playlistTitle, comment }) {
    if(contentType === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: {"playlists.videos.$[p].contents.$[c].comments": comment} }, { arrayFilters: [ { "p.title": playlistTitle }, { "c.title": contentTitle } ], upsert: true, "new": true });
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "videos.$[c].comments": comment } }, { arrayFilters: [ { "c.title": contentTitle } ], upsert: true, "new": true })
        }
    } else {
        if(playlistTitle) {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: {"playlists.shorts.$[p].contents.$[c].comments": comment} }, { arrayFilters: [ { "p.title": playlistTitle }, { "c.title": contentTitle } ], upsert: true, "new": true });
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "shorts.$[c].comments": comment } }, { arrayFilters: [ { "c.title": contentTitle } ], upsert: true, "new": true })
        }
    }
}

async function readComments({ client, contentTitle, contentType, channelEmailAddress, playlistTitle }) {
    return await getDBElementFromCatalogueElement(new CatalogueElement(contentTitle, contentType===CONTENT_TYPES.VIDEO?CATALOGUE_ELEMENT_TYPES.VIDEO:CATALOGUE_ELEMENT_TYPES.SHORT, new CatalogueAddress(channelEmailAddress, playlistTitle, contentType))).comments;
}

async function searchComments({ client, contentTitle, contentType, channelEmailAddress, playlistTitle, key }) {
    return (await readComments({ client, contentTitle, contentType, channelEmailAddress, playlistTitle })).filter(comment => comment.text.indexOf(key) >= 0);
}

async function likeContent({ client, emailAddress, contentTitle, contentType, channelEmailAddress, playlistTitle }) {
    if(contentType === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            (await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "playlists.videos.$[p].contents.$[c].likes": emailAddress } }, { arrayFilters: [ {"p.title": playlistTitle}, {"c.title": contentTitle} ], upsert: true, "new": true }));
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "videos.$[c].likes": emailAddress } }, { arrayFilters: [ {"c.title": contentTitle} ], upsert: true, "new": true });
        }
    } else {
        if(playlistTitle) {
            (await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "playlists.shorts.$[p].contents.$[c].likes": emailAddress } }, { arrayFilters: [ {"p.title": playlistTitle}, {"c.title": contentTitle} ], upsert: true, "new": true }));
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "shorts.$[c].likes": emailAddress } }, { arrayFilters: [ {"c.title": contentTitle} ], upsert: true, "new": true });
        }
    }
}

async function unlikeContent({ client, emailAddress, contentTitle, contentType, channelEmailAddress, playlistTitle }) {
    if(contentType === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            (await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "playlists.videos.$[p].contents.$[c].likes": emailAddress } }, { arrayFilters: [ {"p.title": playlistTitle}, {"c.title": contentTitle} ], upsert: true, "new": true }));
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "videos.$[c].likes": emailAddress } }, { arrayFilters: [ {"c.title": contentTitle} ], upsert: true, "new": true });
        }
    } else {
        if(playlistTitle) {
            (await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "playlists.shorts.$[p].contents.$[c].likes": emailAddress } }, { arrayFilters: [ {"p.title": playlistTitle}, {"c.title": contentTitle} ], upsert: true, "new": true }));
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "shorts.$[c].likes": emailAddress } }, { arrayFilters: [ {"c.title": contentTitle} ], upsert: true, "new": true });
        }
    }
}

async function dislikeContent({ client, emailAddress, contentTitle, contentType, channelEmailAddress, playlistTitle }) {
    if(contentType === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            (await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "playlists.videos.$[p].contents.$[c].dislikes": emailAddress } }, { arrayFilters: [ {"p.title": playlistTitle}, {"c.title": contentTitle} ], upsert: true, "new": true }));
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "videos.$[c].dislikes": emailAddress } }, { arrayFilters: [ {"c.title": contentTitle} ], upsert: true, "new": true });
        }
    } else {
        if(playlistTitle) {
            (await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "playlists.shorts.$[p].contents.$[c].dislikes": emailAddress } }, { arrayFilters: [ {"p.title": playlistTitle}, {"c.title": contentTitle} ], upsert: true, "new": true }));
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $push: { "shorts.$[c].dislikes": emailAddress } }, { arrayFilters: [ {"c.title": contentTitle} ], upsert: true, "new": true });
        }
    }
}

async function undislikeContent({ client, emailAddress, contentTitle, contentType, channelEmailAddress, playlistTitle }) {
    if(contentType === CONTENT_TYPES.VIDEO) {
        if(playlistTitle) {
            (await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "playlists.videos.$[p].contents.$[c].dislikes": emailAddress } }, { arrayFilters: [ {"p.title": playlistTitle}, {"c.title": contentTitle} ], upsert: true, "new": true }));
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "videos.$[c].dislikes": emailAddress } }, { arrayFilters: [ {"c.title": contentTitle} ], upsert: true, "new": true });
        }
    } else {
        if(playlistTitle) {
            (await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "playlists.shorts.$[p].contents.$[c].dislikes": emailAddress } }, { arrayFilters: [ {"p.title": playlistTitle}, {"c.title": contentTitle} ], upsert: true, "new": true }));
        } else {
            await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "shorts.$[c].dislikes": emailAddress } }, { arrayFilters: [ {"c.title": contentTitle} ], upsert: true, "new": true });
        }
    }
}

async function searchContents(client, contentTitle, contentType) {
    let resultContents = [],
    resultCatalogueElements = await searchCatalogueElements(client, contentTitle, contentType === CONTENT_TYPES.VIDEO ? CATALOGUE_ELEMENT_TYPES.VIDEO : CATALOGUE_ELEMENT_TYPES.SHORT);
    for(let catalogueElement of resultCatalogueElements) {
        resultContents[resultContents.length] = await getDBElementFromCatalogueElement({ client, ...catalogueElement });
    }
    return resultContents;
}

async function searchContentsForAdmin(client, channelEmailAddress, key, contentType) {
    let resultContents = [],
    contentTypeName = contentType === CONTENT_TYPES.VIDEO ? "videos" : "shorts";
    let channel  = await readOne(client, COLLECTION, new Channel(channelEmailAddress));
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel whose " + (contentType===CONTENT_TYPES.VIDEO?"video":"short") + " content you seek to search does not exist!");
    }
    resultContents = channel[contentTypeName].filter(({title}) => (title.indexOf(key)>=0||key.indexOf(title)>=0));
    channel.playlists[contentTypeName].map(playlist => {
        resultContents = [...resultContents, ...playlist.contentfilter(({title}) => (title.indexOf(key)>=0||key.indexOf(title)>=0))]
    });
    return resultContents;
}

async function readRandomContents({ client, contentType, amount=20 }) {
    let catalogue = await readOne(client, CATALOGUE_COLLECTION, { catalogueId: "anville-tube-search-catalogue" });
    if(!catalogue) {
        catalogue = { catalogueId: "anville-tube-search-catalogue", data: { video: [], short: [], playlist: [], channel: [] } };
        await writeOne(client, CATALOGUE_COLLECTION, catalogue);
        return [];
    }
    let contentCatalogue = catalogue.data[contentType===CONTENT_TYPES.VIDEO?"video":"short"];
    let results = [],
    addedPositions = [];
    if(amount >= contentCatalogue.length) {
        contentCatalogue.map(content => { results.push(content) });
    } else {
        while(results.length < amount) {
            let randomIndex = new Date().getMilliseconds() % contentCatalogue.length;
            while(addedPositions.indexOf(randomIndex.toString()) >= 0) {
                randomIndex = new Date().getMilliseconds() % contentCatalogue.length;
            }
            results.push(contentCatalogue[randomIndex]);
            addedPositions.push(randomIndex.toString());
        }
    }
    for(let i = 0; i < results.length; i++) {
        results[i] = await getDBElementFromCatalogueElement({ client, ...results[i] });
    }
    return results;
}

async function insertCatalogueElement({ client, title, type, playlists, contentType, channelEmailAddress, playlistTitle }) {
    let catalogue = await readOne(client, CATALOGUE_COLLECTION, { catalogueId: "anville-tube-search-catalogue" });
    if(!catalogue) {
        catalogue = { catalogueId: "anville-tube-search-catalogue", data: { video: [], short: [], playlist: [], channel: [] } };
        await writeOne(client, CATALOGUE_COLLECTION, catalogue);
    }
    let updateObjectChild = {};
    updateObjectChild["data." + (type? (type===CONTENT_TYPES.VIDEO?"video":"short") : (playlists?"channel":"playlist"))] = createCatalogueElementFromDBElement({ title, type, playlists, contentType, channelEmailAddress, playlistTitle });
    await updateOne(client, CATALOGUE_COLLECTION, { catalogueId: "anville-tube-search-catalogue" }, { $push: updateObjectChild });
}

async function removeCatalogueElement({ client, title, type, playlists, contentType, channelEmailAddress, playlistTitle }) {
    let catalogue = await readOne(client, CATALOGUE_COLLECTION, { catalogueId: "anville-tube-search-catalogue" });
    if(!catalogue) {
        catalogue = { catalogueId: "anville-tube-search-catalogue", data: { video: [], short: [], playlist: [], channel: [] } };
        await writeOne(client, CATALOGUE_COLLECTION, catalogue);
        return;
    }
    let updateObjectChild = {};
    updateObjectChild["data." + (type? (type===CONTENT_TYPES.VIDEO?"video":"short") : (playlists?"channel":"playlist"))] = createCatalogueElementFromDBElement({ title, type, playlists, contentType, channelEmailAddress, playlistTitle });
    await updateOne(client, CATALOGUE_COLLECTION, { catalogueId: "anville-tube-search-catalogue" }, { $pull: updateObjectChild });
}

async function searchCatalogueElements(client, key, type) {
    let catalogue = await readOne(client, CATALOGUE_COLLECTION, { catalogueId: "anville-tube-search-catalogue" });
    if(type) {
        switch(type) {
            case CATALOGUE_ELEMENT_TYPES.VIDEO:
                return catalogue.data.video.filter((catalogueElement => compareSearchKeywords(catalogueElement.key, key)));
            case CATALOGUE_ELEMENT_TYPES.SHORT:
                return catalogue.data.short.filter((catalogueElement => compareSearchKeywords(catalogueElement.key, key)));
            case CATALOGUE_ELEMENT_TYPES.PLAYLIST:
                return catalogue.data.playlist.filter((catalogueElement => compareSearchKeywords(catalogueElement.key, key)));
            case CATALOGUE_ELEMENT_TYPES.CHANNEL:
                return catalogue.data.channel.filter((catalogueElement => compareSearchKeywords(catalogueElement.key, key)));
        }
    } else {
        let results = catalogue.data.video.filter((catalogueElement => compareSearchKeywords(catalogueElement.key, key)));
        results = [...results, ...catalogue.data.short.filter((catalogueElement => compareSearchKeywords(catalogueElement.key, key)))];
        results = [...results, ...catalogue.data.playlist.filter((catalogueElement => compareSearchKeywords(catalogueElement.key, key)))];
        results = [...results, ...catalogue.data.channel.filter((catalogueElement => compareSearchKeywords(catalogueElement.key, key)))];
        return results;
    }
}

function createCatalogueElementFromDBElement({ title, type, playlists, contentType, channelEmailAddress, playlistTitle }) {
    //videos and shorts
    if(type) {
        if(type === CONTENT_TYPES.VIDEO) {
            return new CatalogueElement(title, CATALOGUE_ELEMENT_TYPES.VIDEO, new CatalogueAddress(channelEmailAddress, playlistTitle));
        } else {
            return new CatalogueElement(title, CATALOGUE_ELEMENT_TYPES.SHORT, new CatalogueAddress(channelEmailAddress, playlistTitle));
        }
    //playlist
    } else if(contentType) {
        return new CatalogueElement(title, CATALOGUE_ELEMENT_TYPES.PLAYLIST, new CatalogueAddress(channelEmailAddress, title, contentType));
    //channel
    } else if(playlists){
        return new CatalogueElement(title, CATALOGUE_ELEMENT_TYPES.CHANNEL, new CatalogueAddress(channelEmailAddress));
    } else {
        throw CreateMediaError(MEDIA_ERROR_CODES.invalidCreateCatalogueElementParameters, "The parameters provided did not match any catalogue type!");
    }
}

async function getDBElementFromCatalogueElement({ client, key, type, address }) {
    switch(type) {
        case CATALOGUE_ELEMENT_TYPES.VIDEO:
            if(address.playlistTitle) {
                return (await readOne(client, COLLECTION, new Channel(address.channelEmailAddress))).playlists.videos.filter(playlist => playlist.title === address.playlistTitle)[0].contents.filter(videoContent => videoContent.title === key)[0];
            } else {
                return (await readOne(client, COLLECTION, new Channel(address.channelEmailAddress))).videos.filter(videoContent => videoContent.title === key)[0];
            }
        case CATALOGUE_ELEMENT_TYPES.SHORT:
            if(address.playlistTitle) {
                return (await readOne(client, COLLECTION, new Channel(address.channelEmailAddress))).playlists.shorts.filter(playlist => playlist.title === address.playlistTitle)[0].contents.filter(shortContent => shortContent.title === key)[0];
            } else {
                return (await readOne(client, COLLECTION, new Channel(address.channelEmailAddress))).shorts.filter(shortContent => shortContent.title === key)[0];
            }
        case CATALOGUE_ELEMENT_TYPES.PLAYLIST:
            if(address.contentType === CONTENT_TYPES.VIDEO) {
                return (await readOne(client, new Channel(address.channelEmailAddress))).playlists.videos.filter(playlist => playlist.title === address.playlistTitle)[0];
            } else {
                return (await readOne(client, new Channel(address.channelEmailAddress))).playlists.shorts.filter(playlist => playlist.title === address.playlistTitle)[0];
            }
        case CATALOGUE_ELEMENT_TYPES.CHANNEL:
            return await readOne(client, COLLECTION, new Channel(address.channelEmailAddress));
        default:
            throw CreateMediaError(MEDIA_ERROR_CODES.invalidCatalogueTypeError, "The type of the catalogue provided does not exist!");
    }
}

async function addSubscriber(client, channelEmailAddress, subscriberEmailAddress) {
    let channel = await readOne(client, COLLECTION, new Channel(channelEmailAddress));
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel unto which subscriber is to be added does not exist!");
    }
    await updateOne(client, COLLECTION, new Channel(channelEmailAddress), { $push: { subscribers: subscriberEmailAddress } });
}

async function removeSubscriber(client, channelEmailAddress, subscriberEmailAddress) {
    let channel = await readOne(client, COLLECTION, new Channel(channelEmailAddress));
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel from which subscriber is to be removed does not exist!");
    }
    await findOneAndUpdate(client, COLLECTION, new Channel(channelEmailAddress), { $pull: { "subscribers": subscriberEmailAddress } })
}

async function getSubscribers(client, channelEmailAddress) {
    let channel = await readOne(client, COLLECTION, new Channel(channelEmailAddress));
    if(!channel) {
        throw CreateMediaError(MEDIA_ERROR_CODES.channelNotFoundError, "The channel from which subscriber is to be removed does not exist!");
    }
    return channel.subscribers;
}

async function notifySubscribers(client, channelEmailAddress, notification) {
    for(let subscriber of await getSubscribers(client, channelEmailAddress)) {
        await pushNotification(client, subscriber, notification);
    }
}

function compareSearchKeywords(firstKeyword, secondKeyword) {
    let firstKeywordArray = firstKeyword.split(" "),
    secondKeywordArray = secondKeyword.split(" ");
    for(let i = 0; i < firstKeywordArray.length; i++) {
        for(let j = 0; j < secondKeywordArray.length; j++) {
            if(secondKeywordArray[j].indexOf(firstKeywordArray[i]) >= 0 || firstKeywordArray[i].indexOf(secondKeywordArray[j]) >= 0) {
                return true;
            }
        }
    }
    return false;
}

async function writeDefaultUserProfilePicture(client, buffer) {
    if(await readOne(client, DEFAULT_CONTENTS_COLLECTION, new DefaultContent(DEFAULT_CONTENT_IDS.defaultProfilePictures))) {
        await updateOne(client, DEFAULT_CONTENTS_COLLECTION, new DefaultContent(DEFAULT_CONTENT_IDS.defaultProfilePictures), { $set: { defalutUserProfilePicture: new Binary(buffer) } });
    } else {
        await writeOne(client, DEFAULT_CONTENTS_COLLECTION, new DefaultContent(DEFAULT_CONTENT_IDS.defaultProfilePictures, { defalutUserProfilePicture: new Binary(buffer) }));
    }
}

async function readDefaultUserProfilePicture(client) {
    return (await readOne(client, DEFAULT_CONTENTS_COLLECTION, new DefaultContent(DEFAULT_CONTENT_IDS.defaultProfilePictures))).defalutUserProfilePicture;
}

async function getContentData(contentFile) {
    return {
        dataType: contentFile.originalname.substring(contentFile.originalname.lastIndexOf(".") + 1),
        size: (await stat(contentFile.path)).size
    };
}

function getChunks(filepath, deleteFile ) {
    return new Promise((resolve, reject) => {
        let chunks = [];
        createReadStream(filepath, { highWaterMark: CONTENT_CHUNK_SIZE  })
        .on("data", chunk => {
            chunks[chunks.length] = new Binary(chunk);
        })
        .on("end", () => {
            if(deleteFile) { unlink(filepath); }
            resolve(chunks);
        })
        .on("error", error => {
            reject(error);
        })
    })
}

module.exports = {
    addChannel,
    updateChannel,
    searchChannels,
    banChannel,
    unBanChannel,
    removeChannel,
    getChannel,
    addPlaylist,
    removePlaylist,
    removeAllPlaylists,
    readPlaylists,
    searchPlaylists,
    CONTENT_TYPES,
    writeContent,
    removeContent,
    removeAllPlaylistlessContents,
    readContents,
    readPlaylistlessContents,
    likeContent,
    unlikeContent,
    dislikeContent,
    undislikeContent,
    hideContent,
    writeComment,
    readComments,
    searchComments,
    unHideContent,
    searchContentsForAdmin,
    searchContents,
    streamContent,
    addSubscriber,
    removeSubscriber,
    writeDefaultUserProfilePicture,
    readDefaultUserProfilePicture,
    readRandomContents
}