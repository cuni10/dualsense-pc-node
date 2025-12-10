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

const HID = require('node-hid');

class DualSense {
    constructor(device) {
      this.device = device;
    
      const devices = HID.devices();

      device = devices.find(({ productId, vendorId }) => productId === 3302 && vendorId === 1356);

      if(device === undefined) {
        throw new Error('Controlador no encontrado.');
      }

      this.controller = new HID.HID(device.path);
      if (this.controller) {
        console.log('Controlador DualSense conectado.\n',this.controller.getDeviceInfo());
      }
    }

    sendData(data) {
		if (this.data) {
			console.log(`[sendData]`, data);
		}

		return this.controller.write(data);
	}

    report(data, sendData){
      const paquete = new Array(64).fill(0);
      for (const i in data){
        const[index, value] = data[i];
        paquete[index] = value;
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

		return this.reportUSB(r, g, b, sendData);
	}

  	reportUSB(r,g,b,sendData = true) {

		return this.report([
			[0, 0x2],
			[2, 0x4],
			[45, r],
			[46, g],
			[47, b],
		], sendData);
	}

	  reportBT(r,g,b,sendData = true) {

		return this.report([
			[0, 0x31],
			[1, 0x02],
      [3, 0x04],
			[46, r],
			[47, g],
			[48, b],
		], sendData);
	  }
}


const controller = new DualSense();

controller.setColor(255, 255, 0, true);