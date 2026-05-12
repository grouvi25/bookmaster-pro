import { BrowserRouter, Routes, Route } from 'react-router-dom';

function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-tg-bg text-tg-text p-4">
      <h1 className="text-2xl font-bold mb-2">BookMaster Pro</h1>
      <p className="text-tg-hint text-center">
        Платформа онлайн-записи к мастерам
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </BrowserRouter>
  );
}
