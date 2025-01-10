const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, 'logs', 'datos_veraz.json');

function saveMessage(apiResponse) {
  const { cuil, nombre, apellido, situacion } = apiResponse;

  const message = {
    cuil,
    nombre,
    apellido,
    situacion,
    timestamp: new Date().toISOString()
  };

  fs.readFile(logFilePath, 'utf8', (err, data) => {
    let logData = { messages: [] };

    if (err) {
      if (err.code === 'ENOENT') {
        console.log('Log file does not exist, creating a new one.');
      } else {
        console.error('Error reading log file:', err);
        return;
      }
    } else {
      try {
        logData = JSON.parse(data);
        if (!Array.isArray(logData.messages)) {
          logData.messages = [];
        }
      } catch (err) {
        console.error('Error parsing log file:', err);
      }
    }

    logData.messages.push(message);

    fs.writeFile(logFilePath, JSON.stringify(logData, null, 2), 'utf8', (err) => {
      if (err) {
        console.error('Error writing to log file:', err);
      } else {
        console.log('Message saved successfully.');
      }
    });
  });
}

// Ejemplo de uso
const apiResponse = {
  cuil: '20-12345678-9',
  nombre: 'Juan',
  apellido: 'Pérez',
  situacion: 'Activo'
};

saveMessage(apiResponse);
// ...existing code...
