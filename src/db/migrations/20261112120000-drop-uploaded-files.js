'use strict';

// File uploads were removed from the app, so their table goes too.
// `down` recreates it from the original migration.
const createUploadedFiles = require('./20260911153354-create-uploaded-files');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('uploaded_files');
  },

  async down(queryInterface, Sequelize) {
    await createUploadedFiles.up(queryInterface, Sequelize);
  },
};
