"use strict";

/** @type {import('sequelize-cli').Migration} */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("audit_logs", {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },

      userId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      action: {
        type: Sequelize.ENUM(
          "login",
          "logout",
          "device_created",
          "device_enabled",
          "device_revoked",
          "device_deleted",
          "user_created",
          "user_updated",
          "user_deleted",
        ),
        allowNull: false,
      },

      resourceType: {
        type: Sequelize.ENUM("user", "device", "auth"),
        allowNull: false,
      },

      resourceId: {
        type: Sequelize.UUID,
        allowNull: true,
      },

      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },

      ipAddress: {
        type: Sequelize.STRING,
        allowNull: true,
      },

      userAgent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },

      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("audit_logs");

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_audit_logs_action";',
    );

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_audit_logs_resourceType";',
    );
  },
};
