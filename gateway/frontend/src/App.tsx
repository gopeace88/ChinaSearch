import { BrowserRouter, Routes, Route } from 'react-router-dom';
import SessionList from './pages/SessionList';
import SessionDetail from './pages/SessionDetail';
import NewSession from './pages/NewSession';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SessionList />} />
        <Route path="/sessions/:id" element={<SessionDetail />} />
        <Route path="/new" element={<NewSession />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
