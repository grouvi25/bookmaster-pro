import { Outlet } from 'react-router-dom';
import ClientTabBar from './ClientTabBar';

export default function ClientLayout() {
  return (
    <>
      <Outlet />
      <ClientTabBar />
    </>
  );
}
