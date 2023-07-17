module.exports = (sequelize, DataType) => {
  const Turnos_sucursales48hs = sequelize.define(
    "Turnos_sucursales48hs",
    {
      id_turno: {
        type: DataType.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // COD_TURNO: {
      //     type: DataType.INTEGER,
      //     allowNull: false,
      //     unique: true
      // },
      FECHA: {
        type: DataType.STRING,
        allowNull: false,
      },
      HORA: {
        type: DataType.STRING,
        allowNull: false,
      },
      // Doctor
      NOMBRE_COMERCIAL: {
        type: DataType.STRING,
        allowNull: false,
      },
      SUCURSAL: {
        type: DataType.STRING,
        allowNull: false,
      },
      // DIRECCION: {
      //     type: DataType.STRING,
      //     allowNull: true
      // },
      CLIENTE: {
        type: DataType.STRING,
        allowNull: false,
      },
      TELEFONO_MOVIL: {
        type: DataType.STRING,
        allowNull: true,
      },
      // PLAN_CLIENTE: {
      //     type: DataType.STRING,
      //     allowNull: true
      // },
      CARNET: {
        type: DataType.STRING,
        allowNull: true,
      },
      // FECHA_CREACION: {
      //     type: DataType.DATE,
      //     allowNull: true
      // },
      // FECHA_TURNO: {
      //     type: DataType.DATE,
      //     allowNull: true
      // },
      // USUARIO_CREO_TURNO: {
      //     type: DataType.STRING,
      //     allowNull: true
      // },
      estado_envio: {
        type: DataType.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      // ASISTIO: {
      //     type: DataType.INTEGER,
      //     allowNull: false
      // }
    },
    { freezeTableName: true }
  );

  Turnos_sucursales48hs.associate = (models) => {
    Turnos_sucursales48hs.belongsTo(models.Users, {
      foreignKey: {
        name: "user_id",
        allowNull: true,
        defaultValue: 1,
      },
    });
  };
  return Turnos_sucursales48hs;
};
