const ensureDirectoryExistence = (filePath) => {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
};

const saveMessageToJSON = (messageData) => {
    const logPath = path.join(__dirname, "logs", "datos_veraz.json");
    ensureDirectoryExistence(logPath); // Asegurarse de que la carpeta exista
    let messages = [];

    // Leer el archivo JSON si existe
    if (fs.existsSync(logPath)) {
        const data = fs.readFileSync(logPath, "utf8");
        messages = JSON.parse(data);
    }

    // Agregar el nuevo mensaje al array
    messages.push(messageData);

    // Escribir el array actualizado en el archivo
    fs.writeFileSync(logPath, JSON.stringify(messages, null, 2), "utf8");
};


const { createBot, createProvider, createFlow, addKeyword, EVENTS } = require('@bot-whatsapp/bot')
require("dotenv").config();
const axios = require('axios');
const https = require('https');

const QRPortalWeb = require('@bot-whatsapp/portal')
const BaileysProvider = require('@bot-whatsapp/provider/baileys')
const MockAdapter = require('@bot-whatsapp/database/mock')
const path = require("path");
const fs = require("fs");

const menuPath = path.join(__dirname, "mensajes", "menu.txt");
const menu = fs.readFileSync(menuPath, "utf8");

const cursoPath = path.join(__dirname, "mensajes", "curso.txt");
const cursoInfo = fs.readFileSync(cursoPath, "utf8");

const flowSecundario = addKeyword(['2', 'siguiente']).addAnswer(['📄 Aquí tenemos el flujo secundario'])

const flowDocs = addKeyword(['doc', 'documentacion', 'documentación']).addAnswer(
    [
        '📄 Aquí encontras las documentación recuerda que puedes mejorarla',
        'https://bot-whatsapp.netlify.app/',
        '\n*2* Para siguiente paso.',
    ],
    null,
    null,
    [flowSecundario]
)

const flowTuto = addKeyword(['tutorial', 'tuto']).addAnswer(
    [
        '🙌 Aquí encontras un ejemplo rapido',
        'https://bot-whatsapp.netlify.app/docs/example/',
        '\n*2* Para siguiente paso.',
    ],
    null,
    null,
    [flowSecundario]
)

const flowGracias = addKeyword(['gracias', 'grac']).addAnswer(
    [
        '🚀 Puedes aportar tu granito de arena a este proyecto',
        '[*opencollective*] https://opencollective.com/bot-whatsapp',
        '[*buymeacoffee*] https://www.buymeacoffee.com/leifermendez',
        '[*patreon*] https://www.patreon.com/leifermendez',
        '\n*2* Para siguiente paso.',
    ],
    null,
    null,
    [flowSecundario]
)

const flowDiscord = addKeyword(['discord']).addAnswer(
    ['🤪 Únete al discord', 'https://link.codigoencasa.com/DISCORD', '\n*2* Para siguiente paso.'],
    null,
    null,
    [flowSecundario]
)

// Ruta del archivo JSON donde se guardarán los datos
const dataPath = path.join(__dirname, 'datos_veraz.json');

// Función para guardar datos en un archivo JSON
const guardarDatos = (data) => {
    try {
        let contenidoActual = [];
        if (fs.existsSync(dataPath)) {
            const contenido = fs.readFileSync(dataPath, 'utf8');
            contenidoActual = JSON.parse(contenido);
        }
        contenidoActual.push(data);
        fs.writeFileSync(dataPath, JSON.stringify(contenidoActual, null, 2), 'utf8');
        console.log('Datos guardados correctamente:', data); // Agregar log para verificar
    } catch (error) {
        console.error('Error al guardar los datos:', error);
    }
};

const flowVERAZ = addKeyword(['veraz'])
    .addAnswer(
        'Por favor, indíqueme su *CUIL* (sin puntos, espacios o guiones):',
        { capture: true }, // Captura el mensaje del usuario
        async (ctx, { fallBack, flowDynamic }) => {
            const cuil = ctx.body;

            // Validar que el CUIL sea un número de 11 dígitos
            const cuilValido = /^\d{11}$/.test(cuil);
            if (!cuilValido) {
                return fallBack(
                    '❌ *CUIL no válido*. Por favor, ingrese un CUIL de 11 dígitos sin espacios ni guiones.'
                );
            }

            // Llamada a la API
            const url = `https://api.bcra.gob.ar/CentralDeDeudores/v1.0/Deudas/${cuil}`;
            console.log('URL de la API:', url);

            try {
                const response = await axios.get(url, {
                    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
                });

                const { results } = response.data;
                if (!results || !results.periodos) {
                    return fallBack(
                        'No se pudo determinar su situación crediticia. Por favor, intente nuevamente más tarde.'
                    );
                }

                const periodos = results.periodos || [];
                let respuestas = [];
                let datosAGuardar = {
                    cuil,
                    nombreApellido: response.data.nombre || 'Desconocido', // Suponiendo que la API devuelve esto
                    situaciones: [],
                };

                for (const periodo of periodos) {
                    for (const entidad of periodo.entidades) {
                        if (entidad.situacion) {
                            let situacionTexto;
                            switch (entidad.situacion) {
                                case 1:
                                    situacionTexto = `Usted está en buena situación crediticia con ${entidad.entidad}.`;
                                    break;
                                case 2:
                                case 3:
                                case 4:
                                    situacionTexto = `Su situación crediticia presenta problemas recientes con ${entidad.entidad}. ¿Las abonó?`;
                                    break;
                                case 5:
                                    situacionTexto = `Usted se encuentra en situación de mora con ${entidad.entidad}. ¿De cuándo es la deuda?`;
                                    break;
                                default:
                                    situacionTexto = `No se pudo determinar su situación crediticia con ${entidad.entidad}.`;
                            }
                            respuestas.push(situacionTexto);

                            // Guardar en el JSON
                            datosAGuardar.situaciones.push({
                                entidad: entidad.entidad,
                                situacion: entidad.situacion,
                            });
                        }
                    }
                }

                if (respuestas.length === 0) {
                    return fallBack(
                        'No se encontró ninguna situación crediticia. Por favor, intente nuevamente más tarde.'
                    );
                }

                // Guardar los datos en el archivo JSON
                guardarDatos(datosAGuardar);

                // Enviar las respuestas al usuario
                return await flowDynamic(respuestas.join('\n'));
            } catch (error) {
                if (error.response && error.response.status === 404) {
                    return fallBack(
                        'Usted no posee deudas en Banco Central. Si no accede a tarjetas o prestamos es porque tiene bajo scoring financiero, no hay tramite que resuelva eso, salvo el transcurso del tiempo.'
                    );
                }
                console.error('Error al llamar a la API:', error);
                return fallBack(
                    'Hubo un error al verificar su situación crediticia. Por favor, intente nuevamente más tarde.'
                );
            }
        }
    );


const flowCurso = addKeyword(EVENTS.ACTION)
    .addAnswer(
        cursoInfo,  // Envía el contenido del archivo curso.txt
        { delay: 2000 }  // Agrega un pequeño retraso para naturalidad
    )
    .addAnswer(
        'Aquí tienes más información sobre el curso:',
        {
            media: "https://gsgdev.tiendup.com/curso/chat-gpt-para-abogados-as-y-estudiantes-de-derecho"
        }
    )
    .addAnswer( // Captura cualquier otro mensaje que envíe el usuario
        null,  // No enviamos ningún mensaje adicional aquí
        { capture: true },  // Capturamos el siguiente mensaje del usuario
        async (ctx, { flowDynamic }) => {
            // Respondemos con un mensaje predefinido
            await flowDynamic(
                "La Dra. le responderá a la brevedad"
            );
        }
    );

const flowWelcome = addKeyword(['veraz','quiero recibir informacion', 'cursos', 'menu', 'información','informacion','nosis', '¡Hola! Podrías darme más información de']) // Palabras clave que activarán este flujo
    .addAnswer(
        "👋 ¡Bienvenido/a! 🙌\n\nSoy un 🤖 que ayuda a la doctora San German. Por favor, elige alguna de las siguientes opciones:",
        { delay: 5000 }  // Retraso para que el bot se vea más natural
    )
    .addAnswer(
        menu,  // Envía el contenido del archivo menu.txt
        { capture: true },
        async (ctx, { gotoFlow, flowDynamic }) => {
            // Si el mensaje no es ninguna de las opciones válidas (1, 2, 3, 0), no hacer nada
            if (!["1", "2", "3", "0"].includes(ctx.body)) {
                return;  // Esto hará que no responda nada
            }

            // Si elige una opción válida, entonces ejecutamos la lógica correspondiente
            switch (ctx.body) {
                case "1":
                    return gotoFlow(flowCurso);
                case "2":
                    return gotoFlow(flowVERAZ);
                case "3":
                    return gotoFlow(flowConsultas);
                case "0":
                    return await flowDynamic(
                        "👋 *Saliendo...* Puedes volver a acceder a este menú escribiendo '*Menu*'."
                    );
            }
        }
    );

const flowConsultas = addKeyword(EVENTS.ACTION)
    .addAnswer('Si tenes dudas sobre alguno de los servicios escribime!');

const flowPrincipal = addKeyword(['hola', 'ole', 'alo'])
    .addAnswer('🙌 Hola bienvenido a este *Chatbot*')
    .addAnswer(
        [
            'te comparto los siguientes links de interes sobre el proyecto',
            '👉 *doc* para ver la documentación',
            '👉 *gracias*  para ver la lista de videos',
            '👉 *discord* unirte al discord',
        ],
        null,
        null,
        [flowDocs, flowGracias, flowTuto, flowDiscord]
    )

const main = async () => {
    const adapterDB = new MockAdapter()
    const adapterFlow = createFlow([flowWelcome, flowCurso, flowVERAZ, flowConsultas])
    const adapterProvider = createProvider(BaileysProvider)

    createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    })

    QRPortalWeb()
}

main()
