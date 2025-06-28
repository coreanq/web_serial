import './styles/index.css';
import { App } from './components/App';

// Chrome extension popup entry point
document.addEventListener('DOMContentLoaded', async () => {
  const appElement = document.getElementById('app');
  if (appElement) {
    const app = new App();
    await app.mount(appElement);
    
    // Chrome extension specific adjustments
    adjustForChromeExtension(app);
  } else {
    console.error('App element not found');
  }
});

function adjustForChromeExtension(app: App) {
  // Set compact layout for popup
  app.setConnectionPanelPosition('top');
  
  // Handle popup size constraints
  const body = document.body;
  body.style.minWidth = '800px';
  body.style.minHeight = '600px';
  
  // Add chrome extension specific event listeners
  setupChromeExtensionHandlers();
}

function setupChromeExtensionHandlers() {
  // Handle chrome extension lifecycle
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Popup received message:', message);
      // Handle background script messages
      return true;
    });
  }

  // Test Web Serial API availability
  console.log('Testing Web Serial API...');
  console.log('navigator.serial available:', 'serial' in navigator);
  console.log('navigator.serial:', (navigator as any).serial);
  
  if ('serial' in navigator) {
    // Test getting already granted ports (doesn't require user gesture)
    (navigator as any).serial.getPorts().then((ports: any) => {
      console.log('Available serial ports:', ports.length);
      ports.forEach((port: any, index: number) => {
        console.log(`Port ${index}:`, port.getInfo());
      });
    }).catch((error: any) => {
      console.error('Error getting ports:', error);
    });

    
  } else {
    console.warn('Web Serial API not available');
  }
}