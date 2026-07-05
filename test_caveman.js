const cp = require('child_process');
const path = require('path');
const fs = require('fs');
const argsFile = path.join(process.cwd(), '.pi-test-args');
cp.execSync('bash -c "source dotfiles/shell_integration.sh; pi --caveman"', {
  env: Object.assign({}, process.env, { PI_TEST_MOCK_BIN: '1', PI_TEST_MOCK_ARGS_FILE: argsFile })
});
console.log(fs.readFileSync(argsFile, 'utf8'));