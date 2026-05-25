import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

const searchParams = new URLSearchParams(window.location.search);
const mode = searchParams.get('mode') === 'overlay' ? 'overlay' : 'dashboard';

ReactDOM.createRoot(document.getElementById('root')!).render(<App mode={mode} />);
