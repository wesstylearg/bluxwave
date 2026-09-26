/**
 * sync.js - Cloud Sync stub for Demo mode (No-op)
 */

export const CloudSync = {
  init() {},
  async sync() { return false; },
  async upload() { return false; },
  async download() { return null; }
};
