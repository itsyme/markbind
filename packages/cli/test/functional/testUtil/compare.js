const fs = require('fs');
const path = require('path');
const ignore = require('ignore');
const walkSync = require('walk-sync');
const { isBinary } = require('istextorbinary');
const diffChars = require('./diffChars');

const _ = {};
_.isEqual = require('lodash/isEqual');
_.intersection = require('lodash/intersection');

// Other files to ignore / files with binary extensions not recognized by istextorbinary package
const TEST_BLACKLIST = ignore().add([
  '*.log',
  '*.woff',
  '*.woff2',
]);

// Files that possibly have null characters but are not binary files

const CRLF_REGEX = /\r\n/g;

function _readFileSync(...paths) {
  return fs.readFileSync(path.resolve(...paths), 'utf8');
}

/**
 * Compares files generated by the build process against the expected files.
 * Throws an error if any differences are found.
 * @param {string} root
 * @param {string} expectedSiteRelativePath
 * @param {string} siteRelativePath
 * @param {string} ignoredPaths - Specify any paths to ignore for comparison, but still check for existence.
 */
function compare(root, expectedSiteRelativePath = 'expected', siteRelativePath = '_site', ignoredPaths = []) {
  const expectedDirectory = path.join(root, expectedSiteRelativePath);
  const actualDirectory = path.join(root, siteRelativePath);

  let expectedPaths = walkSync(expectedDirectory, { directories: false });
  let actualPaths = walkSync(actualDirectory, { directories: false });

  // Check for file existence of ignoredPaths and that they are present in actualPaths
  if (ignoredPaths.length !== 0 && !_.isEqual(_.intersection(ignoredPaths, actualPaths), ignoredPaths)) {
    throw new Error('Ignored paths are not present in actual paths!');
  }

  // Filter out ignoredPaths to avoid comparing them because they are binary files
  actualPaths = actualPaths.filter(p => !ignoredPaths.includes(p));
  expectedPaths = expectedPaths.filter(p => !ignoredPaths.includes(p));

  let error = false;
  if (expectedPaths.length !== actualPaths.length) {
    throw new Error('Unequal number of files! '
      + `Expected: ${expectedPaths.length}, Actual: ${actualPaths.length}`);
  }

  /* eslint-disable no-continue */
  for (let i = 0; i < expectedPaths.length; i += 1) {
    const expectedFilePath = expectedPaths[i];
    const actualFilePath = actualPaths[i];

    if (expectedFilePath !== actualFilePath) {
      throw new Error(`Different files built! Expected: ${expectedFilePath}, Actual: ${actualFilePath}`);
    }

    if (isBinary(expectedFilePath) || TEST_BLACKLIST.ignores(expectedFilePath)) {
      continue;
    }

    const expected = _readFileSync(expectedDirectory, expectedFilePath)
      .replace(CRLF_REGEX, '\n');
    const actual = _readFileSync(actualDirectory, actualFilePath)
      .replace(CRLF_REGEX, '\n');

    if (isBinary(null, expected)) {
      // eslint-disable-next-line no-console
      console.warn(`Unrecognised file extension ${expectedFilePath} contains null characters, skipping`);
      continue;
    }

    const hasDiff = diffChars(expected, actual, expectedFilePath);
    error = error || hasDiff;
  }
  /* eslint-enable no-continue */

  if (error) {
    throw new Error('Diffs found in files');
  }
}

module.exports = {
  compare,
};
