import { RequireAuth } from "@/components/require-auth";
import { WalletScreen } from "@/components/wallet-screen";

export const metadata = { title: "Carteira · LanceAuto" };

export default function CarteiraPage() {
  return (
    <RequireAuth role="BIDDER">
      <WalletScreen />
    </RequireAuth>
  );
}
