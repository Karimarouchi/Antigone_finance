import { InvoiceProvider } from '@/features/invoice/context/InvoiceContext';
import InvoiceFeaturePage from '@/features/invoice/InvoicePage';

export default function InvoicePage() {
  return (
    <InvoiceProvider>
      <InvoiceFeaturePage />
    </InvoiceProvider>
  );
}
