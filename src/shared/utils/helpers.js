import { exec } from 'child_process';
import util from 'util';

const execAsync = util.promisify(exec);

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

async function runTerraform(cmd, cwd) {
  const { stdout, stderr } = await execAsync(`terraform ${cmd}`, {
    cwd,
    env: { ...process.env },
    maxBuffer: 1024 * 1024,
  });

  if (stderr) logger.warn('Terraform warning', { cmd, stderr });
  return stdout;
}

export { delay, prepareMessage, runTerraform };
