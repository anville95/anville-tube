const COLLECTION = "conversations",
      USERS_COLLECTION = "users",
      { readOne, writeOne, updateOne, findOneAndUpdate } = require("./db-utils.js"),
      { User } = require("./auth.js"),
      MESSAGING_ERROR_CODES = {
        conversationNotFoundError: 9
      }

function Message(text, senderEmailAddress, senderUsername) {
    this.text = text;
    if(senderEmailAddress) { this.sender = { emailAddress: senderEmailAddress, username: senderUsername }; this.time = new Date().toLocaleDateString() }
}

function Conversation(title, messages) {
    this.title = title;
    if(messages) { this.messages = messages; }
}

function CreateMessagingError(errorCode, errorMessage) {
    let error = new Error(errorMessage);
    error.errorCode = errorCode;
    return error;
}

async function writeMessage({ client, senderEmailAddress, receiverEmailAddress, message }) {
    let conversationTitle = resolveConversationTitle(senderEmailAddress, receiverEmailAddress);
    let conversation = await readOne(client, COLLECTION, new Conversation(conversationTitle));
    if(!conversation) {
        conversation = new Conversation(conversationTitle, [ message ]);
        await writeOne(client, COLLECTION, conversation);
        await updateOne(client, USERS_COLLECTION, new User(senderEmailAddress), { $push: { conversations: receiverEmailAddress } });
        await updateOne(client, USERS_COLLECTION, new User(receiverEmailAddress), { $push: { conversations: senderEmailAddress } });
    } else {
        await updateOne(client, COLLECTION, new Conversation(conversationTitle), { $push: { messages: message } });
    }
}

async function readMessages({ client, senderEmailAddress, receiverEmailAddress, startPosition=0, amount=20, all }) {
    let conversationTitle = resolveConversationTitle(senderEmailAddress, receiverEmailAddress);
    console.log(conversationTitle);
    console.log(await readOne(client, COLLECTION, new Conversation(conversationTitle)));
    let conversation = await readOne(client, COLLECTION, new Conversation(conversationTitle));
    if(!conversation) {
        throw CreateMessagingError(MESSAGING_ERROR_CODES.conversationNotFoundError, "The conversation from which the messages are to be retrieved does not exist!");
    }
    
    if(all) {
        return conversation.messages;
    } else {
        let messages = [];
        for(let i = startPosition; i < (startPosition + amount) &&  i < conversation.messages.length; i++) {
            messages[messages.length] = conversation.messages[i];
        }
        return messages;
    }
}

async function removeMessage({client, senderEmailAddress, receiverEmailAddress, messageText}) {
    let conversationTitle = resolveConversationTitle(senderEmailAddress, receiverEmailAddress);
    let conversation = await readOne(client, COLLECTION, new Conversation(conversationTitle));
    if(!conversation) {
        throw CreateMessagingError(MESSAGING_ERROR_CODES.conversationNotFoundError, "The conversation from which the messages are to be removed does not exist!");
    }
    await findOneAndUpdate(client, COLLECTION, new Conversation(conversationTitle), { $pull: { "messages": new Message(messageText) } });
}

function resolveConversationTitle(senderEmailAddress, receiverEmailAddress) {
    return senderEmailAddress < receiverEmailAddress ? senderEmailAddress + "_" + receiverEmailAddress: receiverEmailAddress + "_" + senderEmailAddress;
}

module.exports = {
    writeMessage,
    readMessages,
    removeMessage,
    resolveConversationTitle
}