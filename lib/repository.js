var git = require('../');
var util = require('./util');
var Refs = require('./reference');
var normalizeOid = require("./util/normalize_oid");

var Commit = git.Commit;
var Revwalk = git.Revwalk;
var Repo = git.Repository;
var Blob = git.Blob;
var Tree = git.Tree;
var Reference = git.Reference;

// Backwards compatibility.
Object.defineProperty(git, "Repo", {
  value: Repo,
  enumerable: false
});

var oldGetReference = Reference.lookup,
    oldGetTree = Tree.lookup,
    oldGetTag = Repo.prototype.getTag,
    oldCreateRevwalk = Revwalk.createRevwalk,
    oldCreateCommit = Commit.createCommit,
    oldCreateBlobFromBuffer = Blob.createFrombuffer;

/**
 * Look up a branch's most recent commit.
 *
 * @param {String} name Branch name, e.g. 'master'
 * @param {Function} callback
 * @return {Branch}
 */
Repo.prototype.getBranch = function(name, callback) {
  var self = this;
  this.getReference('refs/heads/' + name, function referenceLookupCallback(error, reference) {
    if (error) return callback(error);

    self.getCommit(reference.target(), function commitLookupCallback(error, commit) {
      if (error) return callback(error);

      callback(null, commit);
    });
  });
};
util.makeSafe(Repo.prototype, 'getBranch');

/**
 * Lookup the reference with the given name.
 *
 * @param {String} name
 * @param {Function} callback
 * @return {Reference}
 */
Repo.prototype.getReference = function(name, callback) {
  var self = this;
  oldGetReference.call(this, name, function(error, reference) {
    if (error) return callback(error);

    if (reference.type() == Reference.Type.Symbolic) {
      reference.resolve(function (error, reference) {
        if (error) return callback(error);
        reference.repo = self;
        callback(null, reference);
      });
    } else {
      reference.repo = self;
      callback(null, reference);
    }
  });
};
util.makeSafe(Repo.prototype, 'getReference');

/**
 * Retrieve the commit identified by oid.
 *
 * @param {String|Oid} String sha or Oid
 * @param {Function} callback
 * @return {Commit}
 */
Repo.prototype.getCommit = function(oid, callback) {
  var repository = this;

  return Commit.lookup(repository, normalizeOid(oid)).then(function(commit) {
    commit.repo = repository;

    if (callback) {
      callback(null, commit);
    }

    return commit;
  });
};

/**
 * Retrieve the blob represented by the oid.
 *
 * @param {String|Oid} String sha or Oid
 * @param {Function} callback
 * @return {Blob}
 */
Repo.prototype.getBlob = function(oid, callback) {
  var repository = this;

  return Blob.lookup(repository, normalizeOid(oid)).then(function(blob) {
    blob.repo = repository;

    if (callback) {
      callback(null, blob);
    }

    return blob;
  }, callback);
};

/**
 * Retrieve the tree represented by the oid.
 *
 * @param {String|Oid} String sha or Oid
 * @param {Function} callback
 * @return {Tree}
 */
Repo.prototype.getTree = function(oid, callback) {
  var self = this;
  oldGetTree.call(this, oid, function(error, tree) {
    if (error) return callback(error);
    tree.repo = self;
    callback(null, tree);
  });
};
util.normalizeOid(Repo.prototype, 'getTree');
util.makeSafe(Repo.prototype, 'getTree');

/**
 * Retrieve the tag represented by the oid.
 *
 * @param {String|Oid} String sha or Oid
 * @param {Function} callback
 * @return {Tag}
 */
Repo.prototype.getTag = function(oid, callback) {
  var self = this;
  oldGetTag.call(this, oid, callback);
};
util.normalizeOid(Repo.prototype, 'getTag');
util.makeSafe(Repo.prototype, 'getTag');

/**
 * Instantiate a new revision walker for browsing the Repo's history.
 * See also `Commit.prototype.history()`
 *
 * @param {String|Oid} String sha or Oid
 * @param {Function} callback
 * @return {RevWalk}
 */
Repo.prototype.createRevWalk = function() {
  var revWalk = oldCreateRevwalk(this);
  revWalk.repo = this;
  return revWalk;
};

/**
 * Retrieve the master branch.
 *
 * @param {Function} callback
 * @return {Branch}
 */
Repo.prototype.getMaster = function(callback) {
  this.getBranch('master', callback);
};

/**
 * Create a commit
 *
 * @param {String} updateRef
 * @param {Signature} author
 * @param {Signature} commiter
 * @param {String} message
 * @param {Tree|Oid|String} Tree
 * @param {Array} parents
 * @param {Function} callback
 * @return {Oid} The oid of the commit
 */
Repo.prototype.createCommit = function(updateRef, author, committer, message, tree, parents, callback) {
  if (tree instanceof Tree) {
    oldCreateCommit.call(
      this,
      updateRef,
      author,
      committer,
      null /* use default message encoding */,
      message,
      tree,
      parents.length, parents,
      callback);
  } else {
    var self = this;
    this.getTree(tree, function(error, tree) {
      if (error) return callback(error);
      oldCreateCommit.call(
        self,
        updateRef,
        author,
        committer,
        null /* use default message encoding */,
        message,
        tree,
        parents.length, parents,
        callback);
    });
  }
};

/**
 * Create a blob from a buffer
 *
 * @param {Buffer} buffer
 * @param {Function} callback
 * @return {Blob}
 */
Repo.prototype.createBlobFromBuffer = function(buffer, callback) {
  oldCreateBlobFromBuffer.call(this, buffer, buffer.length, callback);
};

/**
 * Create a new tree builder.
 *
 * @param {Tree} tree
 * @param {Function} callback
 */
Repo.prototype.treeBuilder = function(callback) {
  var builder = TreeBuilder.create(null);
  builder.root = builder;
  builder.repo = this;
  return builder;
};