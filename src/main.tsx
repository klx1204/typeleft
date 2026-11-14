import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import { initI18n } from 'services/i18n';

initI18n().finally(() => {
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById('root')
  );
});
