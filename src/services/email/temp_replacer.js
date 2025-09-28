// update-logs.js
const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, 'src'); // replace with your code folder

function replaceConsoleLogs(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');

  // Regex to match: console.log('some message', some_value)
  const regex = /console\.log\(\s*(['"`][^'"`]*['"`])\s*,\s*([^)]+)\)/g;

  code = code.replace(regex, (match, msg, value) => {
    return `logger.info(${msg}, { ${value.trim()} })`;
  });

  fs.writeFileSync(filePath, code, 'utf8');
  console.log(`Updated: ${filePath}`);
}

function traverseDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.ts')) {
      replaceConsoleLogs(fullPath);
    }
  });
}

traverseDir(directoryPath);
