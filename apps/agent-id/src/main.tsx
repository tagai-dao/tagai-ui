import {createRoot} from 'react-dom/client';
import Atlas from './app/ui';
import './app/globals.css';
import './app/atlas-theme.css';
createRoot(document.getElementById('root')!).render(<Atlas/>);
