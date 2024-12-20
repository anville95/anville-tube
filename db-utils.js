const DB_SERVER_URL = "mongodb://127.0.0.1:27017",
      DB_NAME = "anville-tube",
      { MongoClient, Binary } = require("mongodb");


async function connectToDBServer() {
    let client = new MongoClient(DB_SERVER_URL);
    try {
        await client.connect();
        console.log("....................................................");
        console.log(DB_NAME + " DATABASE SERVER CONNECTED SUCCESSFULLY!");
        console.log("....................................................");
        return client;
    } catch(error) {
        console.log("......................................................");
        console.log("ERROR: " + DB_NAME + " DATABASE SERVER COULD NOT CONNECT!");
        console.log("......................................................");
        throw error;
    }
}

async function writeOne(client, collection, dataObject) {
    return await client.db(DB_NAME).collection(collection).insertOne(dataObject);
}

async function readOne(client, collection, filterObject, options) {
    return await client.db(DB_NAME).collection(collection).findOne(filterObject, options);
}

async function readMany(client, collection, filterObject, sortCriteria) {
    let cursor =  sortCriteria ? await client.db(DB_NAME).collection(collection).find(filterObject).sort(sortCriteria) : await client.db(DB_NAME).collection(collection).find(filterObject);
    let results = [];
    for await(const result of cursor) {
        results[results.length] = result;
    }
    return results;
}

async function updateOne(client, collection, filterObject, updateObject, options) {
    return await client.db(DB_NAME).collection(collection).updateOne(filterObject, updateObject, options);
}

async function findOneAndUpdate(client, collection, filterObject, updateObject, options) {
    return await client.db(DB_NAME).collection(collection).findOneAndUpdate(filterObject, updateObject, options);
}

async function readAll(client, collection) {
    let cursor = client.db(DB_NAME).collection(collection).find();
    let results = [];
    for await(const result of cursor) {
        results[results.length] = result;
    }
    return results;
}

async function deleteOne(client, collection, filterObject) {
    await client.db(DB_NAME).collection(collection).deleteOne(filterObject);
}

async function deleteMany(client, collection, filterObject) {
    await client.db(DB_NAME).collection(collection).deleteMany(filterObject);
}

async function getSample(client, collection, amount) {
    let cursor = client.db(DB_NAME).collection(collection).aggregate([{ $sample: {size: amount} }]);
    let results = [];
    for await(const result of cursor) {
        results.push(result);
    }
    return results;
}

module.exports = {
    connectToDBServer,
    writeOne,
    readOne,
    readMany,
    updateOne,
    findOneAndUpdate,
    readAll,
    deleteOne,
    deleteMany,
    getSample
}