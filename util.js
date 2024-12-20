function stringifyError(error) {
    let objectError = {};
    Object.getOwnPropertyNames(error).forEach(key => {
        objectError[key] = error[key];
    })
    return JSON.stringify(objectError);
}

module.exports = {
    stringifyError
}