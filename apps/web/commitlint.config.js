/** @type {import('@commitlint/types').UserConfig} */
const Configuration = {
  extends: ['@commitlint/config-conventional'],
  ignores: [message => message.startsWith('chore: bump')],
};

module.exports = Configuration;
