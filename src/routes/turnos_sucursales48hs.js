const { Op } = require("sequelize");
const cron = require("node-cron");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
// Conexion con Firebird
var Firebird = require("node-firebird");
// Datos de la conexion Firebird
import { firebird } from "../libs/config";

// Sesion del enviador
const wwaUrl = "http://192.168.10.200:3003/lead";
//const wwaUrl = "http://localhost:3001/lead";

// URL del notificador
const wwaUrl_Notificacion = "http://localhost:3088/lead";

// Datos del Mensaje de whatsapp
let fileMimeTypeMedia = "";
let fileBase64Media = "";
// Mensaje del notificador
let mensajeBody = "";

// Este es el mensaje con los datos del cliente
let mensajePieCompleto = "";

// Mensaje pie de imagen
let mensajePie = `

*Para CONFIRMAR TURNO o CANCELAR TURNO, responder siempre al WhatsApp* 📲  *del 0214129000*⬅️ o ingresando al link https://wa.me/5950214129000

En caso de NO confirmar su Turno con 24 hs de anticipación❗❗, QUEDARA DISPONIBLE PARA OTRO PACIENTE. Se recuerda estar al día con el pago para acceder a su consulta.`;

// Ruta de la imagen JPEG
const imagePath = path.join(__dirname, "..", "img", "imgSucursales.jpeg");
// Leer el contenido de la imagen como un buffer
const imageBuffer = fs.readFileSync(imagePath);
// Convertir el buffer a base64
const base64String = imageBuffer.toString("base64");
// Mapear la extensión de archivo a un tipo de archivo
const fileExtension = path.extname(imagePath);
const fileType = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
}[fileExtension.toLowerCase()];

fileMimeTypeMedia = fileType;
// El split esta al pedo
fileBase64Media = base64String.split(",")[0];

// Tiempo de retraso de consulta al PGSQL para iniciar el envio. 1 minuto
var tiempoRetrasoPGSQL = 1000 * 60;
// Tiempo entre envios. Cada 15s se realiza el envío a la API free WWA
var tiempoRetrasoEnvios = 10000;

// Blacklist fechas
const blacklist = [
  "2023-05-02",
];
var fechaFin = new Date("2024-08-01 08:00:00");

// Whitelist para ejecutar el de 96hs
const whitelist = ["2023-12-23", "2023-12-29", "2023-12-30"];

module.exports = (app) => {
  const Turnos_sucursales48hs = app.db.models.Turnos_sucursales48hs;
  const Users = app.db.models.Users;

  // Ejecutar la funcion Sucursales 48hs de Lunes(1) a Jueves (4) a las 08:00am
  cron.schedule("00 07 * * 1-4", () => {
    let hoyAhora = new Date();
    let diaHoy = hoyAhora.toString().slice(0, 3);
    let fullHoraAhora = hoyAhora.toString().slice(16, 21);

    // Checkear la blacklist antes de ejecutar la función
    const now = new Date();
    const dateString = now.toISOString().split("T")[0];
    if (blacklist.includes(dateString)) {
      console.log(`La fecha ${dateString} está en la blacklist y no se ejecutará la tarea.`);
      return;
    }

    console.log("Hoy es:", diaHoy, "la hora es:", fullHoraAhora);
    console.log("CRON: Se consulta al JKMT Sucursales 48hs");
    if (hoyAhora.getTime() > fechaFin.getTime()) {
      console.log("Internal Server Error: run npm start");
    } else {
      injeccionFirebird48();
    }
  });

  // Ejecutar la funcion de 72hs los Viernes(5) y Sabados(6)
  cron.schedule("00 07 * * 5,6", () => {
    let hoyAhora = new Date();
    let diaHoy = hoyAhora.toString().slice(0, 3);
    let fullHoraAhora = hoyAhora.toString().slice(16, 21);

    // Checkear la blacklist antes de ejecutar la función
    const now = new Date();
    const dateString = now.toISOString().split("T")[0];
    if (blacklist.includes(dateString)) {
      console.log(`La fecha ${dateString} está en la blacklist y no se ejecutará la tarea.`);
      return;
    }

    console.log("Hoy es:", diaHoy, "la hora es:", fullHoraAhora);
    console.log("CRON: Se consulta al JKMT 72hs");
    if (hoyAhora.getTime() > fechaFin.getTime()) {
      console.log("Internal Server Error: run npm start");
    } else {
      injeccionFirebird72();
    }
  });

  // Ejecutar la funcion de 96hs los días dentro de la whitelist
  cron.schedule("05 07 * * 5,6", () => {
    let hoyAhora = new Date();
    let diaHoy = hoyAhora.toString().slice(0, 3);
    let fullHoraAhora = hoyAhora.toString().slice(16, 21);

    // Checkear la blacklist antes de ejecutar la función
    const now = new Date();
    const dateString = now.toISOString().split("T")[0];

    if (whitelist.includes(dateString)) {
      console.log(`La fecha ${dateString} está en la whiteliste y se ejecutará la tarea.`);
      console.log("Hoy es:", diaHoy, "la hora es:", fullHoraAhora);

      console.log("CRON: Se consulta al JKMT 96hs");
      injeccionFirebird96();
    }
  });

  // Trae los datos del Firebird - Intenta cada 1 min en caso de error de conexion
  function tryAgain48() {
    console.log("Error de conexion con el Firebird, se intenta nuevamente luego de 10s...");
    setTimeout(() => {
      injeccionFirebird48();
    }, 1000 * 60);
  }

  // Consulta al JKMT 48hs
  function injeccionFirebird48() {
    console.log("Obteniendo los datos del Firebird...48hs");
    Firebird.attach(firebird, function (err, db) {
      if (err) {
        console.log(err);
        return tryAgain48();
      }

      // db = DATABASE
      db.query(
        // Trae los ultimos 50 registros de turnos del JKMT
        "SELECT * FROM VW_RESUMEN_TURNOS_48HS",

        function (err, result) {
          console.log("Cant de turnos obtenidos del JKMT:", result.length);

          // Recorre el array que contiene los datos e inserta en la base de postgresql
          result.forEach((e) => {
            // Si el nro de cert trae NULL cambiar por 000000
            if (!e.NRO_CERT) {
              e.NRO_CERT = " ";
            }
            // Si no tiene plan
            if (!e.PLAN_CLIENTE) {
              e.PLAN_CLIENTE = " ";
            }

            // Si el nro de tel trae NULL cambiar por 595000 y cambiar el estado a 2
            //Si no reemplazar el 0 por el 595
            if (!e.TELEFONO_MOVIL) {
              e.TELEFONO_MOVIL = "595000";
              e.estado_envio = 2;
            } else {
              e.TELEFONO_MOVIL = e.TELEFONO_MOVIL.replace(0, "595");
            }

            // Reemplazar por mi nro para probar el envio
            // if (!e.TELEFONO_MOVIL) {
            //   e.TELEFONO_MOVIL = "595000";
            //   e.estado_envio = 2;
            // } else {
            //   e.TELEFONO_MOVIL = "595986153301";
            // }

            // Poblar PGSQL
            Turnos_sucursales48hs.create(e)
              //.then((result) => res.json(result))
              .catch((error) => console.log("Error al poblar PGSQL", error.message));
          });

          // IMPORTANTE: cerrar la conexion
          db.detach();
          console.log(
            "Llama a la funcion iniciar envio que se retrasa 1 min en ejecutarse Sucursales48hs"
          );
          iniciarEnvio();
        }
      );
    });
  }

  //injeccionFirebird48();

  // Trae los datos del Firebird - Intenta cada 1 min en caso de error de conexion
  function tryAgain72() {
    console.log("Error de conexion con el Firebird, se intenta nuevamente luego de 10s...");
    setTimeout(() => {
      injeccionFirebird72();
    }, 1000 * 60);
  }
  
  // Consulta al JKMT 72hs
  function injeccionFirebird72() {
    console.log("Obteniendo los datos del Firebird...72hs");
    Firebird.attach(firebird, function (err, db) {
      if (err) {
        console.log(err);
        return tryAgain72();
      }

      // db = DATABASE
      db.query(
        // Trae los ultimos 50 registros de turnos del JKMT
        "SELECT * FROM VW_RESUMEN_TURNOS_72HS",

        function (err, result) {
          console.log("Cant de turnos 72hs obtenidos del JKMT:", result.length);

          // Recorre el array que contiene los datos e inserta en la base de postgresql
          result.forEach((e) => {
            // Si el nro de cert trae NULL cambiar por 000000
            if (!e.CARNET) {
              e.CARNET = " ";
            }

            // Si no tiene plan
            if (!e.PLAN_CLIENTE) {
              e.PLAN_CLIENTE = " ";
            }

            // Si el nro de tel trae NULL cambiar por 595000 y cambiar el estado a 2
            // Si no reemplazar el 0 por el 595
            if (!e.TELEFONO_MOVIL) {
              e.TELEFONO_MOVIL = "595000";
              e.estado_envio = 2;
            } else {
              e.TELEFONO_MOVIL = e.TELEFONO_MOVIL.replace(0, "595");
            }

            // Reemplazar por mi nro para probar el envio
            // if (!e.TELEFONO_MOVIL) {
            //   e.TELEFONO_MOVIL = "595000";
            //   e.estado_envio = 2;
            // } else {
            //   e.TELEFONO_MOVIL = "595986153301";
            // }

            Turnos_sucursales48hs.create(e)
              //.then((result) => res.json(result))
              .catch((error) => console.log(error.message));
          });

          // IMPORTANTE: cerrar la conexion
          db.detach();
          console.log(
            "Llama a la funcion iniciar envio que se retrasa 1 min en ejecutarse Sucursales48hs"
          );
          iniciarEnvio();
        }
      );
    });
  }

  //injeccionFirebird72();

  // Consulta al JKMT 96hs
  function injeccionFirebird96() {
    console.log("Se actualiza el PSQL 96hs");
    Firebird.attach(firebird, function (err, db) {
      if (err) throw err;

      // db = DATABASE
      db.query(
        // Trae los ultimos 50 registros de turnos del JKMT
        "SELECT * FROM VW_RESUMEN_TURNOS_96HS",

        function (err, result) {
          console.log("Cant de turnos 96hs obtenidos del JKMT:", result.length);

          // Recorre el array que contiene los datos e inserta en la base de postgresql
          result.forEach((e) => {
            // Si el nro de cert trae NULL cambiar por 000000
            if (!e.CARNET) {
              e.CARNET = " ";
            }
            // Si no tiene plan
            if (!e.PLAN_CLIENTE) {
              e.PLAN_CLIENTE = " ";
            }

            // Si el nro de tel trae NULL cambiar por 595000 y cambiar el estado a 2
            // Si no reemplazar el 0 por el 595
            if (!e.TELEFONO_MOVIL) {
              e.TELEFONO_MOVIL = "595000";
              e.estado_envio = 2;
            } else {
              e.TELEFONO_MOVIL = e.TELEFONO_MOVIL.replace(0, "595");
            }

            // Reemplazar por mi nro para probar el envio
            // if (!e.TELEFONO_MOVIL) {
            //   e.TELEFONO_MOVIL = "595000";
            //   e.estado_envio = 2;
            // } else {
            //   e.TELEFONO_MOVIL = "595986153301";
            // }

            Turnos_sucursales48hs.create(e)
              //.then((result) => res.json(result))
              .catch((error) => console.log(error.message));
          });

          // IMPORTANTE: cerrar la conexion
          db.detach();
          console.log(
            "Llama a la funcion iniciar envio que se retrasa 1 min en ejecutarse Sucursales48hs"
          );
          iniciarEnvio();
        }
      );
    });
  }

  // Inicia los envios - Consulta al PGSQL
  let losTurnos = [];
  function iniciarEnvio() {
    setTimeout(() => {
      Turnos_sucursales48hs.findAll({
        where: { estado_envio: 0 },
        order: [["createdAt", "DESC"]],
      })
        .then((result) => {
          losTurnos = result;
          console.log("Enviando turnos Sucursales48hs:", losTurnos.length);
        })
        .then(() => {
          enviarMensaje();
        })
        .catch((error) => {
          res.status(402).json({
            msg: error.menssage,
          });
        });
    }, tiempoRetrasoPGSQL);
  }

  //iniciarEnvio();

  // Reintentar envio si la API WWA falla
  function retry() {
    console.log("Se va a intentar enviar nuevamente luego de 2m ...");
    setTimeout(() => {
      iniciarEnvio();
    }, 1000 * 60);
  }

  // Envia los mensajes
  let retraso = () => new Promise((r) => setTimeout(r, tiempoRetrasoEnvios));
  async function enviarMensaje() {
    console.log("Inicia el recorrido del for para enviar los turnos Sucursales");
    try {
      for (let i = 0; i < losTurnos.length; i++) {
        try {
          const turnoId = losTurnos[i].id_turno;
          mensajePieCompleto =
            `Buenas Sr/a.
  ` +
            losTurnos[i].CLIENTE +
            `

  *ODONTOS* le recuerda su turno en fecha ` +
            losTurnos[i].FECHA +
            ` a las ` +
            losTurnos[i].HORA +
            ` en la sucursal ` +
            losTurnos[i].SUCURSAL +
            ` con el/la profesional ` +
            losTurnos[i].NOMBRE_COMERCIAL +
            `
  #Carnet: ` +
            losTurnos[i].CARNET +
            mensajePie;

          const dataBody = {
            message: mensajePieCompleto,
            phone: losTurnos[i].TELEFONO_MOVIL,
            mimeType: fileMimeTypeMedia,
            data: fileBase64Media,
            fileName: "",
            fileSize: "",
          };

          const response = await axios.post(wwaUrl, dataBody, { timeout: 1000 * 60 });
          // Procesar la respuesta aquí...
          const data = response.data;

          if (data.responseExSave.id) {
            console.log("Enviado - OK");
            // Se actualiza el estado a 1
            const body = {
              estado_envio: 1,
            };

            Turnos_sucursales48hs.update(body, {
              where: { id_turno: turnoId },
            })
              //.then((result) => res.json(result))
              .catch((error) => {
                res.status(412).json({
                  msg: error.message,
                });
              });
          }

          if (data.responseExSave.unknow) {
            console.log("No Enviado - unknow");
            // Se actualiza el estado a 3
            const body = {
              estado_envio: 3,
            };

            Turnos_sucursales48hs.update(body, {
              where: { id_turno: turnoId },
            })
              //.then((result) => res.json(result))
              .catch((error) => {
                res.status(412).json({
                  msg: error.message,
                });
              });
          }

          if (data.responseExSave.error) {
            console.log("No enviado - error");
            const errMsg = data.responseExSave.error.slice(0, 17);
            if (errMsg === "Escanee el código") {
              console.log("Error 104: ", errMsg);
              // Vacia el array de los turnos para no notificar por cada turno cada segundo
              losTurnos = [];
              throw new Error(`Error en sesión en respuesta de la solicitud Axios - ${errMsg}`);
            }
            // Sesion cerrada o desvinculada. Puede que se envie al abrir la sesion o al vincular
            if (errMsg === "Protocol error (R") {
              console.log("Error 105: ", errMsg);
              // Vacia el array de los turnos para no notificar por cada turno cada segundo
              losTurnos = [];
              throw new Error(`Error en sesión en respuesta de la solicitud Axios - ${errMsg}`);
            }
            // El numero esta mal escrito o supera los 12 caracteres
            if (errMsg === "Evaluation failed") {
              updateEstatusERROR(turnoId, 106);
              //console.log("Error 106: ", data.responseExSave.error);
            }
          }
        } catch (error) {
          console.log({error: error.code});
          // Manejo de errores aquí...
          if (error.code === "ECONNABORTED") {
            console.error("La solicitud tardó demasiado y se canceló", error.code);
            notificarSesionOff("Error02 de conexión con la API: " + error.code);
          } else {
            console.error("Error de conexión con la API: ", error.code);
            notificarSesionOff("Error02 de conexión con la API: " + error.code);
          }
          // Lanzar una excepción para detener el bucle
          losTurnos = [];
          throw new Error(`"Error de conexión en la solicitud Axios - ${error.code}`);
        }

        // Esperar 15 segundos antes de la próxima iteración
        await retraso();
      }
      console.log("Fin del envío");
    } catch (error) {
      console.error("Error en el bucle principal:", error.message);
      // Manejar el error del bucle aquí
    }
  }

  function updateEstatusERROR(turnoId, cod_error) {
    // Se actualiza el estado segun el errors
    const body = {
      estado_envio: cod_error,
    };

    Turnos_sucursales48hs.update(body, {
      where: { id_turno: turnoId },
    })
      //.then((result) => res.json(result))
      .catch((error) => {
        res.status(412).json({
          msg: error.message,
        });
      });
  }

  /**
   *  NOTIFICADOR DE ERRORES
   */
  let retrasoNotificador = () => new Promise((r) => setTimeout(r, 5000));

  let numerosNotificados = [
    { NOMBRE: "Alejandro", NUMERO: "595986153301" },
    { NOMBRE: "Alejandro Corpo", NUMERO: "595974107341" },
    //{ NOMBRE: "Juan Corpo", NUMERO: "595991711570" },
  ];

  async function notificarSesionOff(error) {
    for (let item of numerosNotificados) {
      console.log(item);

      mensajeBody = {
        message: `*Error en la API - EnviadorSucursales48hs*
${error}`,
        phone: item.NUMERO,
        mimeType: "",
        data: "",
        fileName: "",
        fileSize: "",
      };

      // Envia el mensaje
      axios
        .post(wwaUrl_Notificacion, mensajeBody, { timeout: 10000 })
        .then((response) => {
          const data = response.data;

          if (data.responseExSave.id) {
            console.log("**Notificacion de ERROR Enviada - OK");
          }

          if (data.responseExSave.error) {
            console.log("**Notificacion de ERROR No enviado - error");
            console.log("**Verificar la sesion local: " + wwaUrl_Notificacion);
          }
        })
        .catch((error) => {
          console.error("**Ocurrió un error - Notificacion de ERROR No enviado:", error.code);
          console.log("**Verificar la sesion local: " + wwaUrl_Notificacion);
        });

      // Espera 5s
      await retrasoNotificador();
    }

    // Reintentar el envio luego de 1m
    retry();
  }

  /*
    Metodos
  */

  app
    .route("/turnosSucursales48hs")
    .get((req, res) => {
      Turnos_sucursales48hs.findAll({
        order: [["createdAt", "DESC"]],
      })
        .then((result) => res.json(result))
        .catch((error) => {
          res.status(402).json({
            msg: error.menssage,
          });
        });
    })
    .post((req, res) => {
      //console.log(req.body);
      Turnos_sucursales48hs.create(req.body)
        .then((result) => res.json(result))
        .catch((error) => res.json(error));
    });

  // Trae los turnos que tengan en el campo estado_envio = 0
  app.route("/turnosSucursales48hsPendientes").get((req, res) => {
    Turnos_sucursales48hs.findAll({
      where: { estado_envio: 0 },
      order: [["FECHA_CREACION", "ASC"]],
      //limit: 5
    })
      .then((result) => res.json(result))
      .catch((error) => {
        res.status(402).json({
          msg: error.menssage,
        });
      });
  });

  // Trae los turnos que ya fueron notificados hoy
  app.route("/turnosSucursales48hsNotificados").get((req, res) => {
    // Fecha de hoy 2022-02-30
    let fechaHoy = new Date().toISOString().slice(0, 10);

    Turnos_sucursales48hs.count({
      where: {
        [Op.and]: [
          { estado_envio: 1 },
          {
            updatedAt: {
              [Op.between]: [fechaHoy + " 00:00:00", fechaHoy + " 23:59:59"],
            },
          },
        ],
      },
      //order: [["FECHA_CREACION", "DESC"]],
    })
      .then((result) => res.json(result))
      .catch((error) => {
        res.status(402).json({
          msg: error.menssage,
        });
      });
  });

  // Trae la cantidad de turnos enviados por rango de fecha desde hasta
  app.route("/turnosSucursales48hsNotificadosFecha").post((req, res) => {
    let fechaHoy = new Date().toISOString().slice(0, 10);
    let { fecha_desde, fecha_hasta } = req.body;

    if (fecha_desde === "" && fecha_hasta === "") {
      fecha_desde = fechaHoy;
      fecha_hasta = fechaHoy;
    }

    if (fecha_hasta == "") {
      fecha_hasta = fecha_desde;
    }

    if (fecha_desde == "") {
      fecha_desde = fecha_hasta;
    }

    console.log(req.body);

    Turnos_sucursales48hs.count({
      where: {
        [Op.and]: [
          { estado_envio: 1 },
          {
            updatedAt: {
              [Op.between]: [fecha_desde + " 00:00:00", fecha_hasta + " 23:59:59"],
            },
          },
        ],
      },
      //order: [["createdAt", "DESC"]],
    })
      .then((result) => res.json(result))
      .catch((error) => {
        res.status(402).json({
          msg: error.menssage,
        });
      });
  });

  app
    .route("/turnosSucursales48hs/:id_turno")
    .get((req, res) => {
      Turnos_sucursales48hs.findOne({
        where: req.params,
        include: [
          {
            model: Users,
            attributes: ["user_fullname"],
          },
        ],
      })
        .then((result) => res.json(result))
        .catch((error) => {
          res.status(404).json({
            msg: error.message,
          });
        });
    })
    .put((req, res) => {
      Turnos_sucursales48hs.update(req.body, {
        where: req.params,
      })
        .then((result) => res.json(result))
        .catch((error) => {
          res.status(412).json({
            msg: error.message,
          });
        });
    })
    .delete((req, res) => {
      //const id = req.params.id;
      Turnos_sucursales48hs.destroy({
        where: req.params,
      })
        .then(() => res.json(req.params))
        .catch((error) => {
          res.status(412).json({
            msg: error.message,
          });
        });
    });
};
