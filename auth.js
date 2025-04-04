const COLLECTION = "users",
      { writeOne, readOne, updateOne, deleteOne, findOneAndUpdate } = require("./db-utils.js"),
      { sendEmail } = require("./mail.js"),
      { Binary } = require("mongodb"),
      { readFile, unlink } = require("fs").promises,
      { removeChannel, unBanChannel, banChannel, addChannel, updateChannel } = require("./media.js"),
      AUTH_ERROR_CODES = {
          accountNotFound: 1,
          passwordIncorrect: 2,
          accountAlreadyExists: 3
      },
      ACCOUNT_STATES = {
        UNBANNED: 1,
        BANNED: 2
      },
      USER_HANDLES_COLLECTION = "user_handles";
    
function User(emailAddress, handle, username, password, profilePicture, subscriptions, notifications) {
    this.emailAddress = emailAddress;
    if(handle) { this.handle = handle; }
    if(username){this.username = username;}
    if(password){this.password = password;}
    if(profilePicture){this.profilePicture = profilePicture;}
    if(subscriptions){this.subscriptions = subscriptions;}
    if(notifications){this.notifications = notifications;}
}

function AuthError(errorCode, errorMessage) {
    this.message = errorMessage;
    this.errorCode = errorCode;
}

function CreateAuthError(errorCode, errorMessage) {
    let error = new Error(errorMessage);
    error.errorCode = errorCode;
    return error;
}

async function createUserAccount({ client, emailAddress, username, password, profilePicture }) {
    let existingUser = await readOne(client, COLLECTION, new User(emailAddress));
    if(existingUser) {
        throw new AuthError(AUTH_ERROR_CODES.accountAlreadyExists, "An account with the same email address already exists. Please login or reset password instead!");
    }

    let userHandle = await addUserHandle(client);

    if(profilePicture) {
        let profilePictureBinary = new Binary(await readFile(profilePicture.path));
        await writeOne(client, COLLECTION, new User(emailAddress, userHandle, username, password, profilePictureBinary));
        await unlink(profilePicture.path);
    } else {
        await writeOne(client, COLLECTION, new User(emailAddress, userHandle, username, password));
    }
    await addChannel(client, emailAddress, username + "'s Channel", userHandle);

    /*
    //USE THIS ONLY IF YOU HAVE SET THE MAIL PARAMETERS IN THE mail.js FILE AND YOU ARE CERTAIN THEY ARE FUNCTIONING
    try {
        let verificationCode = generateVerificationCode();
        await sendEmail(emailAddress, "anville-tube EMAIL VERIFICATION CODE", "Hello " + username + ",\nYour anville-tube email verification code is " + verificationCode + ". Please do not share this code with anyone.\nPlease ignore this email if you did not attempt to sign up for anville-tube.");
    } catch(error) {
        console.log("Could not send verification email.");
        console.log(error);
    }
    */
    return await readOne(client, COLLECTION, new User(emailAddress));
}

async function updateUserAccount({ client, emailAddress, username, channelTitle, profilePicture }) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountAlreadyExists, "The account which you seek to update does not exist!");
    }
    if(username) {await updateOne(client, COLLECTION, new User(emailAddress), { $set: { username } })}
    if(profilePicture) {
        let profilePictureBinary = new Binary(await readFile(profilePicture.path));
        await updateOne(client, COLLECTION, new User(emailAddress), { $set: { profilePicture: profilePictureBinary} })
        await unlink(profilePicture.path);
    }
    if(channelTitle) { await updateChannel(client, emailAddress, channelTitle) }
}

async function addUserHandle(client) {
    let userHandles = await readOne(client, USER_HANDLES_COLLECTION, { "handles-id": "user-handles" });
    if(!userHandles) {
        userHandles = { "handles-id": "user-handles", "handles": [] };
        await writeOne(client, USER_HANDLES_COLLECTION, userHandles);
    }
    let userHandle = "user" + (userHandles.handles.length < 1000000 ? Math.floor(Math.random() * 1000000) : Math.floor(Math.random() * 2 * userHandles.handles.length));
    while(userHandles.handles.indexOf(userHandle) >= 0) {
        userHandle = "user" + (userHandles.handles.length < 1000000 ? Math.floor(Math.random() * 1000000) : Math.floor(Math.random() * 2 * userHandles.handles.length));
    }
    await updateOne(client, USER_HANDLES_COLLECTION, { "handles-id": "user-handles" }, { $push: { handles: userHandle } });
    return userHandle;
}

async function removeUserHandle(client, userHandle) {
    await findOneAndUpdate(client, USER_HANDLES_COLLECTION, { "handles-id": "user-handles" }, { $pull: { handles: userHandle } });
}

async function authenticateUserAccount({ client, emailAddress, password }) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountNotFound, "Please check your email address and password!");
    }
    if(user.password === password) {
        if(user.profilePicture) {
            user.profilePicture = "This guy has a profile picture.";
        }
        return user;
    } else {
        throw new AuthError(AUTH_ERROR_CODES.passwordIncorrect, "Please check your email address and password!");
    }
}

//WILL BE CALLED WHEN VERIFICATION CODE IS IMPLEMENTED IN SIGN-UP
function generateVerificationCode() {
    let randomNumber = Math.floor(Math.random() * 999999);
    while(randomNumber / 100000 < 1) {
        randomNumber *= 2;
        randomNumber %= 1000000;
    }
    return randomNumber;
}

async function getProfilePicture({client, emailAddress}) {
    return (await readOne(client, COLLECTION, new User(emailAddress))).profilePicture.buffer;
}

async function banUserAcount(client, emailAddress) {
    if(!await readOne(client, COLLECTION, new User(emailAddress))) {
        throw CreateAuthError(AUTH_ERROR_CODES.accountNotFound, "The user whom you seek to ban does not exist!");
    }
    await updateOne(client, COLLECTION, new User(emailAddress), { $set: { state: ACCOUNT_STATES.BANNED } });
    await banChannel(client, emailAddress);
}

async function unBanUserAcount(client, emailAddress) {
    if(!await readOne(client, COLLECTION, new User(emailAddress))) {
        throw CreateAuthError(AUTH_ERROR_CODES.accountNotFound, "The user whom you seek to unban does not exist!");
    }
    await updateOne(client, COLLECTION, new User(emailAddress), { $set: { state: ACCOUNT_STATES.UNBANNED } });
    await unBanChannel(client, emailAddress);
}

async function removeSubscription({ client, emailAddress, channelEmailAddress }) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw new AuthError(AUTH_ERROR_CODES.accountNotFound, "The account from which unsubscription is to be made does not exist!");
    }
    await updateOne(client, COLLECTION, new User(emailAddress), { $pull: { "subscriptions": channelEmailAddress } });
}

async function deleteUserAcount(client, emailAddress) {
    let user = await readOne(client, COLLECTION, new User(emailAddress));
    if(!user) {
        throw CreateAuthError(AUTH_ERROR_CODES.accountNotFound, "The user whom you seek to delete does not exist!");
    }
    await deleteOne(client, COLLECTION, new User(emailAddress));
    await removeUserHandle(client, user.handle);
    const subscribers = await removeChannel(client, emailAddress);
    for(const subscriber of subscribers) {
        await removeSubscription({client, emailAddress: subscriber, channelEmailAddress: emailAddress});
    }
}

module.exports = {
    User,
    createUserAccount,
    authenticateUserAccount,
    getProfilePicture,
    banUserAcount,
    unBanUserAcount,
    deleteUserAcount,
    updateUserAccount
}