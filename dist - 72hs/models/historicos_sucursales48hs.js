"use strict";

module.exports = function (sequelize, DataType) {
  var Historicos_sucursales48hs = sequelize.define("Historicos_sucursales48hs", {
    historico_id: {
      type: DataType.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    fecha: {
      type: DataType.DATEONLY,
      allowNull: false,
      unique: true
    },
    cant_enviados: {
      type: DataType.BIGINT,
      allowNull: false
    },
    cant_no_enviados: {
      type: DataType.BIGINT,
      allowNull: false
    }
  }, {
    freezeTableName: true
  });

  Historicos_sucursales48hs.associate = function (models) {
    Historicos_sucursales48hs.belongsTo(models.Users, {
      foreignKey: {
        name: "user_id",
        allowNull: true,
        defaultValue: 1
      }
    });
  };

  return Historicos_sucursales48hs;
};