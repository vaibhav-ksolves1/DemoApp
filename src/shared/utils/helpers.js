const delay = async ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

function prepareMessage(template, payload) {
  let message = template;

  for (const key in payload) {
    // replace all occurrences of :key with its value
    message = message.split(`:${key}`).join(payload[key]);
  }

  return message;
}
export { delay, prepareMessage };
