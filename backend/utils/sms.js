import dotenv from "dotenv";

dotenv.config();  // This loads the variables from .env file

async function createMessage(url) {
  console.log('SMS functionality disabled. Location URL:', url);
  console.log(`Emergency alert would be sent: I'm in DANGER, please help. Location: ${url}`);
}

export default createMessage;

export async function createCall() {
  console.log('Call functionality disabled.');
  console.log('Emergency call would be initiated to +917007215662');
}