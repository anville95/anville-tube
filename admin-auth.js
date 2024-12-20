const { writeFile, readFile, unlink } = require("fs").promises,
      { Binary } = require("mongodb"),
      { writeOne, readOne, updateOne, deleteOne } = require("./db-utils.js"),
      { banUserAcount, unBanUserAcount, deleteUserAcount } = require("./auth.js"),
      { hideContent, unHideContent, searchContents, CONTENT_TYPES, searchContentsForAdmin } = require("./media.js"),
      PRIME_ADMIN_FILE_PATH = "./prime_admin.anville-tube",
      PRIME_ADMIN_CREDENTIALS_FILE_PATH = "./prime_admin_credentials.anville-tube",
      ONE_MEGABYTE = 1048576,
      CHAR_CODE_LIMIT = 65535,
      ADMIN_AUTH_ERROR_CODES = {
        adminAuthFailedError: 10,
        sessionKeyVerificationFailedError: 11,
        adminAccountAlreadyExistsError: 12,
        adminAccountNotFoundError: 13,
        invalidCommandParameters: 14
      },
      ACCOUNT_STATES = {
        UNBANNED: 0,
        BANNED: 1
      },
      COLLECTION = "admins",
      DELIMITER = "<--anville-tube-->";


function CreateAdminAuthError(errorCode, errorMessage) {
    let error = new Error(errorMessage);
    error.errorCode = errorCode;
    return error;
}

function Admin(emailAddress, username, password, profilePicture, state) {
    this.emailAddress = emailAddress;
    if(username) { this.username = username; }
    if(password) { this.password = password; }
    if(profilePicture) { this.profilePicture = new Binary(profilePicture); }
    if(state) { this.state = state; }
}
/*
FRONT END CONSTRUCTOR
function Admin(emailAddress, username, password, profilePicture, state) {
    this.emailAddress = "admin-" + emailAddress;
    if(username) { this.username = username; }
    if(password) { this.password = password; }
    if(profilePicture) { this.profilePicture = new Binary(profilePicture); }
    if(state) { this.state = state; }
}
*/

async function createPrimeAdminFile() {
    //Prime admin is a hard coded file and not a part of the database as database clearing would cripple administrative access
    let key = "";
    for(let i = 0; i < 2 * ONE_MEGABYTE; i++) {
        key += String.fromCharCode(Math.floor(Math.random() * CHAR_CODE_LIMIT));
    }
    let emailAddress = "admin-prime@anville-tube.com",
    password = "This is the password. Now I will add random characters to randomise it even further. lsdkgjbkjdfbhklfhbeasbdp;awuidbna;uiosfcn;aSjAL:ksdj8wJFSDIORTF-349YHIUDGBQWIO34RFGYQ234UIOTF-2348WFHO;'2HR    =239URF]    2390JF=Q3490FP2FJK[-0W9EU8JD\   [KE9GEF;34JGH]WE9FKC\]-04IOTQ]09GBJQ34590GUJFioe    0dke    o9d";
    await writeFile(PRIME_ADMIN_FILE_PATH, key + DELIMITER + emailAddress + DELIMITER + password);
}

async function createPrimeAdminCredentialsFile() {
    let emailAddress = "admin-prime@anville-tube.com",
    password = "pass1234";
    await writeFile(PRIME_ADMIN_CREDENTIALS_FILE_PATH, emailAddress + DELIMITER + password);
}

async function verifyPrimeAdminCredentials({ emailAddress, password }) {
    let trueCredentialsArray = (await readFile(PRIME_ADMIN_CREDENTIALS_FILE_PATH, "utf8")).split(DELIMITER);
    if(emailAddress === trueCredentialsArray[0] && password === trueCredentialsArray[1]) {
        return "Credentials accurate. Now send the key selectioin page!";
    }
    throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAuthFailedError, "Please check your email address and password!");
}

async function authenticatePrimeAdmin({ primeAdminAuthFile, setPrimeAdminSessionKey }) {
    let primeAdminDataArray = (await readFile(PRIME_ADMIN_FILE_PATH, "utf8")).split(DELIMITER),
    authDataArray = (await readFile(primeAdminAuthFile.path, "utf8")).split(DELIMITER);
    unlink(primeAdminAuthFile.path);
    for(let i = 0; i < authDataArray.length; i++) {
        if(authDataArray[i] !== primeAdminDataArray[i]) {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAuthFailedError, "Please check your email address and password!")
        }
    }
    let key = "prime_admin_session_key" + (Math.floor(Math.random() * ONE_MEGABYTE)).toString();
    setPrimeAdminSessionKey(key);
    return key;
}

async function addAdminAccount({ client, primeAdminSessionKey, authPrimeAdminSessionKey, admin }) {
    if(primeAdminSessionKey !== authPrimeAdminSessionKey) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.sessionKeyVerificationFailedError, "The provided authentication data were invalid!");
    }
    if(!admin) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide all the required admin parameters (email address and password)!")
    }
    if(await readOne(client, COLLECTION, new Admin(admin.emailAddress))) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAccountAlreadyExistsError, "An Admin account with the provided email address already exists!");
    } else if(!(admin.emailAddress && admin.password)) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide all the required admin parameters (email address and password)!");
    }
    await writeOne(client, COLLECTION, admin);
    return "Admin '" + admin.emailAddress + "' created successfully!";
}

async function authenticateAdminAccount({ client, emailAddress, password, addAdminSessionKey }) {
    let admin = await readOne(client, COLLECTION, new Admin(emailAddress));
    if(!admin) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAccountNotFoundError, "Please check your email address and password!");
    }
    if(admin.password === password) {
        let key = ("admin_session_key_" + (Math.floor(Math.random() * 2 * ONE_MEGABYTE)).toString());
        addAdminSessionKey(key);
        return { ...admin, key };
    } else {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAuthFailedError, "Please check your email address and password!");
    }
}

async function banAdminAccount({ client, primeAdminSessionKey, authPrimeAdminSessionKey, emailAddress }) {
    if(primeAdminSessionKey !== authPrimeAdminSessionKey) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.sessionKeyVerificationFailedError, "The provided authentication data were invalid!");
    }
    if(!await readOne(client, COLLECTION, new Admin(emailAddress))) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAccountNotFoundError, "The admin whom you seek to ban does not exist!");
    } else if(!emailAddress) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide the admin's email address!");
    }
    await updateOne(client, COLLECTION, new Admin(emailAddress), { $set: { state: ACCOUNT_STATES.BANNED } });
    return "Admin '" + emailAddress + "' banned successfully!";
}

async function unBanAdminAccount({ client, primeAdminSessionKey, authPrimeAdminSessionKey, emailAddress }) {
    if(primeAdminSessionKey !== authPrimeAdminSessionKey) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.sessionKeyVerificationFailedError, "The provided authentication data were invalid!");
    }
    if(!await readOne(client, COLLECTION, new Admin(emailAddress))) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAccountNotFoundError, "The admin whom you seek to unban does not exist!");
    } else if(!emailAddress) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide the admin's email address!");
    }
    await updateOne(client, COLLECTION, new Admin(emailAddress), { $set: { state: ACCOUNT_STATES.UNBANNED } });
    return "Admin '" + emailAddress + "' unbanned successfully!";
}

async function deleteAdminAccount({ client, primeAdminSessionKey, authPrimeAdminSessionKey, emailAddress }) {
    if(primeAdminSessionKey !== authPrimeAdminSessionKey) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.sessionKeyVerificationFailedError, "The provided authentication data were invalid!");
    }
    if(!await readOne(client, COLLECTION, new Admin(emailAddress))) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAccountNotFoundError, "The admin whom you seek to delete does not exist!");
    } else if(!emailAddress) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide the admin's email address!");
    }
    await deleteOne(client, COLLECTION, new Admin(emailAddress));
    return "Admin '" + emailAddress + "' deleted successfully!";
}

function verifyAdminSessionKey({ authAdminSessionKey, primeAdminSessionKey, adminsSessionKeys }) {
    if(authAdminSessionKey !== primeAdminSessionKey && adminsSessionKeys.indexOf(authAdminSessionKey) < 0) {
        throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.adminAuthFailedError, "Invalid session key.");
    }
    return true;
}

async function banUser({client, emailAddress, adminAuthData }) {
    if(verifyAdminSessionKey(adminAuthData)) {
        if(!emailAddress) {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide the user's email address!");
        }
        await banUserAcount(client, emailAddress);
        return "User '" + emailAddress + "' banned successfully!";
    }
}

async function unBanUser({ client, emailAddress, adminAuthData }) {
    if(verifyAdminSessionKey(adminAuthData)) {
        if(!emailAddress) {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide the user's email address!");
        }
        await unBanUserAcount(client, emailAddress);
        return "User '" + emailAddress + "' unbanned successfully!";
    }
}

async function deleteUser({ client, emailAddress, adminAuthData }) {
    if(verifyAdminSessionKey(adminAuthData)){
        if(!emailAddress) {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide the user's email address!");
        }
        await deleteUserAcount(client, emailAddress);
        return "User '" + emailAddress + "' deleted successfully!";
    }
}

async function hide({ data, adminAuthData }) {
    if(verifyAdminSessionKey(adminAuthData)) {
        if(!data || typeof data !== "object") {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide valid content data!");
        }
        await hideContent(data);
        return "Content '" + data.id + "' hidden successfully!";
    }
}

async function unHide({ data, adminAuthData }) {
    if(verifyAdminSessionKey(adminAuthData)) {
        if(!data || typeof data !== "object") {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide valid content data!");
        }
        await unHideContent(data);
        return "Content '" + data.id + "' exposed successfully!";
    }
}

async function searchVideosForAdmin({data, adminAuthData}) {
    const {client, channelEmailAddress, key} = data;
    if(verifyAdminSessionKey(adminAuthData)) {
        if(!data) {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide valid content search data!");
        } else if(!(channelEmailAddress && key)) {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide valid content search data!");
        }
        return await searchContentsForAdmin(client, channelEmailAddress, key, CONTENT_TYPES.VIDEO);
    }
}

async function searchShortsForAdmin({data, adminAuthData}) {
    const {client, channelEmailAddress, key} = data;
    if(verifyAdminSessionKey(adminAuthData)) {
        if(!data) {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide valid content search data!");
        } else if(!(channelEmailAddress && key)) {
            throw CreateAdminAuthError(ADMIN_AUTH_ERROR_CODES.invalidCommandParameters, "Please provide valid content search data!");
        }
        return await searchContentsForAdmin(client, channelEmailAddress, key, CONTENT_TYPES.SHORT);
    }
}

module.exports = {
    createPrimeAdminFile,
    createPrimeAdminCredentialsFile,
    authenticatePrimeAdmin,
    verifyPrimeAdminCredentials,
    addAdminAccount,
    authenticateAdminAccount,
    banAdminAccount,
    unBanAdminAccount,
    deleteAdminAccount,
    banUser,
    unBanUser,
    deleteUser,
    hide,
    unHide,
    searchVideosForAdmin,
    searchShortsForAdmin
}