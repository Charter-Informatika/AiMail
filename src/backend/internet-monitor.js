import dns from 'dns';
import { BrowserWindow } from 'electron';

let internetMonitorInterval = null;
let lastInternetStatus = null;

export function checkInternetConnection() {
  return new Promise((resolve) => {
    dns.lookup('google.com', (err) => {
      resolve(!err);
    });
  });
}

function emitStatus(online) {
  if (online) {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('internet-connection-restored'));
  } else {
    BrowserWindow.getAllWindows().forEach(w => w.webContents.send('no-internet-connection'));
  }
}

export function startInternetMonitoring() {
  if (internetMonitorInterval) clearInterval(internetMonitorInterval);
  
  const checkNow = async () => {
    try {
      const ok = await checkInternetConnection();
      if (lastInternetStatus === null) {
        emitStatus(ok);
      } else if (ok !== lastInternetStatus) {
        emitStatus(ok);
      }
      lastInternetStatus = ok;
    } catch {
      if (lastInternetStatus !== false) emitStatus(false);
      lastInternetStatus = false;
    }
  };
  
  checkNow();
  internetMonitorInterval = setInterval(checkNow, 3000); 
}

export function stopInternetMonitoring() {
  if (internetMonitorInterval) {
    clearInterval(internetMonitorInterval);
    internetMonitorInterval = null;
  }
}

export function getLastInternetStatus() {
  return lastInternetStatus;
}
