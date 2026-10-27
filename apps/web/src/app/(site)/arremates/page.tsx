import { MyBidsScreen } from "@/components/my-bids/my-bids-screen";
import { RequireAuth } from "@/components/require-auth";

export const metadata = { title: "Meus arremates · LanceAuto" };

export default function ArrematesPage() {
  return (
    <RequireAuth role="BIDDER">
      <MyBidsScreen />
    </RequireAuth>
  );
}
