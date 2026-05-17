import { Outlet } from 'react-router-dom';
import ClientTabBar from './ClientTabBar';

export default function ClientLayout() {
  return (
    <>
      <div className="pb-24">
        <Outlet />
      </div>
      <ClientTabBar />
    </>
  );
}
