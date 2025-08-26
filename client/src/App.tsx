import { Routes, Route, Link, Navigate } from 'react-router-dom';
import Live from './pages/Live';
import Client from './pages/Client';

export default function App() {
  return (
    <div style={{ height: '100%' }}>
      <Routes>
        <Route path='/' element={<Navigate to='/live' />} />
        <Route path='/live' element={<Live />} />
        <Route path='/client' element={<Client />} />
      </Routes>
    </div>
  );
}
