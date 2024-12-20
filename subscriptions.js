const { readOne, updateOne } = require("./db-utils.js"),
      COLLECTION = "users",
      { addSubscriber, removeSubscriber } = require("./media.js"),
      { User } = require("./auth.js"),
      AUTH_ERROR_CODES = {
          accountNotFound: 1,
          passwordIncorrect: 2,
          accountAlreadyExists: 3
      };


function AuthError(errorCode, errorMessage) {
    this.errorCode = errorCode;
    this.errorMessage = errorMessage;
}

async function addSubscription({ client, emailAddress, channelEmailAddress }) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountNotFound, "The account from which subscription is to be made does not exist!");
    }
    await updateOne(client, COLLECTION, new User(emailAddress), { $push: { subscriptions: channelEmailAddress } });
    await addSubscriber(client, channelEmailAddress, emailAddress);
}

async function removeSubscription({ client, emailAddress, channelEmailAddress }) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountNotFound, "The account from which unsubscription is to be made does not exist!");
    }
    await updateOne(client, COLLECTION, new User(emailAddress), { $pull: { "subscriptions": channelEmailAddress } });
    await removeSubscriber(client, channelEmailAddress, emailAddress);
}

async function readSubscriptions({client, emailAddress}) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountNotFound, "The account from which unsubscription is to be made does not exist!");
    }
    return JSON.stringify(user.subscriptions?user.subscriptions:[]);
}

module.exports = {
    addSubscription,
    removeSubscription,
    readSubscriptions
}