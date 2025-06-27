import './styles/index.css';
import { App } from './components/App';

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
  const appElement = document.getElementById('app');
  if (appElement) {
    const app = new App();
    await app.mount(appElement);
  } else {
    console.error('App element not found');
  }
});