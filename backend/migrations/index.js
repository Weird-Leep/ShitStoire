const addRequestedLinks = require('./001_add_requested_links');
const allowMultipleDatedLinks = require('./002_allow_multiple_dated_links');
const makeEpEpLinkDated = require('./003_make_ep_ep_link_dated');

const migrations = [
    addRequestedLinks,
    allowMultipleDatedLinks,
    makeEpEpLinkDated,
].sort((a, b) => a.version - b.version);

module.exports = {
    migrations,
    latestVersion: migrations.length ? migrations[migrations.length - 1].version : 0,
};
