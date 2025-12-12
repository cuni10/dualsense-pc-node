// ========== Main windows ==========

const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();

  ipcMain.handle('set-led-color', async (event, data) => {
    const { r, g, b, sendData } = data;
    return controller.setColor(r, g, b, sendData);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ========== HID Integration ==========

const CRC32 = require('crc-32');
const HID = require('node-hid');


class DualSense {
    constructor(device) {
      this.device = device;
    
      const allDevices = HID.devices();

      const devices = allDevices.filter(d => d.vendorId === 1356 && (d.productId === 3302 || d.productId === 3570));

      console.log(`Dispositivos HID encontrados:`, devices);

      device = devices.find(d => d.productId === 3302) || devices.find(d => d.productId === 3570);

      if(device === undefined) {
        throw new Error('Controlador no encontrado.');
      }

      this.controller = new HID.HID(device.path);

      this.deviceConnection = device.interface;
      this.isBluetooth = this.deviceConnection === -1 ? true : false;

      if (this.controller) {
        console.log(`Controlador DualSense conectado por ${this.deviceConnection === -1 ? "Bluetooth" : "USB"}\n`,this.controller.getDeviceInfo());
  
      }
    }

    sendData(data) {
		if (this.data) {
			console.log(`[sendData]`, data);
		}

		return this.controller.write(data);
	}

    report(data, sendData){

      const length = this.isBluetooth ? 78 : 64; 

      const paquete = new Array(length).fill(0);
      for (const i in data){
        const[index, value] = data[i];
        paquete[index] = value;
      }

      if(this.isBluetooth){
        const dataForCrc = paquete.slice(0, 74);
        
        const crcChecksum = CRC32.buf(Buffer.from(dataForCrc));

        const unsignedCrc = crcChecksum >>> 0;

        paquete[74] = (unsignedCrc & 0x000000FF);
        paquete[75] = (unsignedCrc & 0x0000FF00) >> 8;
        paquete[76] = (unsignedCrc & 0x00FF0000) >> 16;
        paquete[77] = (unsignedCrc & 0xFF000000) >> 24;

      }

      if(sendData){
        this.sendData(paquete);
      }

      return paquete;
    }

    setColor(r, g, b, sendData) {

		if( (r > 255 || g > 255 || b > 255) || (r < 0 || g < 0 || b < 0) ){
			throw new Error('Colors have values from 0 to 255 only');
		}

		  return this.isBluetooth ? this.reportBT(r,g,b,sendData) : this.reportUSB(r,g,b,sendData);
	  }

	  reportBT(r,g,b,sendData = true) {

		return this.report([
			[0, 0x31],
			[1, 0x02],
      [2, 0xFF],
      [3, 0x57],
      [43, 0x01],
      [44,0x00],
			[46, r],
			[47, g],
			[48, b],
		], sendData);
	  }

    reportUSB(r,g,b,sendData = true) {

      return this.report([
			  [0, 0x2],
			  [2, 0x4],
			  [45, r],
			  [46, g],
			  [47, b],
		  ],sendData);
    }
}

const controller = new DualSense();


setTimeout(() => {
  controller.setColor(255, 255, 0, true);
}, 2000);

