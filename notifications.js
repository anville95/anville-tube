const { readOne, updateOne } = require("./db-utils.js"),
      NOTIFICATION_ACTIONS = {
        watchVideo: 0,
        watchShort: 1
      },
      COLLECTION = "users";

function User(emailAddress) {
    //JUST A USER FOR QUERY. REQUIRING AUTH WOULD CAUSE CIRCULAR DEPENDENCY
    this.emailAddress = emailAddress;
}

function Notification(text, action, address, state) {
    this.text = text;
    this.action = action;
    if(address) { this.address = address; }
    if(state) { this.state = state; }
}

async function pushNotification(client, emailAddress, notification) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountNotFound, "The account from which unsubscription is to be made does not exist!");
    }
    await updateOne(client, COLLECTION, new User(emailAddress), { $push: { notifications: notification } });
}

async function readNotifications({ client, emailAddress }) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountNotFound, "The account from which unsubscription is to be made does not exist!");
    }
    return user.notifications;
}

async function removeNotification({ client, emailAddress, notificationText }) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountNotFound, "The account from which unsubscription is to be made does not exist!");
    }
    await updateOne(client, COLLECTION, new User(emailAddress), { $pull: { notifications: { text: notificationText } } });
}

module.exports = {
    NOTIFICATION_ACTIONS,
    Notification,
    pushNotification,
    readNotifications,
    removeNotification
}