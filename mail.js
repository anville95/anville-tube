const EMAIL_ADDRESS = "",
      PASSWORD = "",
      SERVICE = "",
      nodemailer = require("nodemailer");

function sendEmail(receiverEmailAddress, subject, text) {
    return new Promise((resolve, reject) => {
        let transport = nodemailer.createTransport({
            service: SERVICE,
            auth: {
                user: EMAIL_ADDRESS,
                pass: PASSWORD
            }
        });
    
        transport.sendMail({
            from: EMAIL_ADDRESS,
            to: receiverEmailAddress,
            subject,
            text
        }, (error, info) => {
            if(error) {
                reject(error);
                return;
            }
        })
    })
}

module.exports = { sendEmail }