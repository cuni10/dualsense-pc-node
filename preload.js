const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Expone una función que envía un mensaje IPC al proceso principal
  setColor: (r, g, b, sendData) =>
    ipcRenderer.invoke("set-led-color", { r, g, b, sendData }),
});
