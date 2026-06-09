import { Outlet } from 'react-router-dom';
import { ClientTabBar } from '@/components/common/TabBar';

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
