// ========== Main windows ==========

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadFile("index.html");
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle("set-led-color", async (event, data) => {
    const { r, g, b, sendData } = data;
    return controller.setColor(r, g, b, sendData);
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ========== HID Integration ==========

const CRC32 = require("crc-32");
const HID = require("node-hid");

class DualSense {
  constructor(device) {
    this.device = device;

    const allDevices = HID.devices();

    const devices = allDevices.filter(
      (d) =>
        d.vendorId === 1356 && (d.productId === 3302 || d.productId === 3570),
    );

    console.log(`Dispositivos HID encontrados:`, allDevices);

    device =
      devices.find((d) => d.productId === 3302) ||
      devices.find((d) => d.productId === 3570);

    if (device === undefined) {
      throw new Error("Controlador no encontrado.");
    }

    this.controller = new HID.HID(device.path);
    this.deviceConnection = device.interface;
    this.isBluetooth = this.deviceConnection === -1 ? true : false;

    if (this.controller) {
      console.log(
        `Controlador DualSense conectado por ${
          this.deviceConnection === -1 ? "Bluetooth" : "USB"
        }\n`,
        this.controller.getDeviceInfo(),
      );
    }

    //this.controller.on("data", (data) => {
    //  this.processInput(data);
    //});

    this.controller.on("error", (err) => {
      console.log("[DS] Error en controlador (posible desconexión):", err);
    });
  }

  // ========== Output reports ==========

  sendData(data) {
    if (this.data) {
      console.log(`[sendData]`, data);
    }

    return this.controller.write(data);
  }

  report(data, sendData) {
    const length = this.isBluetooth ? 78 : 64;

    const paquete = Buffer.alloc(length, 0);
    for (const [index, value] of data) {
      paquete[index] = value;
    }

    if (this.isBluetooth) {
      const headerBT = Buffer.from([0xa2]);
      const dataForCrc = paquete.slice(0, 74);
      const crcBuffer = Buffer.concat([headerBT, dataForCrc]);

      const crcChecksum = CRC32.buf(crcBuffer);
      const unsignedCrc = crcChecksum >>> 0;

      paquete.writeUInt32LE(unsignedCrc, 74);
    }

    console.log("--- Mapa de Bytes Enviados ---");
    let output = "";
    paquete.forEach((byte, i) => {
      const indexStr = i.toString().padStart(2, "0");
      const hexValue = byte.toString(16).padStart(2, "0");
      output += `[${indexStr}:${hexValue}] `;

      if ((i + 1) % 17 === 0) output += "\n";
    });
    console.log(output);

    if (sendData) {
      this.controller.write(Array.from(paquete));
    }

    return paquete;
  }

  setColor(r, g, b, sendData) {
    if (r > 255 || g > 255 || b > 255 || r < 0 || g < 0 || b < 0) {
      throw new Error("Colors have values from 0 to 255 only");
    }

    return this.isBluetooth
      ? this.reportBT(r, g, b, sendData)
      : this.reportUSB(r, g, b, sendData);
  }

  reportBT(r, g, b, sendData = true) {
    return this.report(
      [
        [0, 0x31], // Report ID (Bluetooth)
        [2, 0x10],
        [4, 0xf7],

        [47, r], // Rojo (Slot 47)
        [48, g], // Verde (Slot 48)
        [49, b], // Azul (Slot 49)
      ],
      sendData,
    );
  }

  reportUSB(r, g, b, sendData = true) {
    return this.report(
      [
        [0, 0x2],
        [2, 0x4],
        [45, r],
        [46, g],
        [47, b],
      ],
      sendData,
    );
  }

  // ============== INPUT REPORTS ==============
  processInput(data) {
    const reportId = data[0];

    let stickLeftX, stickLeftY, btnCross, batteryLevel, isCharging, reportSize;

    if (reportId === 0x01) {
      reportSize = data.length;
      stickLeftX = data[1];
      stickLeftY = data[2];

      const buttons = data[8];
      btnCross = (buttons & 0x20) !== 0;

      const batteryByte = data[53];
      batteryLevel = Math.min((batteryByte & 0x0f) * 10 + 5, 100);
    } else if (reportId === 0x31) {
      reportSize = data.length;
      stickLeftX = data[2];
      stickLeftY = data[3];

      const buttons = data[9];
      btnCross = (buttons & 0x20) !== 0;

      const batteryByte = data[54];
      batteryLevel = Math.min((batteryByte & 0x0f) * 10 + 5, 100);
      isCharging = (batteryByte & 0xf0) >> 4 !== 0;
    } else {
      return;
    }

    if (this.isBluetooth && reportId === 0x31) {
      console.log(
        `[BT INPUT] ID: ${reportId.toString(
          16,
        )} | Tamaño: ${reportSize} B | LStick X/Y: ${stickLeftX}/${stickLeftY} | X-Button: ${
          btnCross ? "PRESS" : "---"
        } | Batería: ${batteryLevel}%`,
      );
    }
  }
}

const controller = new DualSense();

setTimeout(() => {
  controller.setColor(255, 255, 0, true);
}, 2000);
